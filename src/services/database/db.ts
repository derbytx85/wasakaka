import * as SQLite from "expo-sqlite";
import { SCHEMA_SQL } from "./schema";
import type { Place, Item, Reminder, WeatherCache } from "@/types";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("salgo.db");
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync(SCHEMA_SQL);
  return db;
}

export const PlaceRepo = {
  async getAll(): Promise<Place[]> {
    const d = await getDb();
    return d.getAllAsync<Place>("SELECT * FROM places ORDER BY createdAt DESC");
  },
  async getById(id: number): Promise<Place | undefined> {
    const d = await getDb();
    const rows = await d.getAllAsync<Place>("SELECT * FROM places WHERE id = ?", [id]);
    return rows[0];
  },
  async create(p: Omit<Place, "id" | "createdAt" | "updatedAt">): Promise<number> {
    const d = await getDb();
    const r = await d.runAsync(
      `INSERT INTO places (name, icon, latitude, longitude, radius, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [p.name, p.icon, p.latitude, p.longitude, p.radius, p.enabled ? 1 : 0]
    );
    return r.lastInsertRowId;
  },
  async update(id: number, patch: Partial<Place>): Promise<void> {
    const d = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (k === "id") continue;
      fields.push(`${k} = ?`);
      values.push(k === "enabled" ? (v ? 1 : 0) : v);
    }
    fields.push("updatedAt = datetime('now')");
    values.push(id);
    await d.runAsync(`UPDATE places SET ${fields.join(", ")} WHERE id = ?`, values);
  },
  async remove(id: number): Promise<void> {
    const d = await getDb();
    await d.runAsync("DELETE FROM places WHERE id = ?", [id]);
  },
  async count(): Promise<number> {
    const d = await getDb();
    const r = await d.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM places");
    return r?.c ?? 0;
  },
};

export const ItemRepo = {
  async getByPlace(placeId: number): Promise<Item[]> {
    const d = await getDb();
    return d.getAllAsync<Item>(
      "SELECT * FROM items WHERE placeId = ? ORDER BY priority DESC, createdAt ASC",
      [placeId]
    );
  },
  async create(i: Omit<Item, "id" | "createdAt" | "updatedAt">): Promise<number> {
    const d = await getDb();
    const r = await d.runAsync(
      `INSERT INTO items (placeId, name, icon, priority, enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [i.placeId, i.name, i.icon, i.priority, i.enabled ? 1 : 0]
    );
    return r.lastInsertRowId;
  },
  async update(id: number, patch: Partial<Item>): Promise<void> {
    const d = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (k === "id") continue;
      fields.push(`${k} = ?`);
      values.push(k === "enabled" ? (v ? 1 : 0) : v);
    }
    fields.push("updatedAt = datetime('now')");
    values.push(id);
    await d.runAsync(`UPDATE items SET ${fields.join(", ")} WHERE id = ?`, values);
  },
  async remove(id: number): Promise<void> {
    const d = await getDb();
    await d.runAsync("DELETE FROM items WHERE id = ?", [id]);
  },
  async countByPlace(placeId: number): Promise<number> {
    const d = await getDb();
    const r = await d.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM items WHERE placeId = ?", [placeId]
    );
    return r?.c ?? 0;
  },
};

export const ReminderRepo = {
  async getByPlace(placeId: number): Promise<Reminder | undefined> {
    const d = await getDb();
    const rows = await d.getAllAsync<Reminder>(
      "SELECT * FROM reminders WHERE placeId = ?", [placeId]
    );
    return rows[0];
  },
  async upsert(r: Omit<Reminder, "id" | "createdAt" | "updatedAt">): Promise<void> {
    const d = await getDb();
    await d.runAsync(
      `INSERT INTO reminders (placeId, enabled, weekdays, startTime, endTime)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(placeId) DO UPDATE SET
         enabled = excluded.enabled,
         weekdays = excluded.weekdays,
         startTime = excluded.startTime,
         endTime = excluded.endTime,
         updatedAt = datetime('now')`,
      [r.placeId, r.enabled ? 1 : 0, r.weekdays, r.startTime, r.endTime]
    );
  },
};

export const SettingsRepo = {
  async get(key: string): Promise<string | null> {
    const d = await getDb();
    const r = await d.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?", [key]
    );
    return r?.value ?? null;
  },
  async set(key: string, value: string): Promise<void> {
    const d = await getDb();
    await d.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  },
};

export const EventLogRepo = {
  async log(placeId: number, eventType: string): Promise<void> {
    const d = await getDb();
    await d.runAsync(
      "INSERT INTO event_logs (placeId, eventType) VALUES (?, ?)",
      [placeId, eventType]
    );
  },
};

export const WeatherCacheRepo = {
  async getNearest(lat: number, lon: number): Promise<WeatherCache | undefined> {
    const d = await getDb();
    const rows = await d.getAllAsync<WeatherCache>(
      "SELECT * FROM weather_cache ORDER BY updatedAt DESC LIMIT 1"
    );
    return rows[0];
  },
  async upsert(w: Omit<WeatherCache, "id" | "updatedAt">): Promise<void> {
    const d = await getDb();
    await d.runAsync(
      `INSERT INTO weather_cache (latitude, longitude, temperature, rainProbability, condition, windSpeed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [w.latitude, w.longitude, w.temperature, w.rainProbability, w.condition, w.windSpeed]
    );
  },
};

export const CooldownRepo = {
  async getLastTriggered(placeId: number): Promise<Date | null> {
    const d = await getDb();
    const r = await d.getFirstAsync<{ lastTriggeredAt: string }>(
      "SELECT lastTriggeredAt FROM geofence_cooldowns WHERE placeId = ?",
      [placeId]
    );
    return r ? new Date(r.lastTriggeredAt) : null;
  },
  async setTriggered(placeId: number): Promise<void> {
    const d = await getDb();
    await d.runAsync(
      `INSERT INTO geofence_cooldowns (placeId, lastTriggeredAt) VALUES (?, datetime('now'))
       ON CONFLICT(placeId) DO UPDATE SET lastTriggeredAt = datetime('now')`,
      [placeId]
    );
  },
};