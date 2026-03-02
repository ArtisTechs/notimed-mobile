// src/services/historyApi.ts
import { http } from "@/services/http";

export type HistoryType = "MEDICATION" | "APPOINTMENT";
export type HistoryStatus = "COMPLETED" | "SKIPPED" | "MISSED";

export type HistoryCreateRequest = {
  userId: string;
  name: string;
  type: HistoryType;
  dose?: string | null;
  date: string; // YYYY-MM-DD
  time?: string | null; // e.g. "08:00"
  status: HistoryStatus;
  notes?: string | null;
};

export type HistoryResponse = {
  id: string;
  userId: string;
  name: string;
  type: HistoryType;
  dose?: string | null;
  date: string; // YYYY-MM-DD
  time?: string | null;
  status: HistoryStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const historyApi = {
  create(req: HistoryCreateRequest) {
    return http<HistoryResponse>("/api/history", {
      method: "POST",
      json: req,
    });
  },

  // GET /api/history?userId=...&type=...&date=YYYY-MM-DD
  list(args: { userId: string; type?: HistoryType; date?: string }) {
    const query = qs({
      userId: args.userId,
      type: args.type,
      date: args.date,
    });

    return http<HistoryResponse[]>(`/api/history${query}`);
  },
};
