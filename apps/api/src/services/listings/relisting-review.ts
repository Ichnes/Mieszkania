import type { RelistedListingMatch } from "@mieszkania/shared";
import type { Pool } from "pg";
import { pool } from "../../db";
import { getEstablishedRelistingMatch } from "./relisting-results";
import { getListingRelistingCandidates } from "./listing-relistings";

export type RelistingReview = {
  current_listing_id: string;
  previous_listing_id: string;
  decision: "confirmed" | "rejected";
  match_payload: RelistedListingMatch;
};

export async function reviewRelisting(
  currentId: string,
  previousId: string,
  decision: RelistingReview["decision"],
  db: Pool = pool,
  manual = false,
) {
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('relisting-candidates'))");
    const eligible = await client.query(
      `select current.id from listings current join listings previous on previous.id=$2
      where current.id=$1 and current.status='active' and previous.status='removed'
        and current.hidden_duplicate_of_id is null and previous.hidden_duplicate_of_id is distinct from current.id
        and coalesce(current.exclusion_reason,'') <> 'manual_rejected'
        and coalesce(previous.exclusion_reason,'') <> 'manual_rejected'
        and previous.first_seen_at < current.first_seen_at
      for update of current, previous`,
      [currentId, previousId],
    );
    if (!eligible.rowCount)
      throw new Error(
        "Oferta zmieniła status lub nie jest już dostępna do połączenia. Sprawdź oferty ponownie.",
      );
    const existing = (
      await client.query<RelistingReview>(
        "select * from listing_relisting_reviews where current_listing_id=$1 and previous_listing_id=$2",
        [currentId, previousId],
      )
    ).rows[0];
    const candidate = (
      await client.query<{ match_payload: RelistedListingMatch }>(
        "select match_payload from listing_relisting_candidates where current_listing_id=$1 and previous_listing_id=$2",
        [currentId, previousId],
      )
    ).rows[0]?.match_payload;
    if (manual && decision === "confirmed") {
      await client.query(
        `insert into listing_relistings(current_listing_id,previous_listing_id,confidence_score,reason_summary,previous_price_amount,relisted_price_amount)
        select l.id,a.id,100,'Wskazane przez użytkownika',a.price_amount,l.price_amount from listings l join listings a on a.id=$2 where l.id=$1
        on conflict(current_listing_id,previous_listing_id) do nothing`,
        [currentId, previousId],
      );
    }
    const match =
      candidate ??
      existing?.match_payload ??
      (await getEstablishedRelistingMatch(currentId, previousId, client)) ??
      (await getListingRelistingCandidates(currentId, client)).find(
        (item) => item.previous.id === previousId,
      );
    if (!match) throw new Error("Ta propozycja nie jest już aktualna. Sprawdź oferty ponownie.");
    const reviewed = { ...match, manuallyConfirmed: decision === "confirmed" };
    await client.query(
      `insert into listing_relisting_reviews(current_listing_id,previous_listing_id,decision,match_payload)
      values ($1,$2,$3,$4::jsonb) on conflict(current_listing_id,previous_listing_id)
      do update set decision=excluded.decision,match_payload=excluded.match_payload,reviewed_at=now()`,
      [currentId, previousId, decision, JSON.stringify(reviewed)],
    );
    if (decision === "confirmed") {
      await client.query(
        `insert into listing_relistings(current_listing_id,previous_listing_id,confidence_score,reason_summary,previous_price_amount,relisted_price_amount)
        values($1,$2,$3,$4,$5,$6) on conflict(current_listing_id,previous_listing_id) do update set
        confidence_score=excluded.confidence_score,reason_summary=excluded.reason_summary,previous_price_amount=excluded.previous_price_amount,
        relisted_price_amount=excluded.relisted_price_amount,last_detected_at=now()`,
        [
          currentId,
          previousId,
          match.confidenceScore,
          "Potwierdzone ręcznie. " + match.reasons.join(", "),
          match.previous.priceAmount ?? null,
          match.current.priceAmount ?? null,
        ],
      );
    } else {
      await client.query(
        "delete from listing_relistings where current_listing_id=$1 and previous_listing_id=$2",
        [currentId, previousId],
      );
    }
    await client.query(
      "delete from listing_relisting_candidates where current_listing_id=$1 and previous_listing_id=$2",
      [currentId, previousId],
    );
    await client.query("update listings set updated_at=now() where id=$1", [currentId]);
    await client.query("commit");
    return { decision, match: reviewed };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
