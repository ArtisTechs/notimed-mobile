import AsyncStorage from "@react-native-async-storage/async-storage";

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
  pendingSync?: boolean;
  localOnly?: boolean;
  clientRequestId?: string;
};

type HistoryListArgs = {
  userId: string;
  type?: HistoryType;
  date?: string;
};

type PendingHistoryRecord = {
  clientRequestId: string;
  localId: string;
  createdAt: string;
  updatedAt: string;
  request: HistoryCreateRequest;
};

const PENDING_QUEUE_KEY = "history:pending:v1";

const cacheKey = (userId: string) => `history:${userId}`;

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function sortHistoryNewest(items: HistoryResponse[]) {
  return items.slice().sort((a, b) => {
    const aKey = String(a.updatedAt || a.createdAt || "");
    const bKey = String(b.updatedAt || b.createdAt || "");
    return bKey.localeCompare(aKey);
  });
}

const HISTORY_STATUS_PRIORITY: Record<HistoryStatus, number> = {
  MISSED: 0,
  SKIPPED: 1,
  COMPLETED: 2,
};

function dedupeHistoryByRequest(items: HistoryResponse[]) {
  const byKey = new Map<string, HistoryResponse>();

  for (const item of sortHistoryNewest(items)) {
    const key = item.clientRequestId
      ? `client:${item.clientRequestId}`
      : `id:${item.id}`;

    if (!byKey.has(key)) {
      byKey.set(key, item);
    }
  }

  return sortHistoryNewest(Array.from(byKey.values()));
}

function buildHistorySlotKey(item: HistoryResponse) {
  return [
    item.userId,
    item.type,
    item.name.trim().toLowerCase(),
    (item.dose ?? "").trim().toLowerCase(),
    item.date,
    item.time ?? "",
  ].join("|");
}

function preferHistoryItem(
  current: HistoryResponse,
  candidate: HistoryResponse,
) {
  const currentPriority = HISTORY_STATUS_PRIORITY[current.status] ?? -1;
  const candidatePriority = HISTORY_STATUS_PRIORITY[candidate.status] ?? -1;

  if (candidatePriority > currentPriority) return candidate;
  return current;
}

export function normalizeHistoryItems(items: HistoryResponse[]) {
  const uniqueItems = dedupeHistoryByRequest(items);
  const bySlot = new Map<string, HistoryResponse>();

  for (const item of uniqueItems) {
    const slotKey = buildHistorySlotKey(item);
    const current = bySlot.get(slotKey);

    if (!current) {
      bySlot.set(slotKey, item);
      continue;
    }

    bySlot.set(slotKey, preferHistoryItem(current, item));
  }

  return sortHistoryNewest(Array.from(bySlot.values()));
}

function matchesFilter(item: HistoryResponse, args: HistoryListArgs) {
  if (args.type && item.type !== args.type) return false;
  if (args.date && item.date !== args.date) return false;
  return true;
}

function filterHistory(items: HistoryResponse[], args: HistoryListArgs) {
  return normalizeHistoryItems(items).filter((item) => matchesFilter(item, args));
}

function normalizeRemoteItem(item: HistoryResponse): HistoryResponse {
  return {
    ...item,
    pendingSync: false,
    localOnly: false,
  };
}

function buildLocalId(clientRequestId: string) {
  return `local:${clientRequestId}`;
}

