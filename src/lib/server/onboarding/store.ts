/**
 * Simple file-based persistence for onboarding records.
 * Replace with DB in production.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { OnboardingRecord } from "./types";

const DATA_DIR = process.env.ONBOARDING_DATA_DIR ?? path.join(process.cwd(), ".data");
const FILE_PATH = path.join(DATA_DIR, "onboarding.json");

let cache: Record<string, OnboardingRecord> | null = null;

async function ensureDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function load(): Promise<Record<string, OnboardingRecord>> {
  if (cache !== null) return cache;
  try {
    const raw = await readFile(FILE_PATH, "utf-8");
    cache = JSON.parse(raw) as Record<string, OnboardingRecord>;
  } catch {
    cache = {};
  }
  return cache;
}

async function save(data: Record<string, OnboardingRecord>): Promise<void> {
  await ensureDir();
  await writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  cache = data;
}

export async function getOnboarding(id: string): Promise<OnboardingRecord | null> {
  const data = await load();
  return data[id] ?? null;
}

export async function setOnboarding(record: OnboardingRecord): Promise<void> {
  const data = await load();
  data[record.id] = { ...record, updatedAt: new Date().toISOString() };
  await save(data);
}

export async function updateOnboarding(
  id: string,
  patch: Partial<Omit<OnboardingRecord, "id" | "createdAt">>
): Promise<OnboardingRecord | null> {
  const data = await load();
  const existing = data[id];
  if (!existing) return null;
  const updated: OnboardingRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  data[id] = updated;
  await save(data);
  return updated;
}

/** List all onboarding records (for dead-letter / ops). */
export async function listOnboarding(): Promise<OnboardingRecord[]> {
  const data = await load();
  return Object.values(data).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Stuck threshold: DEPOSIT_PENDING older than this (ms) can be retried. */
export const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 min

/** List records stuck in DEPOSIT_PENDING (for dead-letter replay). */
export async function listStuckOnboarding(): Promise<OnboardingRecord[]> {
  const all = await listOnboarding();
  const cutoff = Date.now() - STUCK_THRESHOLD_MS;
  return all.filter(
    (r) =>
      (r.state === "DEPOSIT_PENDING" || r.state === "SUBACCOUNT_REQUESTED") &&
      new Date(r.updatedAt).getTime() < cutoff
  );
}
