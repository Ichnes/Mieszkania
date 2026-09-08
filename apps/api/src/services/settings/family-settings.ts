import {
  createDefaultFamilySettings,
  createDefaultSearchContract,
  type FamilySettings,
} from "@mieszkania/shared";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { storageRoot } from "../../config";
import { withDb } from "../../db";
import { geocodeListing } from "../geography/geocoding";

const SETTINGS_KEY = "family-settings";
export async function getFamilySettings(): Promise<FamilySettings> {
  return withDb(async (db) => {
    const result = await db.query<{ value: FamilySettings }>(
      `select value from app_settings where key = $1 limit 1`,
      [SETTINGS_KEY],
    );

    const localPath = join(storageRoot, "settings", "family-settings.json");
    const stored =
      result.rows[0]?.value ??
      (existsSync(localPath)
        ? (JSON.parse(readFileSync(localPath, "utf8")) as FamilySettings)
        : undefined);
    const merged = mergeSettings(stored);
    const hydrated = await ensureWorkplaceCoordinates(merged);
    const shouldPersistHydrated =
      !result.rows[0]?.value ||
      Boolean(stored && ("weights" in stored || "maxWeightTotal" in stored)) ||
      !existsSync(localPath) ||
      hasMissingWorkplaceCoordinates(stored?.workplaces) ||
      hasSuspiciousWorkplaceCoordinates(stored?.workplaces) ||
      JSON.stringify(stored?.workplaces) !== JSON.stringify(hydrated.workplaces);

    if (shouldPersistHydrated) {
      await persistFamilySettings(hydrated);
    }

    return hydrated;
  });
}

export async function updateFamilySettings(input: FamilySettings): Promise<FamilySettings> {
  const validated = validateAndNormalizeSettings(input);
  const geocoded = await geocodeWorkplaces(validated);
  await persistFamilySettings(geocoded);
  return geocoded;
}

export function mergeSettings(stored?: Partial<FamilySettings>) {
  const defaults = createDefaultFamilySettings();
  const settings: FamilySettings = {
    financing: stored?.financing ?? defaults.financing,
    workplaces: stored?.workplaces ?? defaults.workplaces,
    searchContract: normalizeSearchContract(stored?.searchContract, defaults.searchContract),
    dreamProfile: normalizeDreamProfile(stored?.dreamProfile, defaults.dreamProfile),
  };

  return validateAndNormalizeSettings(settings);
}

function validateAndNormalizeSettings(input: FamilySettings): FamilySettings {
  const downPayment = input.financing?.downPayment;
  const normalized: FamilySettings = {
    financing: {
      downPayment:
        typeof downPayment === "number" && Number.isFinite(downPayment)
          ? Math.max(0, Math.round(downPayment))
          : createDefaultFamilySettings().financing!.downPayment,
    },
    workplaces: input.workplaces.slice(0, 6).map((workplace, index) =>
      normalizeKnownWorkplace({
        key: workplace.key || `workplace-${index + 1}`,
        label: workplace.label || `Miejsce ${index + 1}`,
        address: workplace.address,
        latitude: workplace.latitude,
        longitude: workplace.longitude,
      }),
    ),
    searchContract: normalizeSearchContract(input.searchContract),
    dreamProfile: normalizeDreamProfile(input.dreamProfile),
  };

  return normalized;
}

function normalizeSearchContract(
  stored?: Partial<FamilySettings["searchContract"]>,
  defaults = createDefaultSearchContract(),
): FamilySettings["searchContract"] {
  const city = stored?.city?.trim() || defaults.city;
  const minPrice = Math.max(0, Number(stored?.minPrice ?? defaults.minPrice) || defaults.minPrice);
  const maxPrice = Math.max(
    minPrice,
    Number(stored?.maxPrice ?? defaults.maxPrice) || defaults.maxPrice,
  );
  const minArea = Math.max(0, Number(stored?.minArea ?? defaults.minArea) || defaults.minArea);
  const roomsMin = Math.max(
    1,
    Math.floor(Number(stored?.roomsMin ?? defaults.roomsMin) || defaults.roomsMin),
  );

  return {
    city,
    minPrice,
    maxPrice,
    minArea,
    roomsMin,
  };
}

