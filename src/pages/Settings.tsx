import { useState } from 'react'
import { useStore } from '../lib/store'

export function SettingsPage() {
  const { demoResetDay, exportJson, factoryReset, seedDemoHistory } = useStore()
  const [copied, setCopied] = useState(false)

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
        <h2>Demo tools</h2>
        <div className="settings-list">
          <button type="button" className="btn btn-ghost" onClick={demoResetDay}>
            Reset today (demo)
          </button>
          <button type="button" className="btn btn-ghost" onClick={seedDemoHistory}>
            Seed chronicle history
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
