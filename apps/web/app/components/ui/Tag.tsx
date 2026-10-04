import type { ReactNode } from "react"
import { priorityTone, toneClass, workflowTone, type Tone } from "./tones"

/**
 * Small square status tag (FreightGuild StatusBadge): tinted background,
 * coloured dot, mono uppercase by default. The only rounded-pill-free badge
 * in the app; never use it as a button.
 */
export function Tag({
  tone = "neutral",
  children,
  dot = true,
  mono = true,
  className = "",
  title,
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
  mono?: boolean
  className?: string
  title?: string
}) {
  const t = toneClass[tone]
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-fw-btn px-1.5 py-0.5 ${
        mono ? "font-fw-mono text-app-mono-xs uppercase" : "text-app-ui-sm"
      } ${t.tag} ${className}`}
    >
      {dot && <span aria-hidden className={`size-1.5 flex-none rounded-full ${t.dot}`} />}
      {children}
    </span>
  )
}

export function PriorityTag({ priority, className = "" }: { priority?: string | null; className?: string }) {
  if (!priority) return null
  return (
    <Tag tone={priorityTone(priority)} className={className}>
      {priority}
    </Tag>
  )
}

export function WorkflowTag({ status, label, className = "" }: { status: string; label: string; className?: string }) {
  return (
    <Tag tone={workflowTone(status)} className={className}>
      {label}
    </Tag>
  )
}

/** Plain neutral chip for metadata (intent, owner, label). Square, no dot. */
export function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-fw-btn border border-app-line px-1.5 py-0.5 text-app-ui-sm text-app-ink-2 ${className}`}
    >
      {children}
    </span>
  )
}
