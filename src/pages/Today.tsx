import { useState, type FormEvent } from 'react'
import { AvatarPortrait } from '../components/AvatarPortrait'
import { StatBars } from '../components/StatBars'
import { formatPretty } from '../lib/date'
import { levelFromXp, progressInLevel } from '../lib/game'
import { HABITS, VIBES } from '../lib/types'
import { useStore } from '../lib/store'

export function TodayPage() {
  const {
    state,
    today,
    checkHabit,
    pickVibe,
    createTodo,
    checkTodo,
    deleteTodo,
    showAtonement,
    doAtone,
  } = useStore()
  const day = state.days[today]
  const [todoText, setTodoText] = useState('')
  const prog = progressInLevel(state.player.xp)
  const level = levelFromXp(state.player.xp)

  function onAddTodo(e: FormEvent) {
    e.preventDefault()
    if (!todoText.trim()) return
    createTodo(todoText)
    setTodoText('')
  }

  return (
    <>
      <header className="brand-hero">
        <p style={{ margin: '0 0 8px', letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--ink-dim)' }}>
          Offline quest log
        </p>
        <h1 className="brand-name">Emberpath</h1>
        <p className="brand-tag">Habits, vibes, and loot — one day at a time in the realm.</p>
        <div className="brand-cta-row">
          <div className="pill-stat">
            Lv <strong>{level}</strong>
          </div>
          <div className="pill-stat">
            {formatPretty(today)}
          </div>
          <div className="pill-stat" style={{ gap: 10 }}>
            <AvatarPortrait />
          </div>
        </div>
      </header>

      <StatBars />

      {showAtonement ? (
        <div className="atonement section">
          <h2>Light atonement</h2>
          <p className="lede">Yesterday went unclaimed. A quiet ritual restores some HP.</p>
          <button type="button" className="btn btn-primary" onClick={doAtone}>
            Kneel & heal (+15 HP)
          </button>
        </div>
      ) : null}

      <section className="section">
        <h2>Vibe check</h2>
        <p className="lede">One feeling-emoji per day. Be honest — the chronicle is listening.</p>
        {day?.vibe ? (
          <p className="vibe-locked">
            Today&apos;s vibe:{' '}
            <strong>
              {VIBES.find((v) => v.id === day.vibe)?.emoji}{' '}
              {VIBES.find((v) => v.id === day.vibe)?.label}
            </strong>{' '}
            — {VIBES.find((v) => v.id === day.vibe)?.quip}
          </p>
        ) : (
          <div className="vibe-grid" role="group" aria-label="Daily vibe">
            {VIBES.map((v) => (
              <button
                key={v.id}
                type="button"
                className="vibe-btn"
                onClick={() => pickVibe(v.id)}
                title={v.quip}
              >
                <span className="emoji">{v.emoji}</span>
                <span className="lbl">{v.label}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Daily quests</h2>
        <p className="lede">
          Ten recurring habits always on the board. XP into level {prog.level}.
        </p>
        <ul className="habit-list">
          {HABITS.map((h) => {
            const done = !!day?.habitCompletions[h.id]
            return (
              <li key={h.id}>
                <button
                  type="button"
                  className={`habit-row ${done ? 'done' : ''}`}
                  onClick={() => checkHabit(h.id)}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  <span className="check" aria-hidden>
                    ✓
                  </span>
                  <span>
                    <p className="habit-title">{h.title}</p>
                    <p className="habit-blurb">{h.blurb}</p>
                  </span>
                  <span className="habit-icon" aria-hidden>
                    {h.icon}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="section">
        <h2>Side quests</h2>
        <p className="lede">
          One-off quests — unfinished ones carry to the next day until you complete or delete them.
        </p>
        <form className="todo-form" onSubmit={onAddTodo}>
          <input
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            placeholder="Add a one-off quest…"
            aria-label="New todo"
          />
          <button type="submit" className="btn btn-primary">
            Add
          </button>
        </form>
        <ul className="habit-list">
          {(day?.todos ?? []).map((t) => {
            const done = !!t.completedOn
            return (
              <li key={t.id}>
                <div className={`habit-row ${done ? 'done' : ''}`}>
                  <button
                    type="button"
                    className="check"
                    aria-label={done ? 'Mark incomplete' : 'Complete'}
                    onClick={() => checkTodo(t.id)}
                    style={{ color: done ? 'var(--moss-bright)' : undefined }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => checkTodo(t.id)}
                    style={{ textAlign: 'left' }}
                  >
                    <p className="habit-title">{t.title}</p>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    onClick={() => deleteTodo(t.id)}
                    aria-label="Remove todo"
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
