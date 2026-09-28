// 支払い日・集計期間まわりの日付計算。
// カレンダー表示（支払日リングとその期間ラベル）で使う。
import { LAST_DAY_OF_MONTH, type Platform, type Weekday } from '../types'
import { dayLabel } from './labels'

function daysInMonth(year: number, month: number): number {
  // month: 0-11
  return new Date(year, month + 1, 0).getDate()
}

/** monthly の日付指定（LAST_DAY_OF_MONTH含む）を、指定した年月の実日付に解決する */
function resolveMonthDay(year: number, month: number, day: number): number {
  if (day === LAST_DAY_OF_MONTH) return daysInMonth(year, month)
  return Math.min(day, daysInMonth(year, month))
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** その日が支払い日かどうか（日払いは対象外＝毎日払いのため個別にはマークしない） */
export function isPaymentDate(platform: Platform, date: Date): boolean {
  const pd = platform.paymentDay
  if (pd.type === 'weekly') {
    return pd.weekdays.includes(date.getDay() as Weekday)
  }
  if (pd.type === 'monthly') {
    const resolved = pd.days.map((d) => resolveMonthDay(date.getFullYear(), date.getMonth(), d))
    return resolved.includes(date.getDate())
  }
  return false
}

/** 直近の weekday の日付を、endDate 以前（含む）から遡って探す */
function mostRecentWeekday(before: Date, weekday: Weekday): Date {
  const d = new Date(before)
  const diff = (d.getDay() - weekday + 7) % 7
  d.setDate(d.getDate() - diff)
  return d
}

/**
 * 支払日から見た「直近の集計期間」を推定し、表示ラベルを返す。
 * 例：「9/13〜9/20」。日払いは期間の概念が薄いため呼び出し側で対象外にする。
 */
export function settlementRangeLabel(platform: Platform, paymentDate: Date): string | null {
  const sp = platform.settlementPeriod
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  if (sp.type === 'weekly') {
    const end = mostRecentWeekday(paymentDate, sp.range.endWeekday)
    const start = mostRecentWeekday(end, sp.range.startWeekday)
    return `${fmt(start)}〜${fmt(end)}`
  }

  if (sp.type === 'monthly') {
    // 各期間について、締め日が支払日以前で最も近いものを採用する
    let best: { start: Date; end: Date } | null = null
    for (const r of sp.ranges) {
      for (const offset of [0, -1]) {
        const endMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + offset, 1)
        const endDay = resolveMonthDay(endMonth.getFullYear(), endMonth.getMonth(), r.endDay)
        const end = new Date(endMonth.getFullYear(), endMonth.getMonth(), endDay)
        if (end > paymentDate) continue
        // start は end と同じ、または前の月のどちらか近い方
        const startCandidates: Date[] = [0, -1].map((so) => {
          const startMonth = new Date(end.getFullYear(), end.getMonth() + so, 1)
          const startDay = resolveMonthDay(startMonth.getFullYear(), startMonth.getMonth(), r.startDay)
          return new Date(startMonth.getFullYear(), startMonth.getMonth(), startDay)
        })
        const start = startCandidates.filter((s) => s <= end).sort((a, b) => b.getTime() - a.getTime())[0]
        if (!start) continue
        if (!best || end > best.end) best = { start, end }
      }
    }
    if (!best) return null
    return `${fmt(best.start)}〜${fmt(best.end)}`
  }

  return null
}

export { ymd, resolveMonthDay, dayLabel }
