import type { Presence } from "@/lib/types";

/** Push a presence patch to one or more devices. Only the keys you pass are
 *  changed; the rest of each device's presence is left alone. Returns the
 *  server's fresh presence snapshot (or null on failure). */
export async function pushPresence(
  deviceIds: string[],
  patch: Partial<Presence>
): Promise<{ version: number; devices: Array<{ id: string; presence: Presence }> } | null> {
  try {
    const res = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceIds, presence: patch }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
