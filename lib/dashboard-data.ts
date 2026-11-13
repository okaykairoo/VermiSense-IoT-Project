import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Data model and helpers shared by the dashboard and its Readings, Beds and
 * History views. Everything here runs in the browser.
 */

export const READINGS_TABLE = "vermiculture_readings";
export const BEDS_TABLE = "vermiculture_beds";
export const LOCAL_BEDS_KEY = "vermisense.beds";

/** Readings shown on the Readings tab. */
export const LATEST_COUNT = 5;
/** Recent readings scanned on load to find the beds that are reporting. */
export const RECENT_COUNT = 200;
/** Rows per page on the History tab. */
export const HISTORY_PAGE_SIZE = 20;

export type Reading = {
  id: number | string;
  bed_id: number | string | null;
  temperature: number | null;
  humidity: number | null;
  moisture: number | null;
  pump_state: boolean | null;
  fan_state: boolean | null;
  created_at: string;
};

/** A bed the administrator added by hand. */
export type RegisteredBed = {
  bed_id: string;
  name: string | null;
  location: string | null;
  created_at: string;
};

/** Where added beds are stored: the Supabase table, or this browser as a fallback. */
export type BedRegistry = {
  source: "supabase" | "local";
  beds: RegisteredBed[];
};

/** A bed as listed on the dashboard: added by the admin and/or seen in readings. */
export type Bed = {
  id: string;
  name: string | null;
  location: string | null;
  registered: boolean;
};

export const PERIODS = [
  { id: "all", label: "All time", hours: null },
  { id: "24h", label: "Last 24 hours", hours: 24 },
  { id: "7d", label: "Last 7 days", hours: 24 * 7 },
  { id: "30d", label: "Last 30 days", hours: 24 * 30 },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];

export type HistoryFilter = {
  bed: string; // a bed id, or "all"
  period: PeriodId;
  page: number;
};

export type HistoryResult = {
  key: string;
  bed: string;
  page: number;
  rows: Reading[];
  hasOlder: boolean;
  error: string | null;
};

let cachedClient: { key: string; client: SupabaseClient } | null = null;

/** One Supabase client per page, or `null` when the settings are missing/invalid. */
export function getSupabase(url: string, anonKey: string): SupabaseClient | null {
  if (!url || !anonKey) return null;
  const key = `${url}|${anonKey}`;
  if (cachedClient?.key !== key) {
    try {
      cachedClient = { key, client: createClient(url, anonKey) };
    } catch (error) {
      console.error("Invalid Supabase configuration:", error);
      return null;
    }
  }
  return cachedClient.client;
}

export function bedKey(bedId: Reading["bed_id"] | undefined): string {
  return bedId === null || bedId === undefined ? "" : String(bedId);
}

/** Keeps the newest reading per bed. */
export function mergeLatest(current: Record<string, Reading>, rows: Reading[]): Record<string, Reading> {
  let next = current;
  for (const row of rows) {
    const key = bedKey(row.bed_id);
    if (!key) continue;
    const known = next[key];
    if (!known || Date.parse(row.created_at) > Date.parse(known.created_at)) {
      if (next === current) next = { ...current };
      next[key] = row;
    }
  }
  return next;
}

/** Shows a reading that just arrived at the top of the first History page. */
export function withLiveReading(result: HistoryResult | null, reading: Reading): HistoryResult | null {
  if (!result || result.error || result.page !== 0) return result;
  if (result.bed !== "all" && result.bed !== bedKey(reading.bed_id)) return result;
  if (result.rows.some((row) => row.id === reading.id)) return result;
  const rows = [reading, ...result.rows];
  return {
    ...result,
    rows: rows.slice(0, HISTORY_PAGE_SIZE),
    hasOlder: result.hasOlder || rows.length > HISTORY_PAGE_SIZE,
  };
}

export function toRegisteredBed(value: unknown): RegisteredBed | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const id = bedKey(row.bed_id as Reading["bed_id"]);
  if (!id) return null;
  return {
    bed_id: id,
    name: typeof row.name === "string" && row.name ? row.name : null,
    location: typeof row.location === "string" && row.location ? row.location : null,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
  };
}

export function toRegisteredBeds(values: unknown): RegisteredBed[] {
  if (!Array.isArray(values)) return [];
  return values.map(toRegisteredBed).filter((bed): bed is RegisteredBed => bed !== null);
}

export function readLocalBeds(): RegisteredBed[] {
  try {
    const stored = window.localStorage.getItem(LOCAL_BEDS_KEY);
    return stored ? toRegisteredBeds(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

export function writeLocalBeds(beds: RegisteredBed[]): void {
  try {
    window.localStorage.setItem(LOCAL_BEDS_KEY, JSON.stringify(beds));
  } catch (error) {
    console.error("Could not save beds in this browser:", error);
  }
}

export function formatNumber(value: number | null | undefined, digits?: number): string {
  if (value === null || value === undefined) return "--";
  if (typeof value !== "number") return String(value);
  return digits === undefined ? String(value) : value.toFixed(digits);
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function bedTitle(id: string, name: string | null | undefined): string {
  return name ? `${id} · ${name}` : id;
}
