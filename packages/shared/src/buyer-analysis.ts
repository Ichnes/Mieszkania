import type { MarketStatsResponse } from "./index";

export type Observation = NonNullable<MarketStatsResponse["buyerMarket"]>["observations"][number];
export const minSample = 5;
export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}
export function cuts(row: Observation) {
  return row.history.filter(
    ([day, price], i, h) => i > 0 && day >= row.start && price < h[i - 1][1],
  );
}
function activeOn(row: Observation, day: number) {
  return row.start <= day && (row.end === null || row.end > day);
}
function knownPrice(row: Observation, day: number) {
  for (let i = row.history.length - 1; i >= 0; i--)
    if (row.history[i][0] <= day) return row.history[i][1];
}
export function trend(rows: Observation[], today: number, days: number) {
  let index: number | null = null;
  const result: {
    day: number;
    index: number | null;
    pairs: number;
    stock: number;
    drops: number;
  }[] = [];
  for (let day = today - 7 * Math.floor((days - 1) / 7); day <= today; day += 7) {
    const active = rows.filter((r) => activeOn(r, day));
    const changes: number[] = [];
    for (const r of active) {
      if (!activeOn(r, day - 7)) continue;
      const old = knownPrice(r, day - 7),
        current = knownPrice(r, day);
      if (old && current) changes.push(Math.log(current / old));
    }
    const sufficient = changes.length >= minSample;
    index = sufficient
      ? index === null
        ? 100
        : index * Math.exp(changes.reduce((s, v) => s + v, 0) / changes.length)
      : null;
    result.push({
      day,
      index,
      pairs: changes.length,
      stock: active.length,
      drops: rows.reduce((n, r) => n + cuts(r).filter(([d]) => d > day - 7 && d <= day).length, 0),
    });
  }
  return result;
}

// First cut and withdrawal without a cut are competing events. Active listings are censored.
export function exposure(rows: Observation[], today: number, days: number) {
  const cohort = rows.filter((r) => r.start > today - days && r.history[0]?.[0] === r.start);
  const lifetimes = cohort.map((r) => ({
    age: (r.end ?? today) - r.start,
    removed: r.end !== null,
    first: cuts(r)[0]?.[0] === undefined ? null : cuts(r)[0][0] - r.start,
  }));
  let survival = 1,
    waiting = 1,
    discounted = 0;
  const points = [];
  for (let day = 0; day < days; day++) {
    const risk = lifetimes.filter((v) => v.age >= day);
    if (risk.length < minSample) break;
    const beforeCut = risk.filter((v) => v.first === null || v.first >= day);
    if (beforeCut.length) {
      const first = beforeCut.filter((v) => v.first === day).length;
      const withdrawals = beforeCut.filter(
        (v) => v.first === null && v.removed && v.age === day,
      ).length;
      discounted += (waiting * first) / beforeCut.length;
      waiting *= 1 - (first + withdrawals) / beforeCut.length;
    }
    survival *= 1 - risk.filter((v) => v.removed && v.age === day).length / risk.length;
    points.push({ day, active: survival * 100, cut: discounted * 100, risk: risk.length });
  }
  return points;
}

