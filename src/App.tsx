import { useState } from 'react'
import { Nav, type Tab } from './components/Nav'
import { ToastStack } from './components/ToastStack'
import { StoreProvider, useStore } from './lib/store'
import { ChroniclePage } from './pages/Chronicle'
import { HeroPage } from './pages/Hero'
import { SettingsPage } from './pages/Settings'
import { TodayPage } from './pages/Today'

function Shell() {
  const { ready } = useStore()
  const [tab, setTab] = useState<Tab>('today')

  if (!ready) {
    return <div className="boot">Lighting the lantern…</div>
  }

  return (
    <div className="app-shell">
      <ToastStack />
      {tab === 'today' ? <TodayPage /> : null}
      {tab === 'hero' ? <HeroPage /> : null}
      {tab === 'chronicle' ? <ChroniclePage /> : null}
      {tab === 'settings' ? <SettingsPage /> : null}
      <Nav tab={tab} onChange={setTab} />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
