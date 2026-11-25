import type {
  ListingContactEventType,
  ListingContactStatus,
  ListingDetail,
} from "@mieszkania/shared";
import { formatPln, toDatetimeInputValue } from "../../../shared/lib/format";

export function toContactStatus(value: string): ListingContactStatus | undefined {
  const allowed: ListingContactStatus[] = [
    "new",
    "contacted",
    "negotiating",
    "viewing_scheduled",
    "rejected",
    "closed",
  ];
  return allowed.includes(value as ListingContactStatus)
    ? (value as ListingContactStatus)
    : undefined;
}

export { contactStatusDisplay, decisionStageDisplay } from "../../../shared/lib/contact-labels";

export function createEmptyContactEventDraft(contactName?: string) {
  return {
    eventType: "call" as ListingContactEventType,
    occurredAt: toDatetimeInputValue(new Date().toISOString()),
    title: "",
    notes: "",
    contactName: contactName ?? "",
    amount: "",
  };
}

export function toDecisionStage(value: string): ListingDetail["manual"]["decisionStage"] {
  const allowed: NonNullable<ListingDetail["manual"]["decisionStage"]>[] = [
    "new",
    "to_call",
    "after_call",
    "to_viewing",
    "after_viewing",
    "to_offer",
    "rejected",
    "bought",
  ];
  return allowed.includes(value as NonNullable<ListingDetail["manual"]["decisionStage"]>)
    ? (value as NonNullable<ListingDetail["manual"]["decisionStage"]>)
    : undefined;
}

export function formatContactEvent(event: ListingDetail["contactHistory"][number]) {
  const dateLabel = new Date(event.occurredAt).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = [`${dateLabel}: ${contactEventTypeLabel(event.eventType)}`];

  if (event.title) {
    parts.push(event.title);
  }

  if (event.contactName) {
    parts.push(`kontakt ${event.contactName}`);
  }

  if (typeof event.amount === "number") {
    parts.push(formatPln(event.amount));
  }

  if (event.notes) {
    parts.push(event.notes);
  }

  return parts.join(" | ");
}

export function contactEventTypeLabel(type: ListingContactEventType) {
  return (
    {
      call: "Telefon",
      message: "Wiadomosc",
      email: "E-mail",
      meeting: "Spotkanie",
      viewing_note: "Notatka po ogladaniu",
      negotiation: "Negocjacje",
      status_change: "Zmiana statusu",
      other: "Inne",
    } satisfies Record<ListingContactEventType, string>
  )[type];
}
