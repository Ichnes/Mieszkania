import assert from "node:assert/strict";
import test from "node:test";
import type { ListingDetail } from "@mieszkania/shared";
import { emptyNote, mergeNotes, viewingQuestions } from "./questions";
test("unknown facts generate questions; confirmed absence does not; existing answers survive changed suggestions", () => {
  const unknown = viewingQuestions({} as ListingDetail);
  assert.ok(unknown.some((n) => n.key === "question-lift"));
  const known = viewingQuestions({
    amenityEvidence: { lift: false, storage: false, garage: false },
    yearBuilt: 2001,
    maintenanceFeeLabel: "800 zł",
  } as ListingDetail);
  assert.ok(
    !known.some((n) =>
      [
        "question-lift",
        "question-storage",
        "question-parking",
        "question-fees",
        "question-year",
      ].includes(n.key),
    ),
  );
  const answer = { ...emptyNote("question-lift", "question", "Winda"), answer: "Nie", version: 1 };
  assert.equal(mergeNotes(known, [answer]).find((n) => n.key === answer.key)?.answer, "Nie");
});
