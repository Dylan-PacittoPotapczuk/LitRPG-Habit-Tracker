import { useState } from 'react'
import { CLASSES } from '../lib/classes'
import { RACES } from '../lib/races'
import type { HeroClass, HeroRace } from '../lib/types'
import { PixelAvatar } from './PixelAvatar'

export function ClassSelect({
  onChoose,
}: {
  onChoose: (race: HeroRace, heroClass: HeroClass) => void
}) {
  const [step, setStep] = useState<'race' | 'class'>('race')
  const [race, setRace] = useState<HeroRace>('human')
  const [heroClass, setHeroClass] = useState<HeroClass>('warrior')
  const activeRace = RACES.find((r) => r.id === race)!
  const activeClass = CLASSES.find((c) => c.id === heroClass)!

  return (
    <div
      className="class-select-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-select-title"
    >
      <div className="class-select-panel">
        <p className="class-select-kicker">First steps on the Emberpath</p>
        <h1 id="class-select-title">
          {step === 'race' ? 'Choose your race' : 'Choose your class'}
        </h1>
        <p className="class-select-lede">
          {step === 'race'
            ? 'Distinct silhouettes — ears, build, and skin. You can respec later in Settings.'
            : 'Soft XP bias on a few habits. Gear and race stay if you respec.'}
        </p>

        <div className="class-select-preview">
          <PixelAvatar
            heroRace={race}
            heroClass={step === 'class' ? heroClass : null}
            equipped={{ chest: 'cloth-tunic' }}
            size="large"
          />
          <div className="class-select-copy">
            {step === 'race' ? (
              <>
                <h2 style={{ color: activeRace.skin.light }}>{activeRace.name}</h2>
                <p>{activeRace.blurb}</p>
              </>
            ) : (
              <>
                <h2 style={{ color: activeClass.palette.accent }}>
                  {activeRace.name} {activeClass.name}
                </h2>
                <p>{activeClass.blurb}</p>
                <p className="bias">Bias: {activeClass.biasLabel}</p>
              </>
            )}
          </div>
        </div>

        {step === 'race' ? (
          <div className="class-grid" role="listbox" aria-label="Races">
            {RACES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={race === r.id}
                className={`class-card ${race === r.id ? 'selected' : ''}`}
                onClick={() => setRace(r.id)}
              >
                <PixelAvatar
                  heroRace={r.id}
                  heroClass={null}
                  equipped={{ chest: 'cloth-tunic' }}
                  size="card"
                />
                <span className="class-card-name">{r.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="class-grid" role="listbox" aria-label="Classes">
            {CLASSES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={heroClass === c.id}
                className={`class-card ${heroClass === c.id ? 'selected' : ''}`}
                onClick={() => setHeroClass(c.id)}
              >
                <PixelAvatar
                  heroRace={race}
                  heroClass={c.id}
                  equipped={{ chest: 'cloth-tunic' }}
                  size="card"
                />
                <span className="class-card-name">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="class-select-actions">
          {step === 'class' ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep('race')}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step === 'race' ? (
            <button
              type="button"
              className="btn btn-primary class-confirm"
              onClick={() => setStep('class')}
            >
              Next: Class
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary class-confirm"
              onClick={() => onChoose(race, heroClass)}
            >
              Begin as {activeRace.name} {activeClass.name}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
