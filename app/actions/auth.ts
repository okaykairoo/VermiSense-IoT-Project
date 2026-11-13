"use server";

import { redirect } from "next/navigation";

import { authenticate } from "@/lib/auth";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = {
  error: string | null;
  /** Echoed back so the field keeps its value after a failed attempt. */
  username: string;
};

const FAILED_LOGIN_DELAY_MS = 750;

export async function login(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    return { error: "Enter your username and password.", username: typeof username === "string" ? username : "" };
  }

  const token = await authenticate(username, password);
  if (!token) {
    // Slow down repeated guesses.
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    return { error: "Incorrect username or password.", username };
  }

  await createSession(token);
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
