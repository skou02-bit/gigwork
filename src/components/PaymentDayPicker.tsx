import { useState } from 'react'
import { DrumRoll } from './DrumRoll'
import type { PaymentDayConfig, Weekday } from '../types'
import { dayLabel, dayOptions, sortAscending, weekdayLabel, weekdayOptions } from '../utils/labels'
import './Picker.css'

interface PaymentDayPickerProps {
  value: PaymentDayConfig
  onChange: (value: PaymentDayConfig) => void
}

const TYPE_LABELS: Record<PaymentDayConfig['type'], string> = {
  monthly: '毎月◯日',
  weekly: '毎週◯曜',
  daily: '日払い',
}

/**
 * 支払い日（お金が届くタイミング）の設定。
 * 毎月◯日／毎週◯曜／日払いの3タイプ。前者2つは複数選択可で、
 * 選んだ順ではなく昇順で表示する。
 */
export function PaymentDayPicker({ value, onChange }: PaymentDayPickerProps) {
  const [pendingDay, setPendingDay] = useState(1)
  const [pendingWeekday, setPendingWeekday] = useState<Weekday>(1)

  return (
    <div className="picker-block">
      <div className="segmented">
        {(['monthly', 'weekly', 'daily'] as const).map((t) => (
          <button
            key={t}
            className={`segmented-btn${value.type === t ? ' is-active' : ''}`}
            onClick={() => {
              if (t === 'monthly') onChange({ type: 'monthly', days: [] })
              else if (t === 'weekly') onChange({ type: 'weekly', weekdays: [] })
              else onChange({ type: 'daily' })
            }}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {value.type === 'monthly' && (
        <div className="picker-multi">
          <div className="picker-multi-input">
            <DrumRoll options={dayOptions()} value={pendingDay} onChange={setPendingDay} />
            <button
              className="picker-add-btn"
              onClick={() => {
                if (value.type !== 'monthly') return
                if (value.days.includes(pendingDay)) return
                onChange({ type: 'monthly', days: sortAscending([...value.days, pendingDay]) })
              }}
            >
              追加
            </button>
          </div>
          <div className="picker-chips">
            {sortAscending(value.days).map((d) => (
              <span
                key={d}
                className="picker-chip"
                onClick={() => onChange({ type: 'monthly', days: value.days.filter((x) => x !== d) })}
              >
                {dayLabel(d)} ×
              </span>
            ))}
            {value.days.length === 0 && <span className="picker-empty">未設定</span>}
          </div>
        </div>
      )}

      {value.type === 'weekly' && (
        <div className="picker-multi">
          <div className="picker-multi-input">
            <DrumRoll options={weekdayOptions()} value={pendingWeekday} onChange={setPendingWeekday} />
            <button
              className="picker-add-btn"
              onClick={() => {
                if (value.type !== 'weekly') return
                if (value.weekdays.includes(pendingWeekday)) return
                onChange({
                  type: 'weekly',
                  weekdays: sortAscending([...value.weekdays, pendingWeekday]) as Weekday[],
                })
              }}
            >
              追加
            </button>
          </div>
          <div className="picker-chips">
            {sortAscending(value.weekdays).map((w) => (
              <span
                key={w}
                className="picker-chip"
                onClick={() =>
                  onChange({ type: 'weekly', weekdays: value.weekdays.filter((x) => x !== w) })
                }
              >
                {weekdayLabel(w as Weekday)} ×
              </span>
            ))}
            {value.weekdays.length === 0 && <span className="picker-empty">未設定</span>}
          </div>
        </div>
      )}

      {value.type === 'daily' && (
        <p className="picker-note">稼働の都度、支払われます。集計期間は自動的に「毎日」になります。</p>
      )}
    </div>
  )
}
