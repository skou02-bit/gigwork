import { useState } from 'react'
import { actions, genId, useAppState } from '../store'
import type { Platform } from '../types'
import { PaymentDayPicker } from './PaymentDayPicker'
import { SettlementPeriodPicker } from './SettlementPeriodPicker'
import './PlatformSettings.css'

const PRESET_COLORS = ['#2f88c9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#0f2744', '#ec4899', '#14b8a6']

function newPlatform(order: number): Platform {
  return {
    id: genId(),
    name: '',
    color: PRESET_COLORS[order % PRESET_COLORS.length],
    paymentDay: { type: 'weekly', weekdays: [] },
    settlementPeriod: { type: 'weekly', range: { startWeekday: 1, startTime: '04:00', endWeekday: 0, endTime: '04:00' } },
    order,
  }
}

export function PlatformSettings() {
  const { platforms } = useAppState()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Platform | null>(null)

  function startAdd() {
    const p = newPlatform(platforms.length)
    actions.upsertPlatform(p)
    setDraft(p)
    setExpandedId(p.id)
  }

  function startEdit(p: Platform) {
    setDraft(p)
    setExpandedId(expandedId === p.id ? null : p.id)
  }

  function commit(p: Platform) {
    setDraft(p)
    actions.upsertPlatform(p)
  }

  function handlePaymentDayChange(p: Platform, next: Platform['paymentDay']) {
    // 支払い日が「日払い」になったら、集計期間も自動的に「毎日」に固定する
    const settlementPeriod =
      next.type === 'daily'
        ? ({ type: 'daily', cutoffTime: p.settlementPeriod.type === 'daily' ? p.settlementPeriod.cutoffTime : '23:59' } as const)
        : p.settlementPeriod.type === 'daily'
          ? ({ type: 'weekly', range: { startWeekday: 1, startTime: '04:00', endWeekday: 0, endTime: '04:00' } } as const)
          : p.settlementPeriod
    commit({ ...p, paymentDay: next, settlementPeriod })
  }

  return (
    <div className="platform-settings">
      <h2 className="platform-settings-title">プラットフォーム</h2>
      <div className="platform-list">
        {platforms.map((p) => {
          const isOpen = expandedId === p.id
          const current = isOpen && draft && draft.id === p.id ? draft : p
          return (
            <div className="platform-row-wrap" key={p.id}>
              <button className="platform-row" onClick={() => startEdit(p)}>
                <span className="platform-dot" style={{ background: p.color }} />
                <span className="platform-name">{p.name || '（未入力）'}</span>
                <span className="platform-row-chevron">{isOpen ? '︿' : '﹀'}</span>
              </button>
              {isOpen && (
                <div className="platform-detail">
                  <label className="platform-field">
                    <span>名前</span>
                    <input
                      type="text"
                      value={current.name}
                      placeholder="例：Uber Eats"
                      onChange={(e) => commit({ ...current, name: e.target.value })}
                    />
                  </label>
                  <div className="platform-field">
                    <span>色</span>
                    <div className="color-swatches">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`color-swatch${current.color === c ? ' is-selected' : ''}`}
                          style={{ background: c }}
                          onClick={() => commit({ ...current, color: c })}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="platform-field">
                    <span>支払い日</span>
                    <PaymentDayPicker
                      value={current.paymentDay}
                      onChange={(next) => handlePaymentDayChange(current, next)}
                    />
                  </div>

                  <div className="platform-field">
                    <span>集計期間</span>
                    <SettlementPeriodPicker
                      paymentDay={current.paymentDay}
                      value={current.settlementPeriod}
                      onChange={(next) => commit({ ...current, settlementPeriod: next })}
                    />
                  </div>

                  <button
                    className="platform-delete-btn"
                    onClick={() => {
                      actions.deletePlatform(p.id)
                      setExpandedId(null)
                    }}
                  >
                    このプラットフォームを削除
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button className="platform-add-btn" onClick={startAdd}>
        ＋ プラットフォームを追加
      </button>
    </div>
  )
}
