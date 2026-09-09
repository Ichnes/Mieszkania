import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultSearchContract } from "@mieszkania/shared";
import { buildSearchUrl as maxonUrl } from "./maxon";
import { buildSearchUrl as adresowoUrl } from "./adresowo";
import { buildSearchUrl as noUrl } from "./nieruchomosci-online";
import { buildMorizonSearchUrl } from "./morizon/morizon-parser";
import { GratkaDiscovery } from "./gratka/gratka-discovery";
import { buildSearchUrl as gratkaUrl } from "./gratka/gratka-discovery";
import { buildSearchUrls as otodomUrls } from "./otodom/otodom-discovery";
import { discoverLocationGroups } from "./grouped-discovery";
import { buildSearchUrl as olxUrl } from "./olx/olx-discovery";
import { buildSearchUrl as domiportaUrl } from "./domiporta";

test("single-district and multi-district portals use their own identifiers without changing numeric settings", async () => {
  const contract = {
    ...createDefaultSearchContract(),
    minArea: 53,
    maxPrice: 2800000,
    districts: ["Ochota"],
  };
  assert.equal(
    new URL(olxUrl("warszawa", 1, contract)).searchParams.get("search[district_id]"),
    "355",
  );
  assert.equal(
    new URL(olxUrl("warszawa", 1, { ...contract, districts: ["Praga-Południe"] })).searchParams.get(
      "search[district_id]",
    ),
    "381",
  );
  assert.match(
    decodeURI(noUrl("warszawa", 2, { ...contract, districts: ["Praga-Południe"] })),
    /Warszawa:20571,Praga-Południe:23578,,,900000-2800000,53/,
  );
  const districts = ["Ochota", "Praga-Południe", "Śródmieście", "Wola"];
  const maxon = new URL(maxonUrl("warszawa", 1, { ...contract, districts }));
  assert.deepEqual(
    maxon.searchParams.getAll("Location"),
    districts.map((d) => `MAZOWIECKIE|Warszawa|${d}`),
  );
  const domiporta = new URL(domiportaUrl("warszawa", 2, { ...contract, districts }));
  assert.equal(domiporta.searchParams.get("Localizations[0].Id"), "70026");
  assert.equal(domiporta.searchParams.get("Localizations[3].Id"), "70040");
  assert.equal(domiporta.searchParams.get("Surface.From"), "53");
  assert.equal(domiporta.searchParams.get("Price.To"), "2800000");
  assert.equal(domiporta.searchParams.get("PageNumber"), "2");
  assert.match(
    adresowoUrl("warszawa", 2, { ...contract, districts }),
    /445659_445657_445650_430517_430518\/a53_/,
  );
  assert.match(
    decodeURIComponent(
      otodomUrls("warszawa", 1, { ...contract, districts: ["Praga-Południe", "Praga-Północ"] })[0],
    ),
    /praga--poludnie.*praga--polnoc/,
  );
  const calls: string[] = [];
  const result = await discoverLocationGroups({
    city: "warszawa",
    contract: { ...contract, districts },
    startPage: 2,
    maxPages: 1,
    groupSize: 1,
    fetchReferences: async (page, scope) => {
      assert.equal(page, 2);
      assert.equal(scope.districts!.length, 1);
      calls.push(scope.districts![0]);
      return [];
    },
    enqueue: async () => ({ queued: 0 }),
  });
  assert.deepEqual(calls, districts);
  assert.equal(result.locationGroups, 4);
});

test("district URL builders preserve settings and encode the portal's location syntax", () => {
  const contract = {
    ...createDefaultSearchContract(),
    minArea: 53,
    maxPrice: 2800000,
    districts: ["Ochota", "Praga-Południe", "Śródmieście"],
  };
  for (const [build, prefix] of [
    [buildMorizonSearchUrl, "ps[location]"],
    [gratkaUrl, "location"],
  ] as const) {
    const url = new URL(build("warszawa", 2, contract));
    assert.equal(url.searchParams.get(`${prefix}[identifiers][0][id]`), "119869");
    assert.equal(url.searchParams.get(`${prefix}[identifiers][1][id]`), "115289");
    assert.equal(url.searchParams.get(`${prefix}[identifiers][2][id]`), "118401");
    assert.equal(url.searchParams.get("page"), "2");
    assert.throws(
      () => build("warszawa", 1, { ...contract, districts: [...contract.districts, "Bielany"] }),
      /3 dzielnice/,
    );
  }
  const urls = otodomUrls("warszawa", 1, {
    ...contract,
    districts: ["Bielany", "Mokotów", "Ochota"],
  });
  assert.equal(urls.length, 1);
  const url = new URL(urls[0]);
  assert.ok(url.pathname.endsWith("/wiele-lokalizacji"));
  assert.equal(
    url.searchParams.get("locations"),
    "[mazowieckie/warszawa/warszawa/warszawa/bielany,mazowieckie/warszawa/warszawa/warszawa/mokotow,mazowieckie/warszawa/warszawa/warszawa/ochota]",
  );
  assert.equal(url.searchParams.get("roomsNumber"), "[THREE,FOUR,FIVE,SIX_OR_MORE]");
  assert.equal(url.searchParams.get("areaMin"), "53");
  assert.equal(url.searchParams.get("priceMax"), "2800000");
  assert.equal(url.searchParams.has("page"), false);
  assert.equal(
    new URL(otodomUrls("warszawa", 2, { ...contract, districts: [] })[0]).searchParams.has(
      "locations",
    ),
    false,
  );
});

