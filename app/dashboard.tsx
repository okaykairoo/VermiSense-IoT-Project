"use client";

import { useEffect, useRef, useState } from "react";

import { logout } from "@/app/actions/auth";
import BedsView from "@/components/beds-view";
import HistoryView from "@/components/history-view";
import ReadingsView from "@/components/readings-view";
import {
  BEDS_TABLE,
  HISTORY_PAGE_SIZE,
  LATEST_COUNT,
  PERIODS,
  READINGS_TABLE,
  RECENT_COUNT,
  getSupabase,
  mergeLatest,
  readLocalBeds,
  toRegisteredBed,
  toRegisteredBeds,
  withLiveReading,
  writeLocalBeds,
  type Bed,
  type BedRegistry,
  type HistoryFilter,
  type HistoryResult,
  type Reading,
} from "@/lib/dashboard-data";

type View = "readings" | "beds" | "history";

const VIEWS: { id: View; label: string }[] = [
  { id: "readings", label: "Readings" },
  { id: "beds", label: "Beds" },
  { id: "history", label: "History" },
];

type DashboardProps = {
  adminName: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export default function Dashboard({ adminName, supabaseUrl, supabaseAnonKey }: DashboardProps) {
  const supabase = getSupabase(supabaseUrl, supabaseAnonKey);

  const [view, setView] = useState<View>("readings");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [readingsError, setReadingsError] = useState<string | null>(null);
  const [latestByBed, setLatestByBed] = useState<Record<string, Reading>>({});
  const [registry, setRegistry] = useState<BedRegistry | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>({ bed: "all", period: "all", page: 0 });
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [historyResult, setHistoryResult] = useState<HistoryResult | null>(null);

  // Beds whose most recent reading has already been looked up.
  const checkedBeds = useRef(new Set<string>());

  // 1. Fetch the initial data: recent readings and the beds added by the admin.
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const fetchReadings = async () => {
      const { data, error } = await supabase
        .from(READINGS_TABLE)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(RECENT_COUNT);
      if (cancelled) return;

      if (error) {
        console.error("Error fetching data:", error);
        setReadingsError(error.message);
        return;
      }
      const rows = (data ?? []) as Reading[];
      setReadingsError(null);
      setReadings(rows.slice(0, LATEST_COUNT)); // Get the latest 5 readings
      setLatestByBed((prev) => mergeLatest(prev, rows));
    };

    const fetchBeds = async () => {
      const { data, error } = await supabase
        .from(BEDS_TABLE)
        .select("*")
        .order("created_at", { ascending: true });
      if (cancelled) return;

      if (error) {
        // The beds table has not been created (or is not readable): keep the
        // added beds in this browser instead so the feature still works.
        console.warn(`"${BEDS_TABLE}" is not available, saving beds in this browser:`, error.message);
        setRegistry({ source: "local", beds: readLocalBeds() });
        return;
      }
      setRegistry({ source: "supabase", beds: toRegisteredBeds(data) });
    };

    fetchReadings();
    fetchBeds();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // 2. Set up Real-Time Subscription (Listens for new ESP32 inserts)
  useEffect(() => {
    if (!supabase) return;

    const subscription = supabase
      .channel("custom-all-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: READINGS_TABLE },
        (payload) => {
          console.log("New reading from ESP32!", payload.new);
          const reading = payload.new as Reading;
          // Add new reading to the top of the list
          setReadings((prev) =>
            [reading, ...prev.filter((row) => row.id !== reading.id)].slice(0, LATEST_COUNT)
          );
          setLatestByBed((prev) => mergeLatest(prev, [reading]));
          setHistoryResult((prev) => withLiveReading(prev, reading));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [supabase]);

  // 3. Look up the latest reading of added beds that were not in the recent readings.
  useEffect(() => {
    if (!supabase || !registry) return;
    let cancelled = false;

    for (const bed of registry.beds) {
      if (checkedBeds.current.has(bed.bed_id)) continue;
      checkedBeds.current.add(bed.bed_id);

      supabase
        .from(READINGS_TABLE)
        .select("*")
        .eq("bed_id", bed.bed_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data, error }) => {
          if (cancelled) {
            checkedBeds.current.delete(bed.bed_id);
            return;
          }
          if (error) {
            console.warn(`Could not load readings for bed ${bed.bed_id}:`, error.message);
            return;
          }
          setLatestByBed((prev) => mergeLatest(prev, (data ?? []) as Reading[]));
        });
    }

    return () => {
      cancelled = true;
    };
  }, [supabase, registry]);

  // 4. Load the requested page of past readings while the History tab is open.
  const historyKey = `${historyFilter.bed}|${historyFilter.period}|${historyFilter.page}|${historyRefresh}`;
  const historyLoading = historyResult?.key !== historyKey;

  useEffect(() => {
    if (!supabase || view !== "history") return;
    let cancelled = false;
    const { bed, period, page } = historyFilter;

    const fetchHistory = async () => {
      let query = supabase.from(READINGS_TABLE).select("*");
      if (bed !== "all") query = query.eq("bed_id", bed);
      const hours = PERIODS.find((option) => option.id === period)?.hours;
      if (hours) {
        query = query.gte("created_at", new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());
      }

      // Ask for one extra row to know whether an older page exists.
      const from = page * HISTORY_PAGE_SIZE;
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, from + HISTORY_PAGE_SIZE);
      if (cancelled) return;

      if (error) console.error("Error fetching history:", error);
      const rows = (data ?? []) as Reading[];
      setHistoryResult({
        key: historyKey,
        bed,
        page,
        rows: rows.slice(0, HISTORY_PAGE_SIZE),
        hasOlder: rows.length > HISTORY_PAGE_SIZE,
        error: error ? error.message : null,
      });
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [supabase, view, historyFilter, historyKey]);

  /* ------------------------------- Beds ---------------------------------- */

  const bedsById = new Map<string, Bed>();
  for (const bed of registry?.beds ?? []) {
    bedsById.set(bed.bed_id, { id: bed.bed_id, name: bed.name, location: bed.location, registered: true });
  }
  for (const id of Object.keys(latestByBed)) {
    if (!bedsById.has(id)) bedsById.set(id, { id, name: null, location: null, registered: false });
  }
  const beds = [...bedsById.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  /** Adds a bed to monitor. Returns an error message, or `null` on success. */
  const addBed = async (input: { bedId: string; name: string; location: string }): Promise<string | null> => {
    if (!supabase || !registry) return "The dashboard is still loading. Try again in a moment.";

    const bedId = input.bedId.trim();
    const name = input.name.trim() || null;
    const location = input.location.trim() || null;

    if (!bedId) return "Enter the Bed ID.";
    if (bedId.length > 50) return "The Bed ID is too long (50 characters at most).";
    if (registry.beds.some((bed) => bed.bed_id === bedId)) return `Bed ${bedId} has already been added.`;

    if (registry.source === "local") {
      const beds = [...registry.beds, { bed_id: bedId, name, location, created_at: new Date().toISOString() }];
      writeLocalBeds(beds);
      setRegistry({ source: "local", beds });
      return null;
    }

    const { data, error } = await supabase
      .from(BEDS_TABLE)
      .insert({ bed_id: bedId, name, location })
      .select()
      .single();

    if (error) {
      console.error("Error adding bed:", error);
      return error.code === "23505" ? `Bed ${bedId} has already been added.` : `Could not add the bed: ${error.message}`;
    }
    const saved = toRegisteredBed(data) ?? { bed_id: bedId, name, location, created_at: new Date().toISOString() };
    setRegistry((prev) =>
      prev && prev.source === "supabase"
        ? { source: "supabase", beds: [...prev.beds.filter((bed) => bed.bed_id !== saved.bed_id), saved] }
        : prev
    );
    return null;
  };

  /** Removes a bed the admin added. Returns an error message, or `null` on success. */
  const removeBed = async (bedId: string): Promise<string | null> => {
    if (!supabase || !registry) return "The dashboard is still loading. Try again in a moment.";

    if (registry.source === "local") {
      const beds = registry.beds.filter((bed) => bed.bed_id !== bedId);
      writeLocalBeds(beds);
      setRegistry({ source: "local", beds });
    } else {
      const { data, error } = await supabase.from(BEDS_TABLE).delete().eq("bed_id", bedId).select();
      if (error) {
        console.error("Error removing bed:", error);
        return `Could not remove the bed: ${error.message}`;
      }
      if (!data || data.length === 0) return "Could not remove the bed: no permission to delete it.";
      setRegistry((prev) =>
        prev && prev.source === "supabase"
          ? { source: "supabase", beds: prev.beds.filter((bed) => bed.bed_id !== bedId) }
          : prev
      );
    }
    checkedBeds.current.delete(bedId);
    return null;
  };

  const openBedHistory = (bedId: string) => {
    setHistoryFilter({ bed: bedId, period: "all", page: 0 });
    setView("history");
  };

  const bedNames: Record<string, string | null> = {};
  for (const bed of beds) bedNames[bed.id] = bed.name;

  /* ------------------------------ Layout --------------------------------- */

  return (
    <main className="min-h-screen bg-gray-900 text-white p-10 font-sans">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <h1 className="text-4xl font-bold text-green-400">VermiSense Dashboard 🌱</h1>

        <form action={logout} className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Signed in as {adminName}</span>
          <button
            type="submit"
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm font-semibold cursor-pointer"
          >
            Log out
          </button>
        </form>
      </div>

      <nav aria-label="Dashboard sections" className="flex flex-wrap gap-3 mb-6">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-current={view === id ? "page" : undefined}
            className={`px-5 py-2 rounded font-semibold cursor-pointer ${
              view === id ? "bg-green-500 text-gray-900" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {!supabase ? (
        <p className="text-red-400">
          Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
          .env.local, then restart the server.
        </p>
      ) : view === "readings" ? (
        <ReadingsView readings={readings} error={readingsError} bedNames={bedNames} />
      ) : view === "beds" ? (
        <BedsView
          beds={beds}
          latestByBed={latestByBed}
          registrySource={registry?.source ?? null}
          onAdd={addBed}
          onRemove={removeBed}
          onViewHistory={openBedHistory}
        />
      ) : (
        <HistoryView
          beds={beds}
          bedNames={bedNames}
          filter={historyFilter}
          result={historyLoading ? null : historyResult}
          onFilterChange={setHistoryFilter}
          onRefresh={() => setHistoryRefresh((count) => count + 1)}
        />
      )}
    </main>
  );
}
