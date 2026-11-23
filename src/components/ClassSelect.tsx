import { useState } from 'react'
import { CLASSES } from '../lib/classes'
import type { HeroClass } from '../lib/types'
import { PixelAvatar } from './PixelAvatar'

export function ClassSelect({ onChoose }: { onChoose: (id: HeroClass) => void }) {
  const [picked, setPicked] = useState<HeroClass>('warrior')
  const active = CLASSES.find((c) => c.id === picked)!

  return (
    <div className="class-select-overlay" role="dialog" aria-modal="true" aria-labelledby="class-select-title">
      <div className="class-select-panel">
        <p className="class-select-kicker">First steps on the Emberpath</p>
        <h1 id="class-select-title">Choose your class</h1>
        <p className="class-select-lede">
          Soft XP bias on a few habits. You can respec later in Settings — gear stays.
        </p>

        <div className="class-select-preview">
          <PixelAvatar
            heroClass={picked}
            equipped={{ chest: 'cloth-tunic' }}
            large
          />
          <div className="class-select-copy">
            <h2 style={{ color: active.palette.accent }}>{active.name}</h2>
            <p>{active.blurb}</p>
            <p className="bias">Bias: {active.biasLabel}</p>
          </div>
        </div>

        <div className="class-grid" role="listbox" aria-label="Classes">
          {CLASSES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={picked === c.id}
              className={`class-card ${picked === c.id ? 'selected' : ''}`}
              onClick={() => setPicked(c.id)}
            >
              <PixelAvatar
                heroClass={c.id}
                equipped={{ chest: 'cloth-tunic' }}
              />
              <span className="class-card-name">{c.name}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary class-confirm"
          onClick={() => onChoose(picked)}
        >
          Begin as {active.name}
        </button>
      </div>
    </div>
  )
}
