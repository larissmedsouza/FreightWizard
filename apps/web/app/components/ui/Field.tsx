import type { ReactNode } from "react"

/**
 * Form control classes: 3px radius, 1px border, focus ring in the theme's
 * focus colour (indigo-500 light / indigo-300 dark, both >= 7:1).
 */
export const inputClass =
  "w-full rounded-fw-btn border border-app-line-strong bg-app-card px-3 py-2 text-app-ui text-app-ink placeholder:text-app-ink-3 focus:border-app-focus focus:outline-none focus:ring-1 focus:ring-app-focus disabled:opacity-60"

export const textareaClass = `${inputClass} resize-none`

export const selectClass = `${inputClass} pr-8`

/** Label above a control. */
export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-app-ui-sm font-medium text-app-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-app-ui-sm text-app-ink-3">{hint}</span>}
    </label>
  )
}

/** Mono uppercase label for data fields (e.g. "BL NUMBER"). */
export function DataLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-fw-mono text-app-mono-xs uppercase text-app-ink-3 ${className}`}>{children}</p>
}
