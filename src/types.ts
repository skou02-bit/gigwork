// ギグワーカー収益管理アプリ ドメイン型定義
// 詳細な仕様は REQUIREMENTS.md を参照

/** 月末を表す特別な値（monthly の日付配列で使う） */
export const LAST_DAY_OF_MONTH = 32

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=日曜 ... 6=土曜

/** 支払い日（お金が届くタイミング） */
export type PaymentDayConfig =
  | { type: 'monthly'; days: number[] } // 1-31、LAST_DAY_OF_MONTH で月末。複数選択可
  | { type: 'weekly'; weekdays: Weekday[] } // 複数選択可
  | { type: 'daily' } // 稼働当日〜翌日払いなど、都度支払い

/** 時刻は "HH:mm" 形式の文字列で保持する */
export type TimeString = string

export interface WeeklyRange {
  startWeekday: Weekday
  startTime: TimeString
  endWeekday: Weekday
  endTime: TimeString
}

export interface MonthlyRange {
  /** 1-31、LAST_DAY_OF_MONTH で月末 */
  startDay: number
  startTime: TimeString
  endDay: number
  endTime: TimeString
}

/** 集計期間（稼働をまとめる単位） */
export type SettlementPeriodConfig =
  | { type: 'weekly'; range: WeeklyRange }
  | { type: 'monthly'; ranges: MonthlyRange[] } // 月2回等、複数の期間を持てる
  | { type: 'daily'; cutoffTime: TimeString }

export interface Platform {
  id: string
  name: string
  /** ドットカラー。#rrggbb */
  color: string
  paymentDay: PaymentDayConfig
  settlementPeriod: SettlementPeriodConfig
  /** 登録順（一覧表示の既定順） */
  order: number
}

/** 日別の実額記録（プラットフォームごとに個別、合算しない） */
export interface IncomeEntry {
  id: string
  platformId: string
  /** "YYYY-MM-DD" */
  date: string
  amount: number
  memo?: string
}

export interface FixedExpense {
  id: string
  name: string
  amount: number
  /** 引き落とし日。1-31、LAST_DAY_OF_MONTH で月末 */
  dueDay: number
  /** 支払い済みチェック（アラート合算から除外） */
  paid: boolean
  order: number
}

export interface VariableExpense {
  id: string
  name: string
  /** 今月いくらまで使う予定か */
  budgetAmount: number
  /** 実際にいくら使ったか */
  spentAmount: number
  order: number
}
