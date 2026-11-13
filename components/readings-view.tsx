import { bedKey, bedTitle, formatNumber, formatTime, type Reading } from "@/lib/dashboard-data";

export function ReadingTiles({ reading }: { reading: Reading }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
      <div className="bg-gray-700 p-3 rounded">
        <p className="text-sm text-gray-400">Temperature</p>
        <p className="text-2xl font-bold">{formatNumber(reading.temperature, 1)} °C</p>
      </div>

      <div className="bg-gray-700 p-3 rounded">
        <p className="text-sm text-gray-400">Humidity</p>
        <p className="text-2xl font-bold">{formatNumber(reading.humidity, 1)} %</p>
      </div>

      <div className="bg-gray-700 p-3 rounded">
        <p className="text-sm text-gray-400">Moisture</p>
        <p className="text-2xl font-bold">{formatNumber(reading.moisture)} %</p>
      </div>

      <div className="bg-gray-700 p-3 rounded">
        <p className="text-sm text-gray-400">Water Valve</p>
        <p className={`text-xl font-bold ${reading.pump_state ? "text-blue-400" : "text-gray-300"}`}>
          {reading.pump_state ? "OPEN" : "CLOSED"}
        </p>
      </div>

      <div className="bg-gray-700 p-3 rounded">
        <p className="text-sm text-gray-400">Aeration Fan</p>
        <p className={`text-xl font-bold ${reading.fan_state ? "text-green-400" : "text-gray-300"}`}>
          {reading.fan_state ? "ON" : "OFF"}
        </p>
      </div>
    </div>
  );
}

export default function ReadingsView({
  readings,
  error,
  bedNames,
}: {
  readings: Reading[];
  error: string | null;
  bedNames: Record<string, string | null>;
}) {
  return (
    <div className="grid gap-6">
      {error && <p className="text-red-400">Could not load the readings: {error}</p>}

      {readings.length === 0 ? (
        !error && <p>Waiting for data from the ESP32...</p>
      ) : (
        readings.map((reading, index) => (
          <div
            key={reading.id}
            className={`p-6 rounded-lg shadow-lg border-l-8 ${
              index === 0 ? "border-green-500 bg-gray-800" : "border-gray-600 bg-gray-800/50"
            }`}
          >
            <h2 className="text-xl font-semibold mb-4">
              Bed ID: {bedTitle(bedKey(reading.bed_id), bedNames[bedKey(reading.bed_id)])}{" "}
              {index === 0 && "(Latest)"}
            </h2>

            <ReadingTiles reading={reading} />
            <p className="text-xs text-gray-500 mt-4">Recorded at: {formatTime(reading.created_at)}</p>
          </div>
        ))
      )}
    </div>
  );
}
