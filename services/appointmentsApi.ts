import { http } from "@/services/http";

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

export const appointmentsApi = {
  create(req: AppointmentCreateRequest) {
    return http<AppointmentResponse>("/api/appointments", {
      method: "POST",
      json: req,
    });
  },

  getById(id: string) {
    return http<AppointmentResponse>(`/api/appointments/${id}`, {
      method: "GET",
    });
  },

  // /api/appointments?userId=...&date=YYYY-MM-DD (date optional)
  list(userId: string, date?: string) {
    const qs = new URLSearchParams({ userId });
    if (date?.trim()) qs.set("date", date.trim());

    return http<AppointmentResponse[]>(`/api/appointments?${qs.toString()}`, {
      method: "GET",
    });
  },

  update(id: string, req: AppointmentUpdateRequest) {
    return http<AppointmentResponse>(`/api/appointments/${id}`, {
      method: "PUT",
      json: req,
    });
  },

  delete(id: string) {
    return http<MessageResponse>(`/api/appointments/${id}`, {
      method: "DELETE",
    });
  },
};
