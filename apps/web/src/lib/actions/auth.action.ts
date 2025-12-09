"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";

export async function signOutAction() {
  await auth.api.signOut();
  redirect("/signin");
}

