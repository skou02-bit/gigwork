import { useMemo, useState } from 'react'
import { useAppState } from '../store'
import { isPaymentDate, settlementRangeLabel, ymd } from '../utils/schedule'
import { WEEKDAY_LABELS } from '../utils/labels'
import { InputPanel } from './InputPanel'
import './Calendar.css'

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

function buildGrid(year: number, month: number, weekStart: 0 | 1): Date[] {
  const first = startOfMonth(year, month)
  const firstWeekday = first.getDay()
  const leading = (firstWeekday - weekStart + 7) % 7
  const gridStart = new Date(year, month, 1 - leading)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  }
  return days
}

export function Calendar() {
  const { platforms, entries, weekStart } = useAppState()
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const grid = useMemo(() => buildGrid(cursor.getFullYear(), cursor.getMonth(), weekStart), [cursor, weekStart])
  const weekdayHeader = useMemo(() => {
    const labels = [...WEEKDAY_LABELS]
    return [...labels.slice(weekStart), ...labels.slice(0, weekStart)]
  }, [weekStart])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, typeof entries>()
    for (const e of entries) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [entries])

  function platformOf(id: string) {
    return platforms.find((p) => p.id === id)
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
        <div className="calendar-title">
          {cursor.getFullYear()}年 {cursor.getMonth() + 1}月
        </div>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
      </div>

      <div className="calendar-weekdays">
        {weekdayHeader.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {grid.map((date) => {
          const inMonth = date.getMonth() === cursor.getMonth()
          const key = ymd(date)
          const dayEntries = entriesByDate.get(key) ?? []
          const paymentPlatforms = platforms.filter((p) => p.paymentDay.type !== 'daily' && isPaymentDate(p, date))
          const isToday = key === ymd(today)

          return (
            <button
              key={key}
              className={`calendar-cell${inMonth ? '' : ' is-outside'}${isToday ? ' is-today' : ''}`}
              onClick={() => setSelectedDate(key)}
            >
              <div className="calendar-cell-top">
                <span className="calendar-daynum">{date.getDate()}</span>
                {paymentPlatforms.length > 0 && (
                  <span className="calendar-payment-rings">
                    {paymentPlatforms.map((p) => (
                      <span
                        key={p.id}
                        className="calendar-payment-ring"
                        style={{ borderColor: p.color }}
                        title={`${settlementRangeLabel(p, date) ?? ''} ${p.name}支払日`}
                      />
                    ))}
                  </span>
                )}
              </div>
              <div className="calendar-cell-entries">
                {dayEntries.map((e) => {
                  const p = platformOf(e.platformId)
                  return (
                    <div className="calendar-entry" key={e.id}>
                      <span className="calendar-entry-dot" style={{ background: p?.color ?? '#999' }} />
                      <span className="calendar-entry-amount">¥{e.amount.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <InputPanel
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          paymentInfo={platforms
            .filter((p) => p.paymentDay.type !== 'daily' && isPaymentDate(p, new Date(selectedDate)))
            .map((p) => ({ name: p.name, color: p.color, range: settlementRangeLabel(p, new Date(selectedDate)) }))}
        />
      )}
    </div>
  )
}
