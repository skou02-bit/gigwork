import { useEffect, useRef } from 'react'
import './DrumRoll.css'

const ITEM_HEIGHT = 36
const VISIBLE_ITEMS = 3
const PAD_ITEMS = (VISIBLE_ITEMS - 1) / 2

export interface DrumRollOption<T> {
  label: string
  value: T
}

interface DrumRollProps<T> {
  /** ロールの上に添えるラベル（例：「起算日」「締め日」） */
  label?: string
  options: DrumRollOption<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * 縦スクロール式のドラムロールピッカー。
 * 候補をボタンとして横に並べる形にはせず、指のスクロールで選ぶ。
 * どこを触ってもスクロールでき、離した位置に一番近い項目にスナップする。
 */
export function DrumRoll<T,>({ label, options, value, onChange }: DrumRollProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const isProgrammaticScroll = useRef(false)

  // 選択値が外部から変わったらロールの位置を合わせる
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const target = selectedIndex * ITEM_HEIGHT
    if (Math.abs(el.scrollTop - target) > 1) {
      isProgrammaticScroll.current = true
      el.scrollTo({ top: target, behavior: 'auto' })
      requestAnimationFrame(() => {
        isProgrammaticScroll.current = false
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex])

  const scrollTimeout = useRef<number | undefined>(undefined)

  function handleScroll() {
    if (isProgrammaticScroll.current) return
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current)
    // スクロールが止まったタイミングで一番近い項目に確定・スナップする
    scrollTimeout.current = window.setTimeout(() => {
      const el = containerRef.current
      if (!el) return
      const index = Math.round(el.scrollTop / ITEM_HEIGHT)
      const clamped = Math.min(Math.max(index, 0), options.length - 1)
      el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' })
      const next = options[clamped]
      if (next && next.value !== value) onChange(next.value)
    }, 90)
  }

  return (
    <div className="drum-roll-wrap">
      {label && <div className="drum-roll-label">{label}</div>}
      <div
        className="drum-roll"
        ref={containerRef}
        onScroll={handleScroll}
        style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
      >
        <div className="drum-roll-highlight" style={{ height: ITEM_HEIGHT, top: PAD_ITEMS * ITEM_HEIGHT }} />
        <div style={{ height: PAD_ITEMS * ITEM_HEIGHT }} />
        {options.map((o, i) => (
          <div
            key={i}
            className={`drum-roll-item${o.value === value ? ' is-selected' : ''}`}
            style={{ height: ITEM_HEIGHT }}
            onClick={() => {
              containerRef.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: 'smooth' })
              onChange(o.value)
            }}
          >
            {o.label}
          </div>
        ))}
        <div style={{ height: PAD_ITEMS * ITEM_HEIGHT }} />
      </div>
    </div>
  )
}