export function normalizeDreamProfile(
  stored?: Partial<FamilySettings["dreamProfile"]>,
  defaults = createDefaultFamilySettings().dreamProfile,
): FamilySettings["dreamProfile"] {
  const label = stored?.label?.trim() || defaults.label;
  const preferredDistricts = [
    ...new Set(
      (stored?.preferredDistricts ?? defaults.preferredDistricts)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].slice(0, 50);
  const minArea = Math.max(0, Number(stored?.minArea ?? defaults.minArea) || defaults.minArea);
  const maxArea = Math.max(
    minArea,
    Number(stored?.maxArea ?? defaults.maxArea) || defaults.maxArea,
  );
  const minRooms = Math.max(
    0,
    Math.floor(Number(stored?.minRooms ?? defaults.minRooms) || defaults.minRooms),
  );
  const maxPrice = Math.max(0, Number(stored?.maxPrice ?? defaults.maxPrice) || defaults.maxPrice);
  const maxPricePerSqm = Math.max(
    0,
    Number(stored?.maxPricePerSqm ?? defaults.maxPricePerSqm) || defaults.maxPricePerSqm,
  );
  const maxMetroDistanceMeters = Math.max(
    0,
    Number(stored?.maxMetroDistanceMeters ?? defaults.maxMetroDistanceMeters) ||
      defaults.maxMetroDistanceMeters,
  );

  return {
    label,
    preferredDistricts,
    minArea,
    maxArea,
    minRooms,
    maxPrice,
    maxPricePerSqm,
    maxMetroDistanceMeters,
    requiresGarage: Boolean(stored?.requiresGarage ?? defaults.requiresGarage),
    prefersBalcony: Boolean(stored?.prefersBalcony ?? defaults.prefersBalcony),
  };
}

async function geocodeWorkplaces(settings: FamilySettings, force = false) {
  const workplaces = await Promise.all(
    settings.workplaces.map(async (workplace) => {
      if (!workplace.address.trim()) return workplace;
      const normalizedKnown = normalizeKnownWorkplace(workplace);
      if (normalizedKnown.latitude && normalizedKnown.longitude) {
        return normalizedKnown;
      }

      if (!force && workplace.latitude && workplace.longitude) {
        return workplace;
      }

      const geocoded = await geocodeListing({
        city: "Warszawa",
        addressText: workplace.address,
      });

      return geocoded
        ? normalizeKnownWorkplace({
            ...workplace,
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
          })
        : normalizeKnownWorkplace(workplace);
    }),
  );

  return { ...settings, workplaces };
}

async function ensureWorkplaceCoordinates(settings: FamilySettings) {
  if (
    !hasMissingWorkplaceCoordinates(settings.workplaces) &&
    !hasSuspiciousWorkplaceCoordinates(settings.workplaces)
  ) {
    return settings;
  }

  return geocodeWorkplaces(settings, true);
}

function hasMissingWorkplaceCoordinates(workplaces?: FamilySettings["workplaces"]) {
  return (workplaces ?? []).some((workplace) => !workplace.latitude || !workplace.longitude);
}

function hasSuspiciousWorkplaceCoordinates(workplaces?: FamilySettings["workplaces"]) {
  const coordinates = new Set<string>();

  for (const workplace of workplaces ?? []) {
    if (!workplace.latitude || !workplace.longitude) {
      continue;
    }

    const key = `${workplace.latitude.toFixed(4)}:${workplace.longitude.toFixed(4)}`;
    if (coordinates.has(key)) {
      return true;
    }

    coordinates.add(key);
  }

  return false;
}

function normalizeKnownWorkplace(workplace: FamilySettings["workplaces"][number]) {
  return workplace;
}

async function persistFamilySettings(settings: FamilySettings) {
  await withDb((db) =>
    db.query(
      `
        insert into app_settings (key, value, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (key)
        do update set
          value = excluded.value,
          updated_at = now()
      `,
      [SETTINGS_KEY, JSON.stringify(settings)],
    ),
  );
  const directory = join(storageRoot, "settings");
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `family-settings.${crypto.randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(settings, null, 2), "utf8");
  await rename(temporary, join(directory, "family-settings.json"));
}
