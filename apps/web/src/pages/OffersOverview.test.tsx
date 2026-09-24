import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { OffersOverview } from "./OffersOverview";
import { warsawMetropolitanRegion } from "@mieszkania/shared";

function model(): Parameters<typeof OffersOverview>[0]["model"] {
  return {
    activeTab: "dashboard",
    region: warsawMetropolitanRegion,
    upcomingViewings: { total: 0, items: [] },
    listingsTotal: 0,
    listingInsights: [],
    hasLoadedListings: false,
    isLoadingListings: false,
    listingsError: null,
    openListing: async () => {},
    setActiveTab: () => {},
    dashboardSection: {
      status: "idle",
      data: null,
      error: null,
      reload: async () => {},
      updateData: () => {},
    },
    viewingsSection: {
      status: "idle",
      data: null,
      error: null,
      reload: async () => {},
      updateData: () => {},
    },
  };
}

test("not-yet-loaded and failed calendar/list never look like empty successful results", () => {
  const input = model();
  const initial = renderToStaticMarkup(<OffersOverview model={input} />);
  assert.match(initial, /Wczytuję kalendarz/);
  assert.doesNotMatch(initial, /Brak zaplanowanych oglądań|0 ofert/);
  input.viewingsSection = {
    ...input.viewingsSection,
    status: "error",
    error: "Kalendarz niedostępny",
  };
  input.listingsError = "Failed";
  const failed = renderToStaticMarkup(<OffersOverview model={input} />);
  assert.match(failed, /Kalendarz niedostępny/);
  assert.match(failed, /Ponów/);
  assert.doesNotMatch(failed, /Brak zaplanowanych oglądań|0 ofert/);
});

test("confirmed empty calendar and filtered zero results have honest empty labels", () => {
  const input = model();
  input.hasLoadedListings = true;
  input.viewingsSection = {
    ...input.viewingsSection,
    status: "ready",
    data: input.upcomingViewings,
  };
  const html = renderToStaticMarkup(<OffersOverview model={input} />);
  assert.match(html, /Brak zaplanowanych oglądań/);
  assert.match(html, /0 ofert w bieżących wynikach/);
});
