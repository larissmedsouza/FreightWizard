import type { ReactNode } from "react"
import Icon, { type IconName } from "./Icon"
import { toneClass, type Tone } from "./tones"

/* ---- Toast ------------------------------------------------------------- */

export type ToastData = { type: "success" | "error" | "warning"; msg: string; sub?: string } | null

/** Flat notification below the top bar; the icon and its colour carry the type. */
export function Toast({ notification }: { notification: ToastData }) {
  if (!notification) return null
  const tone: Tone = notification.type === "success" ? "ok" : notification.type === "warning" ? "warn" : "danger"
  return (
    <div role="status" className="fixed right-4 top-14 z-50 flex max-w-sm items-start gap-2.5 rounded-fw-card border border-app-line bg-app-card px-4 py-3 shadow-app-pop">
      <Icon name={notification.type === "success" ? "check" : "alert"} size={16} className={`mt-0.5 ${toneClass[tone].text}`} />
      <div>
        <p className="text-app-ui font-medium text-app-ink">{notification.msg}</p>
        {notification.sub && <p className="mt-0.5 text-app-ui-sm text-app-ink-2">{notification.sub}</p>}
      </div>
    </div>
  )
}

/* ---- KPI / stat tile ------------------------------------------------------ */

/** KPI tile: small label, Sora number, optional hint. Flat panel, 1px border. */
export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
  className = "",
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  /** Colours the value for status-like KPIs (e.g. expiring rates). */
  tone?: Tone
  icon?: IconName
  className?: string
}) {
  return (
    <div className={`rounded-fw-card border border-app-line bg-app-card px-4 py-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-app-ui-sm text-app-ink-2">
        {icon && <Icon name={icon} size={14} className="text-app-ink-3" />}
        {label}
      </p>
      <p className={`mt-1 font-fw-display text-app-kpi font-normal tabular-nums ${tone ? toneClass[tone].text : "text-app-ink"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-app-ui-sm text-app-ink-3">{hint}</p>}
    </div>
  )
}

/* ---- Segmented control ---------------------------------------------------- */

/** Square segmented filter (replaces pill tab rows). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: { value: T; label: ReactNode; icon?: IconName }[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={`inline-flex flex-wrap gap-0.5 rounded-fw-btn border border-app-line bg-app-panel p-0.5 ${className}`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`flex h-7 items-center gap-1.5 rounded-[2px] px-2.5 text-app-ui-sm transition-colors ${
              active ? "border border-app-line bg-app-card font-medium text-app-ink" : "text-app-ink-2 hover:text-app-ink"
            }`}
          >
            {o.icon && <Icon name={o.icon} size={14} className={active ? "text-app-accent" : ""} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---- Tables ---------------------------------------------------------------- */

/** FreightGuild table: mono uppercase headers, hairline rows, values in mono where they are data. */
export const th = "px-4 py-2.5 text-left font-fw-mono text-app-mono-xs font-normal uppercase text-app-ink-3 whitespace-nowrap"
export const td = "px-4 py-3 align-middle"
export const tdMono = "px-4 py-3 align-middle font-fw-mono text-app-mono whitespace-nowrap"
export const tr = "border-b border-app-line last:border-0"

export function DataTable({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-fw-card border border-app-line bg-app-card ${className}`} role="region" aria-label={label} tabIndex={0}>
      <table className="w-full border-collapse text-app-ui">
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  )
}

/* ---- Search input ----------------------------------------------------------- */

export function SearchField({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <label className={`flex h-9 items-center gap-2 rounded-fw-btn border border-app-line-strong bg-app-card px-3 focus-within:border-app-focus ${className}`}>
      <Icon name="search" size={15} className="text-app-ink-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-app-ui text-app-ink placeholder:text-app-ink-3 focus:outline-none"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="text-app-ink-3 hover:text-app-ink">
          <Icon name="close" size={13} />
        </button>
      )}
    </label>
  )
}

/** Route rendered as mono "A → B". */
export function Route({ from, to, className = "" }: { from?: string; to?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-fw-mono text-app-mono ${className}`}>
      <span className="truncate">{from || "—"}</span>
      <Icon name="arrow-right" size={12} className="flex-none text-app-ink-3" />
      <span className="truncate">{to || "—"}</span>
    </span>
  )
}
