"use client";

import { useState, type FormEvent } from "react";

import { bedTitle, formatTime, type Bed, type BedRegistry, type Reading } from "@/lib/dashboard-data";

import { ReadingTiles } from "./readings-view";

const INPUT_CLASS = "w-full bg-gray-700 p-3 rounded text-white outline-none focus:ring-2 focus:ring-green-500";

export default function BedsView({
  beds,
  latestByBed,
  registrySource,
  onAdd,
  onRemove,
  onViewHistory,
}: {
  beds: Bed[];
  latestByBed: Record<string, Reading>;
  registrySource: BedRegistry["source"] | null;
  onAdd: (input: { bedId: string; name: string; location: string }) => Promise<string | null>;
  onRemove: (bedId: string) => Promise<string | null>;
  onViewHistory: (bedId: string) => void;
}) {
  const [bedId, setBedId] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const error = await onAdd({ bedId, name, location });
    setSaving(false);
    setFormError(error);
    if (!error) {
      setBedId("");
      setName("");
      setLocation("");
    }
  };

  const handleRemove = async (id: string) => {
    const error = await onRemove(id);
    setRemoveError(error);
    setConfirmingRemoval(null);
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit} className="p-6 rounded-lg shadow-lg bg-gray-800">
        <h2 className="text-xl font-semibold mb-4">Add a bed to monitor</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
          <div>
            <label htmlFor="bed-id" className="block text-sm text-gray-400 mb-1">
              Bed ID
            </label>
            <input
              id="bed-id"
              value={bedId}
              onChange={(event) => {
                setBedId(event.target.value);
                setFormError(null);
              }}
              placeholder="e.g. 2"
              maxLength={50}
              required
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="bed-name" className="block text-sm text-gray-400 mb-1">
              Name (optional)
            </label>
            <input
              id="bed-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. North bed"
              maxLength={80}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="bed-location" className="block text-sm text-gray-400 mb-1">
              Location (optional)
            </label>
            <input
              id="bed-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Greenhouse A"
              maxLength={80}
              className={INPUT_CLASS}
            />
          </div>

          <button
            type="submit"
            disabled={saving || registrySource === null}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-60 text-gray-900 font-bold p-3 rounded cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? "Adding..." : "Add bed"}
          </button>
        </div>

        {formError && (
          <p role="alert" className="text-sm text-red-400 mt-4">
            {formError}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-4">
          Use the same Bed ID that the bed&apos;s ESP32 sends with its readings. The bed shows its data here as
          soon as the first reading arrives.
          {registrySource === "local" &&
            " Added beds are currently saved in this browser only; create the vermiculture_beds table (see README) to share them across devices."}
        </p>
      </form>

      {removeError && (
        <p role="alert" className="text-red-400">
          {removeError}
        </p>
      )}

      {registrySource === null ? (
        <p>Loading beds...</p>
      ) : beds.length === 0 ? (
        <p>No beds yet. Add a bed above, or wait for the first reading from an ESP32.</p>
      ) : (
        beds.map((bed) => {
          const reading = latestByBed[bed.id];
          return (
            <div
              key={bed.id}
              className={`p-6 rounded-lg shadow-lg border-l-8 ${
                reading ? "border-green-500 bg-gray-800" : "border-gray-600 bg-gray-800/50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Bed ID: {bedTitle(bed.id, bed.name)}</h2>
                  {bed.location && <p className="text-sm text-gray-400">{bed.location}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onViewHistory(bed.id)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer"
                  >
                    View history
                  </button>

                  {bed.registered &&
                    (confirmingRemoval === bed.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRemove(bed.id)}
                          className="bg-red-500 hover:bg-red-400 text-gray-900 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer"
                        >
                          Confirm remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingRemoval(null)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingRemoval(bed.id)}
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    ))}
                </div>
              </div>

              {reading ? (
                <>
                  <ReadingTiles reading={reading} />
                  <p className="text-xs text-gray-500 mt-4">Last reading: {formatTime(reading.created_at)}</p>
                </>
              ) : (
                <p className="text-gray-400">Waiting for data from the ESP32...</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
