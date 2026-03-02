// src/services/medicationsApi.ts
import { http } from "./http";

export type RepeatType = "once" | "daily" | "weekly" | "monthly" | "custom";
export type RepeatUnit = "day" | "week" | "month";

// Backend enum is typically UPPERCASE (MedicationStatus)
// Use these for requests to avoid enum deserialization errors.
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

// Mirrors MedicationUpsertRequest (no createdAt/updatedAt)
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

// Mirrors MedicationResponse (includes id)
export type MedicationResponse = MedicationUpsertRequest & {
  id: string;
};

export type MessageResponse = { message: string };

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

export const medicationsApi = {
  // POST /api/medications
  create: (payload: MedicationUpsertRequest) =>
    http<MedicationResponse>("/api/medications", {
      method: "POST",
      json: payload,
    }),

  // GET /api/medications/{id}
  getById: (id: string) =>
    http<MedicationResponse>(`/api/medications/${id}`, { method: "GET" }),

  // GET /api/medications?userId=
  listByUser: (userId: string) =>
    http<MedicationResponse>(`/api/medications${qs({ userId })}`, {
      method: "GET",
    }).then((x) => x as unknown as MedicationResponse[]),

  // PUT /api/medications/{id}
  update: (id: string, payload: MedicationUpsertRequest) =>
    http<MedicationResponse>(`/api/medications/${id}`, {
      method: "PUT",
      json: payload,
    }),

  // PATCH /api/medications/{id}/status?status=
  updateStatus: (id: string, status: MedicationStatus) =>
    http<MedicationResponse>(`/api/medications/${id}/status${qs({ status })}`, {
      method: "PATCH",
    }),

  // DELETE /api/medications/{id}
  delete: (id: string) =>
    http<MessageResponse>(`/api/medications/${id}`, { method: "DELETE" }),
};
