import { http } from "./http";

export type Role = "PATIENT" | "CAREGIVER" | "ADMIN";

export type MessageResponse = { message: string };

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  password: string;
  role: "PATIENT" | "CAREGIVER";
};

export type UserDetailsResponse = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  role: "PATIENT" | "CAREGIVER";
  inviteCode?: string | null;
  connectedUsers: ConnectedUserResponse[];
};

export type ConnectInviteRequest = {
  caregiverId: string;
  inviteCode: string;
};

export type ConnectInviteResponse = {
  patientId: string;
  caregiverId: string;
};

export type DisconnectRequest = {
  patientId: string;
  caregiverId: string;
};

export type DisconnectResponse = {
  message: string;
};

export type RespondConnectionRequest = {
  patientId: string;
  caregiverId: string;
  accept: boolean;
};

export type ConnectedUserResponse = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  role: "PATIENT" | "CAREGIVER";
  status?: string;
};

export type SendOtpRequest = { email: string };
export type VerifyOtpRequest = { email: string; code: string };

export const authApi = {
  // POST /api/auth/register
  register: (payload: RegisterRequest) =>
    http<MessageResponse>("/api/auth/register", {
      method: "POST",
      json: payload,
    }),

  // POST /api/auth/login  (your controller returns UserDetailsResponse)
  login: (payload: LoginRequest) =>
    http<UserDetailsResponse>("/api/auth/login", {
      method: "POST",
      json: payload,
    }),

  // GET /api/auth/users/{id}
  getUserById: (id: string) =>
    http<UserDetailsResponse>(`/api/auth/users/${id}`, { method: "GET" }),

  // GET /api/auth/users?role=&search=&sortBy=&dir=&page=&size=
  listUsers: (params: {
    role?: string;
    search?: string;
    sortBy?: string;
    dir?: "asc" | "desc";
    page?: number;
    size?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params.role) sp.set("role", params.role);
    if (params.search !== undefined) sp.set("search", params.search);
    if (params.sortBy) sp.set("sortBy", params.sortBy);
    if (params.dir) sp.set("dir", params.dir);
    if (params.page !== undefined) sp.set("page", String(params.page));
    if (params.size !== undefined) sp.set("size", String(params.size));
    return http<any>(`/api/auth/users?${sp.toString()}`, { method: "GET" });
  },

  // POST /api/auth/connect
  connect: (payload: ConnectInviteRequest) =>
    http<ConnectInviteResponse>("/api/auth/connect", {
      method: "POST",
      json: payload,
    }),

  // POST /api/auth/disconnect
  disconnect: (payload: DisconnectRequest) =>
    http<DisconnectResponse>("/api/auth/disconnect", {
      method: "POST",
      json: payload,
    }),

  // POST /api/auth/connect/respond
  respondConnection: (payload: RespondConnectionRequest) =>
    http<MessageResponse>("/api/auth/connect/respond", {
      method: "POST",
      json: payload,
    }),

  // GET /api/auth/connect/requests/{patientId}
  getRequestedConnections: (patientId: string) =>
    http<ConnectedUserResponse[]>(`/api/auth/connect/requests/${patientId}`, {
      method: "GET",
    }),

  // POST /api/auth/otp/send
  sendOtp: (email: string) =>
    http<MessageResponse>("/api/auth/otp/send", {
      method: "POST",
      json: { email } as SendOtpRequest,
    }),

  // POST /api/auth/otp/verify
  verifyOtp: (email: string, code: string) =>
    http<MessageResponse>("/api/auth/otp/verify", {
      method: "POST",
      json: { email, code } as VerifyOtpRequest,
    }),
};
