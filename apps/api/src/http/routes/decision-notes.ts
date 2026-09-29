import type { FastifyInstance } from "fastify";
import type { DecisionNote } from "@mieszkania/shared";
import {
  getDecisionNotes,
  getDecisionReminders,
  saveDecisionNote,
} from "../../services/listings/decision-notes";

export function validDecisionNote(value: unknown): value is DecisionNote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const n = value as DecisionNote;
  const keys = [
    "key",
    "kind",
    "label",
    "answer",
    "evidence",
    "checkedAt",
    "dueAt",
    "done",
    "version",
  ];
  if (Object.keys(n).some((key) => !keys.includes(key))) return false;
  if (typeof n.key !== "string" || !/^[a-z0-9_-]{1,80}$/.test(n.key)) return false;
  if (!["question", "fact", "action"].includes(n.kind)) return false;
  for (const key of ["label", "answer", "evidence"] as const)
    if (typeof n[key] !== "string" || n[key].length > (key === "label" ? 200 : 4000)) return false;
  if (
    !n.label.trim() ||
    typeof n.done !== "boolean" ||
    !Number.isSafeInteger(n.version) ||
    n.version < 0
  )
    return false;
  for (const date of [n.checkedAt, n.dueAt])
    if (
      typeof date !== "string" ||
      (date !== "" &&
        (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString() !== date))
    )
      return false;
  if (n.kind === "action") return Boolean(n.dueAt && n.answer.trim());
  return !n.done || Boolean(n.answer.trim() && n.evidence.trim() && n.checkedAt);
}

export function registerDecisionNotesRoutes(app: FastifyInstance) {
  app.get("/api/decision-reminders", async () => getDecisionReminders());
  app.get<{ Params: { id: string } }>(
    "/api/listings/:id/decision-notes",
    async (request, reply) => {
      const notes = await getDecisionNotes(request.params.id);
      return notes ?? reply.code(404).send({ message: "Oferta nie istnieje." });
    },
  );
  app.post<{ Params: { id: string }; Body: DecisionNote }>(
    "/api/listings/:id/decision-notes",
    async (request, reply) => {
      if (!validDecisionNote(request.body))
        return reply
          .code(400)
          .send({ message: "Uzupełnij odpowiedź, źródło i datę ustalenia albo termin czynności." });
      const saved = await saveDecisionNote(request.params.id, request.body);
      return (
        saved ??
        reply.code(409).send({
          message:
            "Dane zmieniły się w innym oknie lub oferta została usunięta. Odśwież dane przed ponownym zapisem.",
        })
      );
    },
  );
}
