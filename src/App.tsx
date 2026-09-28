import { useState } from 'react'
import { Calendar } from './components/Calendar'
import { PlatformSettings } from './components/PlatformSettings'
import './App.css'

type Tab = 'calendar' | 'platforms'

export default function App() {
  const [tab, setTab] = useState<Tab>('calendar')

  return (
    <div className="app">
      <main className="app-main">{tab === 'calendar' ? <Calendar /> : <PlatformSettings />}</main>
      <nav className="app-nav">
        <button className={`app-nav-btn${tab === 'calendar' ? ' is-active' : ''}`} onClick={() => setTab('calendar')}>
          カレンダー
        </button>
        <button
          className={`app-nav-btn${tab === 'platforms' ? ' is-active' : ''}`}
          onClick={() => setTab('platforms')}
        >
          プラットフォーム
        </button>
      </nav>
    </div>
  )
}