export function compareListings(rows: Observation[], today: number, target?: Observation) {
  const active = rows.filter((r) => r.end === null && r.area > 0 && r.price > 0);
  const groups = new Map<string, Observation[]>();
  const groupKey = (r: Observation) => JSON.stringify([r.district, r.rooms, r.market]);
  for (const row of active) {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return (target ? [target] : active).map((row) => {
    const eligible = (groups.get(groupKey(row)) ?? []).filter(
      (p) =>
        p.id !== row.id &&
        row.district !== "Bez dzielnicy" &&
        row.market &&
        p.area >= row.area * 0.85 &&
        p.area <= row.area * 1.15,
    );
    const similarYear = eligible.filter(
      (p) => row.year && p.year && Math.abs(p.year - row.year) <= 10,
    );
    const local = similarYear.filter(
      (p) => p.neighborhood === row.neighborhood && p.neighborhood !== "Nieustalona",
    );
    const sameFloor = local.filter(
      (p) =>
        row.floor != null &&
        p.floor != null &&
        (row.floor === 0 ? p.floor === 0 : p.floor !== 0 && Math.abs(p.floor - row.floor) <= 2),
    );
    const sameFinish = sameFloor.filter(
      (p) => row.finish && row.finish !== "unknown" && row.finish === p.finish,
    );
    const peers =
      sameFinish.length >= minSample
        ? sameFinish
        : sameFloor.length >= minSample
          ? sameFloor
          : local.length >= minSample
            ? local
            : similarYear.length >= minSample
              ? similarYear
              : eligible;
    const prices = peers.map((p) => p.price / p.area);
    const reference =
      peers.length >= minSample && row.price > 0 && row.area > 0 ? median(prices) : null;
    const delta = reference === null ? null : 100 * (row.price / row.area / reference - 1);
    const reductions = cuts(row);
    const first = row.history[0];
    const net =
      first && first[0] === row.start
        ? 100 * (row.history[row.history.length - 1][1] / first[1] - 1)
        : null;
    const signals = [
      (row.end ?? today) - row.start >= 90 && "Co najmniej 90 dni obserwacji",
      reductions.length >= 2 && "Co najmniej dwie obniżki",
      net !== null && net <= -5 && "Cena spadła łącznie o co najmniej 5%",
      row.relisted && "Potwierdzone ponowne wystawienie",
    ].filter((s): s is string => typeof s === "string");
    const percentileOf = (v: number, values: number[]) =>
      values.length < minSample
        ? null
        : (values.filter((p) => p < v).length + 0.5 * values.filter((p) => p === v).length) /
          values.length;
    const comparableHistory = peers.filter((p) => p.history[0]?.[0] === p.start);
    const age = (row.end ?? today) - row.start;
    const observedLongEnough = age >= 14 || reductions.length > 0;
    const ageRank = percentileOf(
      age,
      eligible.map((p) => today - p.start),
    );
    const negParts = target
      ? [
          {
            weight: 30,
            v: observedLongEnough ? ageRank : null,
          },
          {
            weight: 35,
            v:
              net === null || !observedLongEnough
                ? null
                : reductions.length === 0
                  ? 0
                  : percentileOf(
                      reductions.length,
                      comparableHistory.map((p) => cuts(p).length),
                    ),
          },
          {
            weight: 30,
            v:
              net === null || !observedLongEnough
                ? null
                : net >= 0
                  ? 0
                  : percentileOf(
                      -net,
                      comparableHistory.map(
                        (p) => 100 * (1 - p.history.at(-1)![1] / p.history[0][1]),
                      ),
                    ),
          },
          { weight: 5, v: row.relisted ? 1 : 0 },
        ]
      : [];
    const negotiationCoverage = negParts.reduce((n, p) => n + (p.v === null ? 0 : p.weight), 0);
    return {
      row,
      negotiationCoverage,
      negotiationReason: !observedLongEnough
        ? "Krótka obserwacja"
        : ageRank === null && !reductions.length
          ? "Za mało porównań wieku"
          : null,
      negotiationScore:
        negotiationCoverage >= 65 && (ageRank !== null || reductions.length > 0)
          ? Math.round(
              (negParts.reduce((n, p) => n + (p.v ?? 0) * p.weight, 0) * 100) / negotiationCoverage,
            )
          : null,
      valueScore:
        reference === null
          ? null
          : Math.round(100 * (1 - percentileOf(row.price / row.area, prices)!)),
      delta,
      reference,
      count: peers.length,
      net,
      signals,
      prices: target ? prices : [],
      examples: target
        ? peers
            .slice()
            .sort((a, b) => Math.abs(a.area - row.area) - Math.abs(b.area - row.area))
            .slice(0, 3)
            .map((p) => ({ id: p.id, area: p.area, price: p.price }))
        : [],
      scope:
        peers === sameFinish
          ? "MSI, stan wykończenia, zbliżone piętro i rocznik ±10 lat"
          : peers === sameFloor
            ? "MSI, zbliżone piętro i rocznik ±10 lat"
            : peers === local
              ? "MSI i rocznik ±10 lat"
              : peers === similarYear
                ? "dzielnica i rocznik ±10 lat"
                : "dzielnica, dowolny rocznik",
      percentile:
        reference === null
          ? null
          : (100 * prices.filter((p) => p < row.price / row.area).length) / prices.length,
    };
  });
}
export type OfferComparison = ReturnType<typeof compareListings>[number];
