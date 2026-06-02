import type { AppData, LastSession } from "./types";

const DB_NAME = "settlement-plate-observation";
const DB_VERSION = 1;
const LAST_SESSION_KEY = "settlement-plate-observation:last-session";
const STORES = ["routes", "stations", "positions", "benchmarks", "rodHistories", "observations", "meta"] as const;
type StoreName = (typeof STORES)[number];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      STORES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "id" });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll<T>(db: IDBDatabase, storeName: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

function replaceAll<T extends { id: string }>(db: IDBDatabase, storeName: StoreName, records: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.clear();
    records.forEach((record) => store.put(record));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function putMeta(db: IDBDatabase, id: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("meta", "readwrite");
    transaction.objectStore("meta").put({ id, value });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function getMeta<T>(db: IDBDatabase, id: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("meta", "readonly");
    const request = transaction.objectStore("meta").get(id);
    request.onsuccess = () => resolve(request.result?.value as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function loadAppData(fallback: AppData): Promise<AppData> {
  if (typeof indexedDB === "undefined") {
    return fallback;
  }

  const db = await openDatabase();
  try {
    const [routes, stations, positions, benchmarks, rodHistories, observations, settings] = await Promise.all([
      getAll<AppData["routes"][number]>(db, "routes"),
      getAll<AppData["stations"][number]>(db, "stations"),
      getAll<AppData["positions"][number]>(db, "positions"),
      getAll<AppData["benchmarks"][number]>(db, "benchmarks"),
      getAll<AppData["rodHistories"][number]>(db, "rodHistories"),
      getAll<AppData["observations"][number]>(db, "observations"),
      getMeta<AppData["settings"]>(db, "settings")
    ]);

    if (!routes.length && !stations.length && !observations.length) {
      return fallback;
    }

    return {
      routes: routes.length ? routes : fallback.routes,
      stations: stations.length ? stations : fallback.stations,
      positions: positions.length ? positions : fallback.positions,
      benchmarks: benchmarks.length ? benchmarks : fallback.benchmarks,
      rodHistories,
      observations,
      settings: settings ?? fallback.settings
    };
  } finally {
    db.close();
  }
}

export async function saveAppData(data: AppData) {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const db = await openDatabase();
  try {
    await Promise.all([
      replaceAll(db, "routes", data.routes),
      replaceAll(db, "stations", data.stations),
      replaceAll(db, "positions", data.positions),
      replaceAll(db, "benchmarks", data.benchmarks),
      replaceAll(db, "rodHistories", data.rodHistories),
      replaceAll(db, "observations", data.observations),
      putMeta(db, "settings", data.settings)
    ]);
  } finally {
    db.close();
  }
}

export function loadLastSession(): LastSession | undefined {
  try {
    const raw = localStorage.getItem(LAST_SESSION_KEY);
    return raw ? (JSON.parse(raw) as LastSession) : undefined;
  } catch {
    return undefined;
  }
}

export function saveLastSession(session: LastSession) {
  localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session));
}
