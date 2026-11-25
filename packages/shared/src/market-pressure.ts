import type { BuyerObservation } from "./buyer-market";
import { median } from "./buyer-analysis";

export const pressureFactors = [
  { key: "cutFrequency", label: "Częstotliwość obniżek", weight: 20 },
  { key: "cutSize", label: "Skala obniżek", weight: 15 },
  { key: "persistence", label: "Wolniejsze znikanie ofert", weight: 20 },
  { key: "supply", label: "Zmiana aktywnej podaży", weight: 20 },
  { key: "aged", label: "Udział ofert obserwowanych 90+ dni", weight: 10 },
  { key: "balance", label: "Bilans obniżek i podwyżek", weight: 10 },
  { key: "returns", label: "Potwierdzone ponowne wystawienia", weight: 5 },
] as const;
type Factor = (typeof pressureFactors)[number]["key"];
export type PressureSample = { active: number; values: Record<Factor, number | null> };
export type PressureFrame = {
  day: number;
  groups: Record<string, PressureSample>;
  replayed?: boolean;
};
export const pressureKey = (district = "", rooms = "", size: number | null = null) =>
  JSON.stringify([district, rooms, size]);
export const sizeBand = (area: number) => (area < 60 ? 0 : area < 80 ? 1 : area < 100 ? 2 : 3);
export function measurePressure(
  rows: BuyerObservation[],
  today: number,
  previous?: PressureSample,
): PressureSample {
  const active = rows.filter((r) => r.end === null);
  const exposed = rows.filter((r) => r.end === null || r.end > today - 30);
  const priced = exposed.filter((r) => r.history.some(([d]) => d <= Math.max(today - 30, r.start)));
  const cuts: number[] = [];
  let increases = 0,
    discounted = 0;
  for (const r of priced) {
    let hasCut = false;
    for (let i = 1; i < r.history.length; i++) {
      const [day, p] = r.history[i];
      if (day <= today - 30 || day > today) continue;
      const old = r.history[i - 1][1];
      if (p < old) {
        cuts.push(100 * (1 - p / old));
        hasCut = true;
      } else if (p > old) increases++;
    }
    if (hasCut) discounted++;
  }
  const fresh = exposed.filter((r) => r.start > today - 30);
  return {
    active: active.length,
    values: {
      cutFrequency: priced.length >= 5 ? discounted / priced.length : null,
      cutSize: cuts.length >= 5 ? median(cuts) : null,
      persistence: exposed.length >= 5 ? active.length / exposed.length : null,
      supply:
        previous && previous.active >= 5
          ? (active.length - previous.active) / previous.active
          : null,
      aged:
        active.length >= 5
          ? active.filter((r) => today - r.start >= 90).length / active.length
          : null,
      balance:
        cuts.length + increases >= 5 ? (cuts.length - increases) / (cuts.length + increases) : null,
      returns: fresh.length >= 5 ? fresh.filter((r) => r.relisted).length / fresh.length : null,
    },
  };
}
export function makePressureFrame(
  rows: BuyerObservation[],
  day: number,
  previous?: PressureFrame,
): PressureFrame {
  const buckets = new Map<string, BuyerObservation[]>();
  for (const row of rows) {
    for (const district of ["", row.district])
      for (const rooms of ["", row.rooms >= 5 ? "5+" : String(row.rooms)])
        for (const size of [null, sizeBand(row.area)]) {
          const key = pressureKey(district, rooms, size);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(row);
        }
  }
  const groups: PressureFrame["groups"] = {};
  for (const [key, bucket] of buckets)
    groups[key] = measurePressure(bucket, day, previous?.groups[key]);
  return { day, groups };
}
function evaluatePressure(frames: PressureFrame[], key: string, day: number, required: number) {
  const sample = frames.find((f) => f.day === day)?.groups[key];
  const history = frames.filter(
    (f) =>
      day > f.day &&
      day - f.day <= 360 &&
      (day - f.day) % 30 === 0 &&
      f.groups[key]?.active >= 5 &&
      Object.values(f.groups[key].values).some((value) => value != null),
  );
  const parts = pressureFactors.map((f) => {
    const value = sample?.values[f.key];
    const past = history.flatMap((h) => h.groups[key].values[f.key] ?? []);
    const rank =
      value != null && past.length >= required
        ? (past.filter((v) => v < value).length + past.filter((v) => v === value).length / 2) /
          past.length
        : null;
    return { ...f, rank };
  });
  const coverage = parts.reduce((n, p) => n + (p.rank === null ? 0 : p.weight), 0);
  const valid = !!sample && sample.active >= 5 && coverage >= 70;
  const components = parts.map((p) => ({
    ...p,
    points: valid && p.rank !== null ? ((p.rank - 0.5) * 100 * p.weight) / coverage : null,
  }));
  return {
    score: valid ? 50 + components.reduce((n, p) => n + (p.points ?? 0), 0) : null,
    coverage,
    months: history.length,
    components,
  };
}
export function calibratedPressure(frames: PressureFrame[], key: string, day: number) {
  const daily = evaluatePressure(
    frames.filter((f) => !f.replayed),
    key,
    day,
    6,
  );
  if (daily.score !== null) return { ...daily, preliminary: false };
  const replay = evaluatePressure(
    frames.filter((f) => f.replayed),
    key,
    day,
    2,
  );
  return replay.score !== null
    ? { ...replay, preliminary: true }
    : { ...daily, preliminary: false };
}