test("location groups run sequentially, reset pagination, deduplicate and continue after a group's end or failure", async () => {
  const calls: Array<[string[], number]> = [];
  const queued: string[] = [];
  let active = false;
  const result = await discoverLocationGroups({
    city: "warszawa",
    startPage: 1,
    maxPages: 3,
    contract: {
      ...createDefaultSearchContract(),
      districts: ["Ochota", "Praga-Południe", "Śródmieście", "Bielany", "Mokotów", "Wola", "Ursus"],
    },
    fetchReferences: async (page, contract) => {
      assert.equal(active, false);
      active = true;
      await Promise.resolve();
      active = false;
      const districts = contract.districts!;
      calls.push([districts, page]);
      if (districts[0] === "Ochota" && page === 2) throw new Error("HTTP 404: end");
      if (districts[0] === "Bielany" && page === 3) throw new Error("HTTP 503: unavailable");
      const id = page === 1 ? "shared" : `${districts[0]}-${page}`;
      return [{ externalId: id, url: `https://example.com/${id}` }];
    },
    enqueue: async (refs) => {
      queued.push(...refs.map((ref) => ref.externalId));
      return { queued: refs.length };
    },
  });
  assert.deepEqual(
    calls.map(([districts, page]) => [districts.length, page]),
    [
      [3, 1],
      [3, 2],
      [3, 1],
      [3, 2],
      [3, 3],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
  );
  assert.equal(queued.filter((id) => id === "shared").length, 1);
  assert.ok(queued.includes("Ursus-3"));
  assert.equal(result.locationGroups, 3);
  assert.equal(result.discovered, queued.length);
  assert.match(result.error!, /503/);
  assert.doesNotMatch(result.error!, /404/);
});

test("portal URLs use the current area, prices and room count instead of historical limits", () => {
  const contract = {
    ...createDefaultSearchContract(),
    minArea: 53,
    minPrice: 700000,
    maxPrice: 2800000,
    roomsMin: 2,
  };
  const maxon = new URL(maxonUrl("warszawa", 2, contract));
  assert.equal(maxon.searchParams.get("AreaFrom"), "53");
  assert.equal(maxon.searchParams.get("PriceTotalPLNTo"), "2800000");
  assert.equal(maxon.searchParams.get("PriceTotalPLNFrom"), "700000");
  assert.equal(maxon.searchParams.get("RoomsCountFrom"), "2");
  const morizon = new URL(buildMorizonSearchUrl("warszawa", 2, contract));
  assert.equal(morizon.searchParams.get("ps[living_area_from]"), "53");
  assert.equal(morizon.searchParams.get("ps[price_to]"), "2800000");
  assert.equal(morizon.searchParams.get("ps[number_of_rooms_from]"), "2");
  assert.match(noUrl("warszawa", 1, contract), /700000-2800000,53,,,,,,2,/);
  assert.match(adresowoUrl("warszawa", 2, contract), /a53_fp2p3p4p5p6uz_l2od_p70-280/);
});

test("Gratka omits page=1, preserves settings and reports an HTTP failure instead of zero results", async () => {
  const urls: string[] = [];
  const discovery = new GratkaDiscovery({
    fetchListing: async (url, options) => {
      urls.push(url);
      assert.equal(options?.timeoutMs, 15000);
      return { html: '<a href="/nieruchomosci/test/ob/123">Offer</a>', statusCode: 200 };
    },
  });
  const result = await discovery.discoverListingUrls({
    city: "warszawa",
    pages: 2,
    contract: { ...createDefaultSearchContract(), minArea: 53, maxPrice: 2800000 },
  });
  assert.equal(result.length, 1);
  assert.equal(new URL(urls[0]).searchParams.has("page"), false);
  assert.equal(new URL(urls[1]).searchParams.get("page"), "2");
  assert.equal(new URL(urls[0]).searchParams.get("powierzchnia-w-m2:min"), "53");
  assert.equal(new URL(urls[0]).searchParams.get("cena-calkowita:max"), "2800000");
  const failed = new GratkaDiscovery({
    fetchListing: async () => ({ html: "Not found", statusCode: 404 }),
  });
  await assert.rejects(failed.discoverListingUrls({ city: "warszawa" }), /HTTP 404/);
});
