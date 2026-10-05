"use client";

import { createStore, del, get, set, type UseStore } from "idb-keyval";

/**
 * Conversations with the assistant, kept in this browser per diagram (`local:<draft>` or
 * `cloud:<diagram>`). Here rather than in the editor so a deleted draft takes its conversation
 * with it.
 */

let store: UseStore | null = null;
const conversations = (): UseStore => (store ??= createStore("mogram-assistant", "conversations"));

export async function readConversation<T>(key: string): Promise<T[]> {
  try {
    return (await get<T[]>(key, conversations())) ?? [];
  } catch {
    return [];
  }
}

export async function writeConversation(key: string, messages: readonly unknown[]): Promise<void> {
  try {
    if (messages.length === 0) await del(key, conversations());
    else await set(key, messages, conversations());
  } catch {
    // Storage unavailable (private window): the conversation lasts for this visit.
  }
}

/** A draft saved to an account keeps its conversation under its new name. */
export async function moveConversation(from: string, to: string): Promise<void> {
  try {
    const messages = await get<unknown[]>(from, conversations());
    if (messages === undefined) return;
    await set(to, messages, conversations());
    await del(from, conversations());
  } catch {
    // Storage unavailable: the conversation stays where it was.
  }
}

export async function deleteConversation(key: string): Promise<void> {
  try {
    await del(key, conversations());
  } catch {
    // Nothing to delete, or storage unavailable.
  }
}
