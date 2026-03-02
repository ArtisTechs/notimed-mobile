// src/services/medicationsApi.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { http } from "./http";

export type RepeatType = "once" | "daily" | "weekly" | "monthly" | "custom";
export type RepeatUnit = "day" | "week" | "month";

// Backend enum is typically UPPERCASE
export type MedicationStatus = "ONGOING" | "COMPLETED";

export type MedicationRepeat = {
  type: RepeatType;
  interval: number;
  unit: RepeatUnit;
  daysOfWeek: string[]; // e.g. ["MON","WED"]
  endDate?: string | null; // YYYY-MM-DD
};

export type MedicationSchedule = {
  time: string; // HH:mm
  reminderOffsetMinutes: number;
};

export type MedicationUpsertRequest = {
  userId: string;
  name: string;
  dose: string;
  startDate: string; // YYYY-MM-DD
  repeat: MedicationRepeat;
  schedule: MedicationSchedule;
  status: MedicationStatus;
  notes?: string | null;
};

export type MedicationResponse = MedicationUpsertRequest & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MessageResponse = { message: string };

const cacheKey = (userId: string) => `medications:${userId}`;

const qs = (
  params: Record<string, string | number | boolean | undefined | null>,
) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
};

async function readCache(userId: string): Promise<MedicationResponse[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MedicationResponse[]) : [];
  } catch {
    return [];
  }
}

async function writeCache(userId: string, items: MedicationResponse[]) {
  await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(items));
}

function upsertById(
  items: MedicationResponse[],
  item: MedicationResponse,
): MedicationResponse[] {
  const idx = items.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...items];
  const next = items.slice();
  next[idx] = item;
  return next;
}

function removeById(items: MedicationResponse[], id: string) {
  return items.filter((x) => x.id !== id);
}

export const medicationsApi = {
  // POST /api/medications
  async create(payload: MedicationUpsertRequest) {
    const created = await http<MedicationResponse>("/api/medications", {
      method: "POST",
      json: payload,
    });

    const current = await readCache(created.userId);
    const next = upsertById(current, created);
    await writeCache(created.userId, next);

    return created;
  },

  // GET /api/medications/{id}
  getById(id: string) {
    return http<MedicationResponse>(`/api/medications/${id}`, {
      method: "GET",
    });
  },

  /**
   * GET /api/medications?userId=
   * Use listByUser(userId) to refresh master cache.
   * Do not build cache from filtered subsets (if you add filters later).
   */
  async listByUser(userId: string) {
    const data = await http<MedicationResponse[]>(
      `/api/medications${qs({ userId })}`,
      { method: "GET" },
    );

    await writeCache(userId, data);
    return data;
  },

  // PUT /api/medications/{id}
  async update(id: string, payload: MedicationUpsertRequest) {
    const updated = await http<MedicationResponse>(`/api/medications/${id}`, {
      method: "PUT",
      json: payload,
    });

    const current = await readCache(updated.userId);
    const next = upsertById(current, updated);
    await writeCache(updated.userId, next);

    return updated;
  },

  // PATCH /api/medications/{id}/status?status=
  async updateStatus(id: string, status: MedicationStatus) {
    const updated = await http<MedicationResponse>(
      `/api/medications/${id}/status${qs({ status })}`,
      { method: "PATCH" },
    );

    const current = await readCache(updated.userId);
    const next = upsertById(current, updated);
    await writeCache(updated.userId, next);

    return updated;
  },

  // DELETE /api/medications/{id}
  async delete(userId: string, id: string) {
    const res = await http<MessageResponse>(`/api/medications/${id}`, {
      method: "DELETE",
    });

    const current = await readCache(userId);
    const next = removeById(current, id);
    await writeCache(userId, next);

    return res;
  },

  async getCached(userId: string) {
    return readCache(userId);
  },

  async clearCache(userId: string) {
    await AsyncStorage.removeItem(cacheKey(userId));
  },
};
