import assert from "node:assert/strict";
import test from "node:test";
import { buildUrbanRegistryQuery, mapUrbanRegistryAct } from "./listing-planning-context";

test("builds the official public registry parcel query", () => {
  const parcelId = "146512_8.1108.176/4";
  const query = buildUrbanRegistryQuery(parcelId);
  assert.equal(query.criteria.parcelIdentifier, parcelId);
  assert.equal(query.criteria.publishedActVersions, "CURRENT");
  assert.equal(query.criteria.plansGroup, "ALL");
  assert.ok(query.criteria.planTypeList.includes("LOCAL_SPATIAL_DEVELOPMENT_PLAN"));
  assert.ok(query.criteria.planTypeList.includes("MUNICIPAL_GENERAL_PLAN"));
});

test("maps a registry response to a direct plan details link", () => {
  const result = mapUrbanRegistryAct({
    publishedActId: 1248,
    planType: "LOCAL_SPATIAL_DEVELOPMENT_PLAN",
    planTypeDescription: "miejscowy plan zagospodarowania przestrzennego",
    spatialPlanningActStatus: "prawnie wiążący lub realizowany",
    title: "Plan dla obszaru testowego",
    publishDate: "2026-09-03",
    validFrom: "2026-08-01",
  });
  assert.equal(result?.id, 1248);
  assert.equal(result?.validFrom, "2026-08-01");
  assert.equal(
    result?.detailsUrl,
    "https://rejestr-urbanistyczny.gov.pl/published/details/mpzp/1248",
  );
});

test("maps a municipal general plan to the POG details route", () => {
  const result = mapUrbanRegistryAct({
    publishedActId: 99,
    planType: "MUNICIPAL_GENERAL_PLAN",
    title: "Plan ogólny",
  });
  assert.equal(result?.detailsUrl, "https://rejestr-urbanistyczny.gov.pl/published/details/pog/99");
});
