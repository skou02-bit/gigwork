import { DrumRoll } from './DrumRoll'
import { TimePicker } from './TimePicker'
import type { MonthlyRange, PaymentDayConfig, SettlementPeriodConfig, Weekday } from '../types'
import { dayOptions, weekdayOptions } from '../utils/labels'
import './Picker.css'

interface SettlementPeriodPickerProps {
  paymentDay: PaymentDayConfig
  value: SettlementPeriodConfig
  onChange: (value: SettlementPeriodConfig) => void
}

const TYPE_LABELS: Record<SettlementPeriodConfig['type'], string> = {
  weekly: '毎週',
  monthly: '毎月',
  daily: '毎日',
}

function defaultMonthlyRange(): MonthlyRange {
  return { startDay: 1, startTime: '00:00', endDay: 15, endTime: '23:59' }
}

/**
 * 集計期間（稼働をまとめる単位）の設定。
 * 支払い日が「日払い」の場合は自動的に「毎日」に固定し、型の切り替え自体を表示しない。
 */
export function SettlementPeriodPicker({ paymentDay, value, onChange }: SettlementPeriodPickerProps) {
  const isDailyForced = paymentDay.type === 'daily'

  if (isDailyForced && value.type !== 'daily') {
    // 呼び出し側の初期値が揃っていない場合の保険（通常は親で揃える）
    onChange({ type: 'daily', cutoffTime: '23:59' })
  }

  return (
    <div className="picker-block">
      {!isDailyForced && (
        <div className="segmented">
          {(['weekly', 'monthly', 'daily'] as const).map((t) => (
            <button
              key={t}
              className={`segmented-btn${value.type === t ? ' is-active' : ''}`}
              onClick={() => {
                if (t === 'weekly')
                  onChange({
                    type: 'weekly',
                    range: { startWeekday: 1, startTime: '04:00', endWeekday: 0, endTime: '04:00' },
                  })
                else if (t === 'monthly') onChange({ type: 'monthly', ranges: [defaultMonthlyRange()] })
                else onChange({ type: 'daily', cutoffTime: '23:59' })
              }}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {value.type === 'weekly' && (
        <div className="settlement-weekly">
          <div className="settlement-row">
            <DrumRoll
              label="起算日"
              options={weekdayOptions()}
              value={value.range.startWeekday}
              onChange={(w) => onChange({ type: 'weekly', range: { ...value.range, startWeekday: w } })}
            />
            <TimePicker
              value={value.range.startTime}
              onChange={(t) => onChange({ type: 'weekly', range: { ...value.range, startTime: t } })}
            />
          </div>
          <div className="settlement-arrow">〜</div>
          <div className="settlement-row">
            <DrumRoll
              label="締め日"
              options={weekdayOptions()}
              value={value.range.endWeekday}
              onChange={(w: Weekday) => onChange({ type: 'weekly', range: { ...value.range, endWeekday: w } })}
            />
            <TimePicker
              value={value.range.endTime}
              onChange={(t) => onChange({ type: 'weekly', range: { ...value.range, endTime: t } })}
            />
          </div>
        </div>
      )}

      {value.type === 'monthly' && (
        <div className="settlement-monthly">
          {value.ranges.map((r, i) => (
            <div className="settlement-monthly-range" key={i}>
              <div className="settlement-row">
                <DrumRoll
                  label="起算日"
                  options={dayOptions()}
                  value={r.startDay}
                  onChange={(d) =>
                    onChange({
                      type: 'monthly',
                      ranges: value.ranges.map((rr, ii) => (ii === i ? { ...rr, startDay: d } : rr)),
                    })
                  }
                />
                <TimePicker
                  value={r.startTime}
                  onChange={(t) =>
                    onChange({
                      type: 'monthly',
                      ranges: value.ranges.map((rr, ii) => (ii === i ? { ...rr, startTime: t } : rr)),
                    })
                  }
                />
              </div>
              <div className="settlement-arrow">〜</div>
              <div className="settlement-row">
                <DrumRoll
                  label="締め日"
                  options={dayOptions()}
                  value={r.endDay}
                  onChange={(d) =>
                    onChange({
                      type: 'monthly',
                      ranges: value.ranges.map((rr, ii) => (ii === i ? { ...rr, endDay: d } : rr)),
                    })
                  }
                />
                <TimePicker
                  value={r.endTime}
                  onChange={(t) =>
                    onChange({
                      type: 'monthly',
                      ranges: value.ranges.map((rr, ii) => (ii === i ? { ...rr, endTime: t } : rr)),
                    })
                  }
                />
              </div>
              {value.ranges.length > 1 && (
                <button
                  className="picker-remove-btn"
                  onClick={() =>
                    onChange({ type: 'monthly', ranges: value.ranges.filter((_, ii) => ii !== i) })
                  }
                >
                  この期間を削除
                </button>
              )}
            </div>
          ))}
          <button
            className="picker-add-btn"
            onClick={() => onChange({ type: 'monthly', ranges: [...value.ranges, defaultMonthlyRange()] })}
          >
            期間を追加
          </button>
        </div>
      )}

      {value.type === 'daily' && (
        <TimePicker
          label="締め時刻"
          value={value.cutoffTime}
          onChange={(t) => onChange({ type: 'daily', cutoffTime: t })}
        />
      )}
    </div>
  )
}
