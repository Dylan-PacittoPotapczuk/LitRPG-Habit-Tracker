import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createInitialState } from './game'
import type { AppState } from './types'

interface QuestDB extends DBSchema {
  meta: {
    key: string
    value: AppState
  }
}

const DB_NAME = 'litrpg-habit-tracker'
const STORE = 'meta'
const KEY = 'app-state'

let dbPromise: Promise<IDBPDatabase<QuestDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<QuestDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

export async function loadState(): Promise<AppState> {
  try {
    const db = await getDb()
    const saved = await db.get(STORE, KEY)
    if (saved && saved.version === 1) return saved
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed?.version === 1) return parsed
    }
  } catch {
    /* ignore */
  }
  return createInitialState()
}

export async function saveState(state: AppState): Promise<void> {
  try {
    const db = await getDb()
    await db.put(STORE, state, KEY)
  } catch {
    /* IndexedDB unavailable */
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore quota */
  }
}

export async function clearState(): Promise<void> {
  try {
    const db = await getDb()
    await db.delete(STORE, KEY)
  } catch {
    /* ignore */
  }
  localStorage.removeItem(KEY)
}
