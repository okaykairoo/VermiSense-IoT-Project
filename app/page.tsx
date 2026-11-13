import { Suspense } from "react";

import { verifySession } from "@/lib/session";

import Dashboard from "./dashboard";

/**
 * Main dashboard page.
 *
 * The page itself runs on the server so it can check the farm administrator's
 * login before anything is shown. The interactive dashboard (Readings, Beds and
 * History) lives in `./dashboard.tsx`.
 */
export default function Page() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <ProtectedDashboard />
    </Suspense>
  );
}

async function ProtectedDashboard() {
  // Redirects to /login when there is no valid administrator session.
  const session = await verifySession();

  return (
    <Dashboard
      adminName={session.username}
      // The Supabase settings are only handed to the browser after the login
      // check above, so they are not shipped to visitors who are not signed in.
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
      supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}
    />
  );
}

function DashboardLoading() {
  return (
    <main className="min-h-screen bg-gray-900 text-white p-10 font-sans">
      <h1 className="text-4xl font-bold mb-8 text-green-400">VermiSense Dashboard 🌱</h1>
      <p>Loading dashboard...</p>
    </main>
  );
}
