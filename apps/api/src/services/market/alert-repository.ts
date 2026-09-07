import type { AlertSummary, ListingContactStatus, ListingDecisionStage } from "@mieszkania/shared";
import { withDb } from "../../db";
import { buildEffectiveListingDateSql } from "../listings/listing-recency";

const EFFECTIVE_LISTING_DATE_SQL = buildEffectiveListingDateSql("l");

type AlertRow = {
  id: string;
  title: string;
  city: string;
  district: string | null;
  canonical_url: string | null;
  price_amount: string | null;
  manual_contact_status: string | null;
  manual_decision_stage: string | null;
  manual_last_contact_at: string | null;
  manual_negotiated_price_amount: string | null;
  manual_asking_price_override: string | null;
  viewing_scheduled_at: string | null;
  viewing_status: "scheduled" | "completed" | "cancelled" | null;
};

export async function getAlerts(): Promise<AlertSummary[]> {
  return withDb(async (db) => {
    const result = await db.query<AlertRow>(`
      select
        l.id,
        l.title,
        l.city,
        l.district,
        l.canonical_url,
        l.price_amount::text,
        lmo.contact_status as manual_contact_status,
        lmo.decision_stage as manual_decision_stage,
        lmo.last_contact_at::text as manual_last_contact_at,
        lmo.negotiated_price_amount::text as manual_negotiated_price_amount,
        lmo.asking_price_override::text as manual_asking_price_override,
        lv.scheduled_at::text as viewing_scheduled_at,
        lv.status as viewing_status
      from listings l
      left join listing_manual_overrides lmo on lmo.listing_id = l.id
      left join listing_viewings lv on lv.listing_id = l.id
      where l.status = 'active'
        and l.hidden_duplicate_of_id is null
        and coalesce(l.rooms, 0) <> 2
      order by ${EFFECTIVE_LISTING_DATE_SQL} desc nulls last, l.created_at desc
      limit 250
    `);

    const alerts = result.rows.flatMap(buildListingAlerts);
    const unique = new Map<string, AlertSummary>();

    for (const alert of alerts) {
      unique.set(alert.id, alert);
    }

    return Array.from(unique.values()).sort(compareAlerts).slice(0, 30);
  });
}

function buildListingAlerts(row: AlertRow): AlertSummary[] {
  const alerts: AlertSummary[] = [];
  const decisionStage = normalizeDecisionStage(row.manual_decision_stage);
  const contactStatus = normalizeContactStatus(row.manual_contact_status);
  const lastContactAt = row.manual_last_contact_at ? new Date(row.manual_last_contact_at) : null;
  const scheduledAt = row.viewing_scheduled_at ? new Date(row.viewing_scheduled_at) : null;
  const askingOverride = row.manual_asking_price_override
    ? Number(row.manual_asking_price_override)
    : undefined;
  const negotiated = row.manual_negotiated_price_amount
    ? Number(row.manual_negotiated_price_amount)
    : undefined;

  if (
    (decisionStage === "to_call" || decisionStage === "new") &&
    !lastContactAt &&
    contactStatus !== "contacted"
  ) {
    alerts.push(
      makeAlert(
        row,
        "missing-contact",
        "medium",
        "Do pierwszego kontaktu",
        "Oferta jest w procesie, ale nie ma jeszcze zapisanego kontaktu ani rozmowy.",
      ),
    );
  }

  if (
    decisionStage &&
    decisionStage !== "rejected" &&
    decisionStage !== "bought" &&
    lastContactAt &&
    daysSince(lastContactAt) >= 5
  ) {
    alerts.push(
      makeAlert(
        row,
        "follow-up",
        "medium",
        "Brak follow-upu",
        `Minelo ${daysSince(lastContactAt)} dni od ostatniego kontaktu. Warto odswiezyc rozmowe.`,
      ),
    );
  }

  if (scheduledAt && row.viewing_status === "scheduled") {
    const hours = hoursUntil(scheduledAt);
    if (hours >= 0 && hours <= 30) {
      alerts.push(
        makeAlert(
          row,
          "viewing-soon",
          "high",
          "Ogladanie juz zaraz",
          `Masz zaplanowane ogledziny ${formatRelativeHours(hours)}.`,
        ),
      );
    }
  }

  if (
    typeof negotiated === "number" &&
    typeof askingOverride === "number" &&
    askingOverride <= negotiated
  ) {
    alerts.push(
      makeAlert(
        row,
        "target-reached",
        "high",
        "Cena w Waszym celu",
        `Cena po rozmowie ${formatCurrency(askingOverride)} miesci sie w celu negocjacji ${formatCurrency(negotiated)}.`,
      ),
    );
  }

  if (
    decisionStage === "after_viewing" &&
    contactStatus !== "negotiating" &&
    contactStatus !== "closed"
  ) {
    alerts.push(
      makeAlert(
        row,
        "after-viewing",
        "low",
        "Decyzja po ogladaniu",
        "Oferta jest po ogladaniu, ale nie ma jeszcze kolejnego kroku: negocjacji, oferty albo odrzucenia.",
      ),
    );
  }

  return alerts;
}

function makeAlert(
  row: AlertRow,
  suffix: string,
  severity: NonNullable<AlertSummary["severity"]>,
  name: string,
  trigger: string,
): AlertSummary {
  return {
    id: `${row.id}-${suffix}`,
    name: `${name}: ${row.title}`,
    city: row.city,
    district: row.district ?? undefined,
    trigger,
    deliveryChannel: "web",
    status: "active",
    listingId: row.id,
    severity,
  };
}

function compareAlerts(left: AlertSummary, right: AlertSummary) {
  const severityOrder = { high: 0, medium: 1, low: 2, undefined: 3 } as const;
  const leftOrder = severityOrder[left.severity ?? "undefined"];
  const rightOrder = severityOrder[right.severity ?? "undefined"];
  return leftOrder - rightOrder || left.name.localeCompare(right.name, "pl");
}

function normalizeDecisionStage(value?: string | null): ListingDecisionStage | undefined {
  const allowed: ListingDecisionStage[] = [
    "new",
    "to_call",
    "after_call",
    "to_viewing",
    "after_viewing",
    "to_offer",
    "rejected",
    "bought",
  ];
  return value && allowed.includes(value as ListingDecisionStage)
    ? (value as ListingDecisionStage)
    : undefined;
}

function normalizeContactStatus(value?: string | null): ListingContactStatus | undefined {
  const allowed: ListingContactStatus[] = [
    "new",
    "contacted",
    "negotiating",
    "viewing_scheduled",
    "rejected",
    "closed",
  ];
  return value && allowed.includes(value as ListingContactStatus)
    ? (value as ListingContactStatus)
    : undefined;
}

function daysSince(date: Date) {
  const diffMs = Date.now() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function hoursUntil(date: Date) {
  const diffMs = date.getTime() - Date.now();
  return Math.round(diffMs / (1000 * 60 * 60));
}

function formatRelativeHours(hours: number) {
  if (hours < 1) {
    return "dzisiaj";
  }

  if (hours < 24) {
    return `za ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return remainder > 0 ? `za ${days} d ${remainder} h` : `za ${days} d`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}
