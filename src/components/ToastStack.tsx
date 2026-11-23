import { useEffect } from 'react'
import { useStore } from '../lib/store'

export function ToastStack() {
  const { toasts, dismissToast } = useStore()

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismissToast(t.id), t.kind === 'level' ? 4200 : 2800),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [toasts, dismissToast])

  if (!toasts.length) return null

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
          <strong>{t.title}</strong>
          {t.detail ? <span>{t.detail}</span> : null}
        </div>
      ))}
    </div>
  )
}
