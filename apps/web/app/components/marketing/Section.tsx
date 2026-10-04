import type { ReactNode } from "react"

/**
 * Shared section rhythm: 64px vertical padding on phones, 96px from md up,
 * flat canvas ground with a hairline between sections.
 */
export function Section({
  id,
  labelledBy,
  width = "max-w-6xl",
  className = "",
  children,
}: {
  id?: string
  labelledBy?: string
  width?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`border-t border-fw-line bg-fw-canvas ${className}`}>
      <div className={`mx-auto ${width} px-4 py-16 md:px-10 md:py-24`}>{children}</div>
    </section>
  )
}

/** Mono uppercase label with a short indigo rule before it. indigo-300 text (8.1:1 on canvas). */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-3 font-fw-mono text-fw-eyebrow uppercase text-fw-indigo-300 ${className}`}>
      <span aria-hidden className="h-0.5 w-5 flex-none rounded-full bg-fw-indigo-500" />
      {children}
    </p>
  )
}

/** Section header: eyebrow, H2 and optional intro. One heading scale for every section. */
export function SectionHeader({
  id,
  eyebrow,
  title,
  intro,
  align = "center",
  className = "",
  children,
}: {
  id?: string
  eyebrow?: string
  title: ReactNode
  intro?: ReactNode
  align?: "left" | "center"
  className?: string
  children?: ReactNode
}) {
  return (
    <header
      data-reveal
      className={`max-w-3xl ${align === "center" ? "mx-auto text-center [&>p:first-child]:justify-center" : ""} ${className}`}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id} className={`font-fw-display text-fw-h2 font-light text-fw-ink ${eyebrow ? "mt-4" : ""}`}>
        {title}
      </h2>
      {intro && <div className="mt-5 space-y-4 text-fw-lead text-fw-ink-2">{intro}</div>}
      {children}
    </header>
  )
}
