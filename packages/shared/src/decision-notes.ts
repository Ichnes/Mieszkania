export type DecisionNoteKind = "question" | "fact" | "action";
export type DecisionNote = {
  key: string;
  kind: DecisionNoteKind;
  label: string;
  answer: string;
  evidence: string;
  checkedAt: string;
  dueAt: string;
  done: boolean;
  version: number;
};
export type DecisionReminder = DecisionNote & { listingId: string; title: string };
