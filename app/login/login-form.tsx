"use client";

import { useActionState } from "react";

import { login, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = { error: null, username: "" };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <label htmlFor="username" className="block text-sm text-gray-400 mb-1">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          defaultValue={state.username}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className="w-full bg-gray-700 p-3 rounded text-white outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm text-gray-400 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full bg-gray-700 p-3 rounded text-white outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <p aria-live="polite" className="text-sm text-red-400 min-h-5">
        {state.error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="bg-green-500 hover:bg-green-400 disabled:opacity-60 text-gray-900 font-bold p-3 rounded cursor-pointer disabled:cursor-not-allowed"
      >
        {pending ? "Signing in..." : "Log in"}
      </button>
    </form>
  );
}
