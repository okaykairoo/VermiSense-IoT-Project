"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [readings, setReadings] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch initial data
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("vermiculture_readings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5); // Get the latest 5 readings

      if (data) setReadings(data);
      if (error) console.error("Error fetching data:", error);
    };

    fetchData();

    // 2. Set up Real-Time Subscription (Listens for new ESP32 inserts)
    const subscription = supabase
      .channel("custom-all-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vermiculture_readings" },
        (payload) => {
          console.log("New reading from ESP32!", payload.new);
          // Add new reading to the top of the list
          setReadings((prev) => [payload.new, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-900 text-white p-10 font-sans">
      <h1 className="text-4xl font-bold mb-8 text-green-400">VermiSense Dashboard 🌱</h1>
      
      <div className="grid gap-6">
        {readings.length === 0 ? (
          <p>Waiting for data from the ESP32...</p>
        ) : (
          readings.map((reading, index) => (
            <div key={reading.id} className={`p-6 rounded-lg shadow-lg border-l-8 ${index === 0 ? 'border-green-500 bg-gray-800' : 'border-gray-600 bg-gray-800/50'}`}>
              <h2 className="text-xl font-semibold mb-4">Bed ID: {reading.bed_id} {index === 0 && "(Latest)"}</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700 p-3 rounded">
                  <p className="text-sm text-gray-400">Temperature</p>
                  <p className="text-2xl font-bold">{reading.temperature?.toFixed(1)} °C</p>
                </div>
                
                <div className="bg-gray-700 p-3 rounded">
                  <p className="text-sm text-gray-400">Moisture</p>
                  <p className="text-2xl font-bold">{reading.moisture} %</p>
                </div>

                <div className="bg-gray-700 p-3 rounded">
                  <p className="text-sm text-gray-400">Water Valve</p>
                  <p className={`text-xl font-bold ${reading.pump_state ? 'text-blue-400' : 'text-gray-300'}`}>
                    {reading.pump_state ? "OPEN" : "CLOSED"}
                  </p>
                </div>

                <div className="bg-gray-700 p-3 rounded">
                  <p className="text-sm text-gray-400">Aeration Fan</p>
                  <p className={`text-xl font-bold ${reading.fan_state ? 'text-green-400' : 'text-gray-300'}`}>
                    {reading.fan_state ? "ON" : "OFF"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">Recorded at: {new Date(reading.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}