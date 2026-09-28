import { LAST_DAY_OF_MONTH, type Weekday } from '../types'
import type { DrumRollOption } from '../components/DrumRoll'

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

export function weekdayOptions(): DrumRollOption<Weekday>[] {
  return WEEKDAY_LABELS.map((label, i) => ({ label: `${label}曜`, value: i as Weekday }))
}

/** 1〜31 + 月末 の日付候補（昇順） */
export function dayOptions(): DrumRollOption<number>[] {
  const days: DrumRollOption<number>[] = []
  for (let d = 1; d <= 31; d++) days.push({ label: `${d}日`, value: d })
  days.push({ label: '月末', value: LAST_DAY_OF_MONTH })
  return days
}

export function hourOptions(): DrumRollOption<number>[] {
  return Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), value: h }))
}

export function minuteOptions(): DrumRollOption<number>[] {
  return [0, 15, 30, 45].map((m) => ({ label: String(m).padStart(2, '0'), value: m }))
}

export function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number)
  return { hour: h || 0, minute: m || 0 }
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function dayLabel(day: number): string {
  return day === LAST_DAY_OF_MONTH ? '月末' : `${day}日`
}

export function weekdayLabel(w: Weekday): string {
  return `${WEEKDAY_LABELS[w]}曜`
}

/** 支払い日の複数選択は選んだ順ではなく曜日／日付の昇順で表示する */
export function sortAscending(values: number[]): number[] {
  return [...values].sort((a, b) => a - b)
}
