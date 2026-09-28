import { useMemo, useState } from 'react'
import { actions, genId, useAppState } from '../store'
import './InputPanel.css'

interface PaymentInfo {
  name: string
  color: string
  range: string | null
}

interface InputPanelProps {
  date: string // "YYYY-MM-DD"
  onClose: () => void
  paymentInfo: PaymentInfo[]
}

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫']

/**
 * 日付タップで下からせり上がる入力パネル。
 * プラットフォームを選ぶ→テンキーで金額入力→Nextで次のプラットフォームへ連続入力できる。
 */
export function InputPanel({ date, onClose, paymentInfo }: InputPanelProps) {
  const { platforms, entries } = useAppState()
  const dayEntries = useMemo(() => entries.filter((e) => e.date === date), [entries, date])

  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(platforms[0]?.id ?? null)
  const [amount, setAmount] = useState('')

  const [y, m, d] = date.split('-').map(Number)
  const dateLabel = `${m}/${d}`

  function existingEntryFor(platformId: string) {
    return dayEntries.find((e) => e.platformId === platformId)
  }

  function pressKey(key: string) {
    if (key === '⌫') {
      setAmount((a) => a.slice(0, -1))
      return
    }
    setAmount((a) => (a + key).slice(0, 9))
  }

  function save() {
    if (!selectedPlatformId) return
    const value = Number(amount)
    if (!amount || Number.isNaN(value)) return
    const existing = existingEntryFor(selectedPlatformId)
    actions.upsertEntry({
      id: existing?.id ?? genId(),
      platformId: selectedPlatformId,
      date,
      amount: value,
    })
    setAmount('')
    // 次の未入力プラットフォームへ自動的に移動する（連続入力）
    const currentIndex = platforms.findIndex((p) => p.id === selectedPlatformId)
    const next = platforms.find((p, i) => i > currentIndex && !existingEntryFor(p.id))
    setSelectedPlatformId(next?.id ?? selectedPlatformId)
  }

  function selectPlatform(id: string) {
    setSelectedPlatformId(id)
    const existing = existingEntryFor(id)
    setAmount(existing ? String(existing.amount) : '')
  }

  if (platforms.length === 0) {
    return (
      <div className="input-panel-overlay" onClick={onClose}>
        <div className="input-panel" onClick={(e) => e.stopPropagation()}>
          <div className="input-panel-header">
            <span>{dateLabel}</span>
            <button onClick={onClose}>閉じる</button>
          </div>
          <p className="input-panel-empty">先に「プラットフォーム」タブでプラットフォームを登録してね。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="input-panel-overlay" onClick={onClose}>
      <div className="input-panel" onClick={(e) => e.stopPropagation()}>
        <div className="input-panel-header">
          <span>{y}年{dateLabel}</span>
          <button onClick={onClose}>閉じる</button>
        </div>

        {paymentInfo.length > 0 && (
          <div className="input-panel-payments">
            {paymentInfo.map((info, i) => (
              <div className="input-panel-payment-badge" key={i} style={{ borderColor: info.color }}>
                {info.range ? `${info.range}　` : ''}
                {info.name}支払日
              </div>
            ))}
          </div>
        )}

        <div className="input-panel-platforms">
          {platforms.map((p) => {
            const existing = existingEntryFor(p.id)
            return (
              <button
                key={p.id}
                className={`input-panel-platform-chip${selectedPlatformId === p.id ? ' is-selected' : ''}`}
                style={{ borderColor: p.color }}
                onClick={() => selectPlatform(p.id)}
              >
                <span className="input-panel-platform-dot" style={{ background: p.color }} />
                {p.name || '（未入力）'}
                {existing && <span className="input-panel-platform-done">¥{existing.amount.toLocaleString()}</span>}
              </button>
            )
          })}
        </div>

        <div className="input-panel-amount">¥{amount ? Number(amount).toLocaleString() : '0'}</div>

        <div className="input-panel-keypad">
          {KEYPAD_KEYS.map((k) => (
            <button key={k} className="input-panel-key" onClick={() => pressKey(k)}>
              {k}
            </button>
          ))}
        </div>

        <button className="input-panel-save-btn" onClick={save} disabled={!selectedPlatformId || !amount}>
          この金額で確定 → 次へ
        </button>
      </div>
    </div>
  )
}
