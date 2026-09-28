import { DrumRoll } from './DrumRoll'
import { formatTime, hourOptions, minuteOptions, parseTime } from '../utils/labels'

interface TimePickerProps {
  label?: string
  value: string // "HH:mm"
  onChange: (value: string) => void
}

/** 時刻専用のドラムロール（時・分の2列） */
export function TimePicker({ label, value, onChange }: TimePickerProps) {
  const { hour, minute } = parseTime(value)
  return (
    <div className="time-picker">
      {label && <div className="time-picker-label">{label}</div>}
      <div className="time-picker-rolls">
        <DrumRoll options={hourOptions()} value={hour} onChange={(h) => onChange(formatTime(h, minute))} />
        <div className="time-picker-colon">:</div>
        <DrumRoll options={minuteOptions()} value={minute} onChange={(m) => onChange(formatTime(hour, m))} />
      </div>
    </div>
  )
}
