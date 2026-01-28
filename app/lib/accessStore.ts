"use client";

export type SavedAccess = {
  token: string;
  createdAt: string; // ISO
  lastSeenAt?: string; // ISO
};

export const LS_KEY = "pixwa_accesses_v1";

export function loadAccesses(): SavedAccess[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x) => x && typeof x.token === "string" && typeof x.createdAt === "string"
    );
  } catch {
    return [];
  }
}

export function saveAll(list: SavedAccess[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 50)));
}

export function saveAccess(token: string) {
  const now = new Date().toISOString();
  const list = loadAccesses();

  const existingIdx = list.findIndex((x) => x.token === token);
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], lastSeenAt: now };
  } else {
    list.unshift({ token, createdAt: now, lastSeenAt: now });
  }

  saveAll(list);
}
