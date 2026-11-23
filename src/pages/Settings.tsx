import { useState } from 'react'
import { CLASSES } from '../lib/classes'
import type { HeroClass } from '../lib/types'
import { useStore } from '../lib/store'

export function SettingsPage() {
  const {
    state,
    demoResetDay,
    exportJson,
    factoryReset,
    seedDemoHistory,
    seedDemoArmory,
    respec,
  } = useStore()
  const [copied, setCopied] = useState(false)
  const current = state.player.heroClass

  async function onExport() {
    const json = exportJson()
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `emberpath-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <>
      <section className="section" style={{ marginTop: 20 }}>
        <h2>Settings</h2>
        <p className="lede">
          Local-only v1. Days roll over at local midnight. Install via your browser&apos;s Add to
          Home Screen for offline use.
        </p>
      </section>

      <section className="section">
        <h2>Class respec</h2>
        <p className="lede">
          Current:{' '}
          <strong style={{ color: 'var(--copper-bright)' }}>
            {current ? current[0].toUpperCase() + current.slice(1) : 'None'}
          </strong>
          . Soft XP bias changes; gear and progress stay.
        </p>
        <div className="respec-grid">
          {CLASSES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`btn ${current === c.id ? 'btn-primary' : 'btn-ghost'}`}
              disabled={current === c.id}
              onClick={() => respec(c.id as HeroClass)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Demo tools</h2>
        <div className="settings-list">
          <button type="button" className="btn btn-ghost" onClick={demoResetDay}>
            Reset today (demo)
          </button>
          <button type="button" className="btn btn-ghost" onClick={seedDemoHistory}>
            Seed chronicle history
          </button>
          <button type="button" className="btn btn-ghost" onClick={seedDemoArmory}>
            Seed demo armory
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExport}>
            {copied ? 'Copied JSON' : 'Export JSON'}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (confirm('Erase all local progress?')) void factoryReset()
            }}
          >
            Factory reset
          </button>
        </div>
      </section>

      <section className="section">
        <h2>Install (PWA)</h2>
        <p className="lede">
          <strong>Android Chrome:</strong> menu → Install app / Add to Home screen.
          <br />
          <strong>iPhone Safari:</strong> Share → Add to Home Screen.
          <br />
          After install, Emberpath works offline from IndexedDB.
        </p>
      </section>
    </>
  )
}
