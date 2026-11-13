import {
  PERIODS,
  bedKey,
  bedTitle,
  formatNumber,
  formatTime,
  type Bed,
  type HistoryFilter,
  type HistoryResult,
  type PeriodId,
} from "@/lib/dashboard-data";

const SELECT_CLASS = "block mt-1 bg-gray-700 text-white p-2 rounded outline-none focus:ring-2 focus:ring-green-500";

export default function HistoryView({
  beds,
  bedNames,
  filter,
  result,
  onFilterChange,
  onRefresh,
}: {
  beds: Bed[];
  bedNames: Record<string, string | null>;
  filter: HistoryFilter;
  /** `null` while the requested page is loading. */
  result: HistoryResult | null;
  onFilterChange: (filter: HistoryFilter) => void;
  onRefresh: () => void;
}) {
  const bedOptions = beds.some((bed) => bed.id === filter.bed) || filter.bed === "all"
    ? beds
    : [...beds, { id: filter.bed, name: null, location: null, registered: false }];

  return (
    <div className="grid gap-6">
      <div className="p-6 rounded-lg shadow-lg bg-gray-800 flex flex-wrap items-end gap-5">
        <label className="text-sm text-gray-400">
          Bed
          <select
            value={filter.bed}
            onChange={(event) => onFilterChange({ ...filter, bed: event.target.value, page: 0 })}
            className={SELECT_CLASS}
          >
            <option value="all">All beds</option>
            {bedOptions.map((bed) => (
              <option key={bed.id} value={bed.id}>
                Bed {bedTitle(bed.id, bed.name)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-gray-400">
          Period
          <select
            value={filter.period}
            onChange={(event) =>
              onFilterChange({ ...filter, period: event.target.value as PeriodId, page: 0 })
            }
            className={SELECT_CLASS}
          >
            {PERIODS.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onRefresh}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm font-semibold cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {!result ? (
        <p>Loading history...</p>
      ) : result.error ? (
        <p className="text-red-400">Could not load the history: {result.error}</p>
      ) : result.rows.length === 0 ? (
        <p>No readings found for this selection.</p>
      ) : (
        <div className="rounded-lg shadow-lg bg-gray-800 overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="text-sm text-gray-400 border-b border-gray-700">
                <th className="p-3 font-normal">Recorded at</th>
                <th className="p-3 font-normal">Bed ID</th>
                <th className="p-3 font-normal">Temperature</th>
                <th className="p-3 font-normal">Humidity</th>
                <th className="p-3 font-normal">Moisture</th>
                <th className="p-3 font-normal">Water Valve</th>
                <th className="p-3 font-normal">Aeration Fan</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((reading) => (
                <tr key={reading.id} className="border-b border-gray-700/50 last:border-b-0">
                  <td className="p-3 text-gray-300">{formatTime(reading.created_at)}</td>
                  <td className="p-3">{bedTitle(bedKey(reading.bed_id), bedNames[bedKey(reading.bed_id)])}</td>
                  <td className="p-3 font-bold">{formatNumber(reading.temperature, 1)} °C</td>
                  <td className="p-3 font-bold">{formatNumber(reading.humidity, 1)} %</td>
                  <td className="p-3 font-bold">{formatNumber(reading.moisture)} %</td>
                  <td className={`p-3 font-bold ${reading.pump_state ? "text-blue-400" : "text-gray-300"}`}>
                    {reading.pump_state ? "OPEN" : "CLOSED"}
                  </td>
                  <td className={`p-3 font-bold ${reading.fan_state ? "text-green-400" : "text-gray-300"}`}>
                    {reading.fan_state ? "ON" : "OFF"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!result || filter.page === 0}
          onClick={() => onFilterChange({ ...filter, page: filter.page - 1 })}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm font-semibold cursor-pointer disabled:cursor-not-allowed"
        >
          Newer
        </button>
        <span className="text-sm text-gray-400">Page {filter.page + 1}</span>
        <button
          type="button"
          disabled={!result || !result.hasOlder}
          onClick={() => onFilterChange({ ...filter, page: filter.page + 1 })}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm font-semibold cursor-pointer disabled:cursor-not-allowed"
        >
          Older
        </button>
      </div>
    </div>
  );
}
