// localStorage を唯一の永続化先とする、依存ライブラリなしの軽量ストア。
// useSyncExternalStore で React から購読する。
import { useSyncExternalStore } from 'react'
import type { FixedExpense, IncomeEntry, Platform, VariableExpense } from './types'

interface AppState {
  platforms: Platform[]
  entries: IncomeEntry[]
  fixedExpenses: FixedExpense[]
  variableExpenses: VariableExpense[]
  /** 週の起算曜日。0=日曜, 1=月曜 */
  weekStart: 0 | 1
}

const STORAGE_KEY = 'gigwork:v1'

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      return {
        platforms: parsed.platforms ?? [],
        entries: parsed.entries ?? [],
        fixedExpenses: parsed.fixedExpenses ?? [],
        variableExpenses: parsed.variableExpenses ?? [],
        weekStart: parsed.weekStart ?? 1,
      }
    }
  } catch (e) {
    console.error('gigwork: 保存データの読み込みに失敗しました', e)
  }
  return { platforms: [], entries: [], fixedExpenses: [], variableExpenses: [], weekStart: 1 }
}

let state: AppState = loadInitialState()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('gigwork: 保存に失敗しました', e)
  }
}

function emit() {
  persist()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

function update(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  emit()
}

export const actions = {
  upsertPlatform(platform: Platform) {
    const exists = state.platforms.some((p) => p.id === platform.id)
    const platforms = exists
      ? state.platforms.map((p) => (p.id === platform.id ? platform : p))
      : [...state.platforms, platform]
    update({ platforms })
  },
  deletePlatform(id: string) {
    update({
      platforms: state.platforms.filter((p) => p.id !== id),
      entries: state.entries.filter((e) => e.platformId !== id),
    })
  },
  upsertEntry(entry: IncomeEntry) {
    const exists = state.entries.some((e) => e.id === entry.id)
    const entries = exists
      ? state.entries.map((e) => (e.id === entry.id ? entry : e))
      : [...state.entries, entry]
    update({ entries })
  },
  deleteEntry(id: string) {
    update({ entries: state.entries.filter((e) => e.id !== id) })
  },
  upsertFixedExpense(item: FixedExpense) {
    const exists = state.fixedExpenses.some((e) => e.id === item.id)
    const fixedExpenses = exists
      ? state.fixedExpenses.map((e) => (e.id === item.id ? item : e))
      : [...state.fixedExpenses, item]
    update({ fixedExpenses })
  },
  deleteFixedExpense(id: string) {
    update({ fixedExpenses: state.fixedExpenses.filter((e) => e.id !== id) })
  },
  upsertVariableExpense(item: VariableExpense) {
    const exists = state.variableExpenses.some((e) => e.id === item.id)
    const variableExpenses = exists
      ? state.variableExpenses.map((e) => (e.id === item.id ? item : e))
      : [...state.variableExpenses, item]
    update({ variableExpenses })
  },
  deleteVariableExpense(id: string) {
    update({ variableExpenses: state.variableExpenses.filter((e) => e.id !== id) })
  },
  setWeekStart(weekStart: 0 | 1) {
    update({ weekStart })
  },
  /** バックアップ用：全データをJSONとして書き出す */
  exportJSON(): string {
    return JSON.stringify(state, null, 2)
  },
  /** バックアップ復元：内容を検証してから丸ごと置き換える */
  importJSON(json: string) {
    const parsed = JSON.parse(json) as Partial<AppState>
    state = {
      platforms: parsed.platforms ?? [],
      entries: parsed.entries ?? [],
      fixedExpenses: parsed.fixedExpenses ?? [],
      variableExpenses: parsed.variableExpenses ?? [],
      weekStart: parsed.weekStart ?? 1,
    }
    emit()
  },
}

export function genId(): string {
  return crypto.randomUUID()
}
