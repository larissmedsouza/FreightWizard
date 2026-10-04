import type { ReactNode } from "react"
import Icon, { type IconName } from "./Icon"
import { toneClass, type Tone } from "./tones"

/**
 * Root class for every logged-in page: theme ground, Plex Sans, focus ring.
 * Pair with data-theme={darkMode ? "dark" : "light"} on the same element.
 */
export const appRootClass =
  "min-h-screen bg-app-bg font-fw-sans text-app-ui text-app-ink antialiased [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-app-focus"

/** Flat card: 1px border, 4px radius, no shadow. */
export const panelClass = "rounded-fw-card border border-app-line bg-app-card"

export function Panel({ children, className = "", as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <As className={`${panelClass} ${className}`}>{children}</As>
}

/** Page title block: Sora title, optional mono meta line above, actions on the right. */
export function PageHeader({
  title,
  meta,
  description,
  actions,
  className = "",
}: {
  title: ReactNode
  meta?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {meta && <p className="mb-1 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">{meta}</p>}
        <h1 className="font-fw-display text-app-title font-light text-app-ink">{title}</h1>
        {description && <p className="mt-1 text-app-ui text-app-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Section heading inside a page/panel. */
export function SectionTitle({ children, icon, className = "" }: { children: ReactNode; icon?: IconName; className?: string }) {
  return (
    <h2 className={`flex items-center gap-2 font-fw-display text-app-title-sm font-normal text-app-ink ${className}`}>
      {icon && <Icon name={icon} size={18} className="text-app-accent" />}
      {children}
    </h2>
  )
}

/** Neutral kanban column header with a coloured status dot. */
export function ColumnHeader({ label, count, tone = "neutral" }: { label: string; count?: number; tone?: Tone }) {
  return (
    <div className="flex items-center gap-2 rounded-fw-card border border-app-line bg-app-panel px-3 py-2">
      <span aria-hidden className={`size-2 flex-none rounded-full ${toneClass[tone].dot}`} />
      <span className="flex-1 truncate text-app-ui font-medium text-app-ink">{label}</span>
      {count !== undefined && <span className="font-fw-mono text-app-mono text-app-ink-3">{count}</span>}
    </div>
  )
}

/** Empty / zero-data state. */
export function EmptyState({
  icon = "inbox",
  title,
  text,
  action,
  className = "",
}: {
  icon?: IconName
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-10 text-center ${className}`}>
      <span className="mb-3 flex size-11 items-center justify-center rounded-fw-card border border-app-line text-app-accent">
        <Icon name={icon} size={20} />
      </span>
      <p className="text-app-ui font-medium text-app-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-app-ui-sm text-app-ink-2">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Inline callout (alerts, notices) using a status tone. */
export function Notice({
  tone = "info",
  icon,
  title,
  children,
  action,
  className = "",
}: {
  tone?: Tone
  icon?: IconName
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const t = toneClass[tone]
  return (
    <div className={`flex items-start gap-2.5 rounded-fw-card border border-app-line p-3 ${t.row}`}>
      {icon && <Icon name={icon} size={16} className={`mt-0.5 ${t.text}`} />}
      <div className={`min-w-0 flex-1 ${className}`}>
        {title && <p className={`text-app-ui-sm font-semibold ${t.text}`}>{title}</p>}
        {children && <div className="mt-0.5 text-app-ui-sm text-app-ink-2">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}
