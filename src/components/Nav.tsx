export type Tab = 'today' | 'hero' | 'chronicle' | 'settings'

const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: 'today', label: 'Today', ico: '🗡️' },
  { id: 'hero', label: 'Hero', ico: '🧙' },
  { id: 'chronicle', label: 'Chronicle', ico: '📜' },
  { id: 'settings', label: 'Settings', ico: '⚙️' },
]

export function Nav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav" aria-label="Primary">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={tab === t.id ? 'active' : undefined}
          onClick={() => onChange(t.id)}
        >
          <span className="nav-ico" aria-hidden>
            {t.ico}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