function makeClientRequestId() {
  return `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function toPendingHistoryItem(record: PendingHistoryRecord): HistoryResponse {
  const { request } = record;

  return {
    id: record.localId,
    userId: request.userId,
    name: request.name,
    type: request.type,
    dose: request.dose ?? null,
    date: request.date,
    time: request.time ?? null,
    status: request.status,
    notes: request.notes ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    pendingSync: true,
    localOnly: true,
    clientRequestId: record.clientRequestId,
  };
}

async function readCache(userId: string): Promise<HistoryResponse[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed as HistoryResponse[];
  } catch {
    return [];
  }
}

async function writeCache(userId: string, items: HistoryResponse[]) {
  await AsyncStorage.setItem(
    cacheKey(userId),
    JSON.stringify(normalizeHistoryItems(items)),
  );
}

async function readPendingQueue(): Promise<PendingHistoryRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

async function writePendingQueue(items: PendingHistoryRecord[]) {
  await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(items));
}

async function readPendingForUser(userId: string) {
  const queue = await readPendingQueue();
  return queue.filter((item) => item.request.userId === userId);
}

async function getMergedCachedHistory(userId: string) {
  const [cached, pending] = await Promise.all([
    readCache(userId),
    readPendingForUser(userId),
  ]);

  const pendingItems = pending.map(toPendingHistoryItem);
  const persistedItems = cached.filter((item) => !item.pendingSync);

  return normalizeHistoryItems([...pendingItems, ...persistedItems]);
}

async function cachePendingRecord(record: PendingHistoryRecord) {
  const [queue, cached] = await Promise.all([
    readPendingQueue(),
    readCache(record.request.userId),
  ]);
  const pendingItem = toPendingHistoryItem(record);
  const nextQueue = [record, ...queue.filter((item) => item.localId !== record.localId)];
  const nextCache = normalizeHistoryItems([pendingItem, ...cached]);

  await Promise.all([
    writePendingQueue(nextQueue),
    writeCache(record.request.userId, nextCache),
  ]);

  return pendingItem;
}

async function replacePendingWithRemote(
  record: PendingHistoryRecord,
  remoteItem: HistoryResponse,
) {
  const userId = record.request.userId;
  const [queue, cached] = await Promise.all([readPendingQueue(), readCache(userId)]);
  const normalizedRemote = normalizeRemoteItem(remoteItem);
  const nextQueue = queue.filter(
    (item) => item.clientRequestId !== record.clientRequestId,
  );
  const nextCache = normalizeHistoryItems([
    normalizedRemote,
    ...cached.filter(
      (item) =>
        item.id !== record.localId &&
        item.clientRequestId !== record.clientRequestId,
    ),
  ]);

  await Promise.all([writePendingQueue(nextQueue), writeCache(userId, nextCache)]);

  return normalizedRemote;
}

function createRemote(req: HistoryCreateRequest) {
  return http<HistoryResponse>("/api/history", {
    method: "POST",
    json: req,
  });
}

function fetchRemoteHistory(userId: string) {
  return http<HistoryResponse[]>(`/api/history${qs({ userId })}`);
}

async function refreshUserCache(userId: string) {
  const remote = await fetchRemoteHistory(userId);
  const merged = normalizeHistoryItems([
    ...(await readPendingForUser(userId)).map(toPendingHistoryItem),
    ...remote.map(normalizeRemoteItem),
  ]);

  await writeCache(userId, merged);
  return merged;
}

export const historyApi = {
  async create(req: HistoryCreateRequest) {
    const now = new Date().toISOString();
    const clientRequestId = makeClientRequestId();
    const record: PendingHistoryRecord = {
      clientRequestId,
      localId: buildLocalId(clientRequestId),
      createdAt: now,
      updatedAt: now,
      request: req,
    };

    const optimistic = await cachePendingRecord(record);

    try {
      const created = await createRemote(req);
      return await replacePendingWithRemote(record, created);
    } catch {
      return optimistic;
    }
  },

  async syncPending(userId?: string) {
    const queue = await readPendingQueue();
    const records = userId
      ? queue.filter((item) => item.request.userId === userId)
      : queue;
    const synced: HistoryResponse[] = [];

    for (const record of records) {
      try {
        const created = await createRemote(record.request);
        const syncedItem = await replacePendingWithRemote(record, created);
        synced.push(syncedItem);
      } catch {}
    }

    return synced;
  },

  async getCached(args: HistoryListArgs) {
    const merged = await getMergedCachedHistory(args.userId);
    return filterHistory(merged, args);
  },

  // GET /api/history?userId=...&type=...&date=YYYY-MM-DD
  async list(args: HistoryListArgs) {
    await historyApi.syncPending(args.userId);

    try {
      const merged = await refreshUserCache(args.userId);
      return filterHistory(merged, args);
    } catch {
      return historyApi.getCached(args);
    }
  },
};
