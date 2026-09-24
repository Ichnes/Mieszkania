import type { ListingContactStatus, ListingSummary } from "@mieszkania/shared";

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
