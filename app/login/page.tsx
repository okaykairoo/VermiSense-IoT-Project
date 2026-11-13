import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white p-10 font-sans flex items-center justify-center">
      <div className="w-full max-w-lg">
        <h1 className="text-4xl font-bold mb-8 text-green-400">VermiSense Dashboard 🌱</h1>

        <div className="p-6 rounded-lg shadow-lg border-l-8 border-green-500 bg-gray-800">
          <h2 className="text-xl font-semibold mb-1">Farm Administrator Login</h2>
          <p className="text-sm text-gray-400 mb-4">Sign in to view and manage the vermiculture beds.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
