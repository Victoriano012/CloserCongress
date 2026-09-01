"use server";

import { revalidatePath } from "next/cache";

import { deleteDelegation, saveDelegation, type Delegation } from "@/lib/delegation";

export async function saveDelegationAction(
  input: unknown,
): Promise<{ ok: true; delegation: Delegation } | { ok: false; error: string }> {
  const result = await saveDelegation(input);
  if (result.ok) revalidatePath("/delegate");
  return result;
}

export async function deleteDelegationAction(): Promise<boolean> {
  const deleted = await deleteDelegation();
  if (deleted) revalidatePath("/delegate");
  return deleted;
}
