import type {
  ListingContactEventType,
  ListingContactStatus,
  ListingDetail,
  ListingSummary,
} from "@mieszkania/shared";
import { formatOptionalPln, formatPln, toDatetimeInputValue } from "../../../shared/lib/format";

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

export function contactStatusDisplay(status?: ListingContactStatus) {
  if (!status) {
    return "-";
  }

  return (
    {
      new: "Nowa",
      contacted: "Po kontakcie",
      negotiating: "W negocjacjach",
      viewing_scheduled: "Oglądanie umówione",
      rejected: "Odrzucone",
      closed: "Zamkniete",
    } satisfies Record<ListingContactStatus, string>
  )[status];
}

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

export function decisionStageDisplay(stage?: ListingSummary["decisionStage"]) {
  if (!stage) {
    return "-";
  }

  return (
    {
      new: "Nowa",
      to_call: "Do telefonu",
      after_call: "Po rozmowie",
      to_viewing: "Do ogladania",
      after_viewing: "Po ogladaniu",
      to_offer: "Do oferty",
      rejected: "Odrzucona",
      bought: "Kupiona",
    } satisfies Record<NonNullable<ListingSummary["decisionStage"]>, string>
  )[stage];
}

export function formatPriceEvent(event: ListingDetail["priceHistory"][number]) {
  const dateLabel = new Date(event.changedAt).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (event.eventType === "created") {
    return `${dateLabel}: dodanie oferty${event.newPriceAmount ? `, cena startowa ${formatPln(event.newPriceAmount)}` : ""}`;
  }

  if (event.eventType === "price_drop") {
    return `${dateLabel}: spadek ceny z ${formatOptionalPln(event.previousPriceAmount)} do ${formatOptionalPln(event.newPriceAmount)}`;
  }

  if (event.eventType === "price_increase") {
    return `${dateLabel}: wzrost ceny z ${formatOptionalPln(event.previousPriceAmount)} do ${formatOptionalPln(event.newPriceAmount)}`;
  }

  if (event.eventType === "relisted") {
    return `${dateLabel}: oferta pojawila sie ponownie${event.newPriceAmount ? `, cena ${formatPln(event.newPriceAmount)}` : ""}`;
  }

  if (event.eventType === "removed") {
    return `${dateLabel}: oferta zniknela z portalu`;
  }

  return `${dateLabel}: ${event.eventType}${event.newPriceAmount ? `, cena ${formatPln(event.newPriceAmount)}` : ""}`;
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
