// src/services/appointmentsApi.ts
import { http } from "@/services/http";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppointmentResponse = {
  id: string;
  userId: string;
  title: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AppointmentCreateRequest = {
  userId: string;
  title: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  notes?: string | null;
};

export type AppointmentUpdateRequest = {
  title: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  notes?: string | null;
};

export type MessageResponse = { message: string };

const cacheKey = (userId: string) => `appointments:${userId}`;

async function readCache(userId: string): Promise<AppointmentResponse[]> {
  const raw = await AsyncStorage.getItem(cacheKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AppointmentResponse[]) : [];
  } catch {
    return [];
  }
}

async function writeCache(userId: string, items: AppointmentResponse[]) {
  await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(items));
}

function upsertById(
  items: AppointmentResponse[],
  item: AppointmentResponse,
): AppointmentResponse[] {
  const idx = items.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...items];
  const next = items.slice();
  next[idx] = item;
  return next;
}

function removeById(items: AppointmentResponse[], id: string) {
  return items.filter((x) => x.id !== id);
}

export const appointmentsApi = {
  async create(req: AppointmentCreateRequest) {
    const created = await http<AppointmentResponse>("/api/appointments", {
      method: "POST",
      json: req,
    });

    // update cache
    const current = await readCache(created.userId);
    const next = upsertById(current, created);
    await writeCache(created.userId, next);

    return created;
  },

  getById(id: string) {
    return http<AppointmentResponse>(`/api/appointments/${id}`, {
      method: "GET",
    });
  },

  // /api/appointments?userId=...&date=YYYY-MM-DD (date optional)
  async list(userId: string, date?: string) {
    const qs = new URLSearchParams({ userId });
    if (date?.trim()) qs.set("date", date.trim());

    const data = await http<AppointmentResponse[]>(
      `/api/appointments?${qs.toString()}`,
      { method: "GET" },
    );

    // cache stores the latest list fetch (commonly the full list when date is undefined)
    // If you call list(userId, date), it will overwrite cache with that filtered list.
    // So: only call list(userId) for “master cache”, and do date filtering in UI.
    await writeCache(userId, data);

    return data;
  },

  async update(id: string, req: AppointmentUpdateRequest) {
    const updated = await http<AppointmentResponse>(`/api/appointments/${id}`, {
      method: "PUT",
      json: req,
    });

    const current = await readCache(updated.userId);
    const next = upsertById(current, updated);
    await writeCache(updated.userId, next);

    return updated;
  },

  async delete(userId: string, id: string) {
    const res = await http<MessageResponse>(`/api/appointments/${id}`, {
      method: "DELETE",
    });

    const current = await readCache(userId);
    const next = removeById(current, id);
    await writeCache(userId, next);

    return res;
  },

  getCached(userId: string) {
    return readCache(userId);
  },
};
