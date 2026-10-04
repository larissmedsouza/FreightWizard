import type { CSSProperties } from "react"
import FwIcon, { type FwIconName } from "./FwIcon"

/** Stagger for reveal-on-scroll: each item in a grid enters a little later. */
export function revealDelay(index: number, step = 70): CSSProperties {
  return { ["--reveal-delay" as string]: `${index * step}ms` } as CSSProperties
}

/** Icon in a hairline frame. No fill, no coloured tile. */
export function IconFrame({ name, className = "" }: { name: FwIconName; className?: string }) {
  return (
    <span className={`flex size-11 flex-none items-center justify-center rounded-fw-card border border-fw-line text-fw-violet-400 ${className}`}>
      <FwIcon name={name} />
    </span>
  )
}

/**
 * The one card style on the landing page: flat panel, 1px white-10% border,
 * 4px radius, line icon in a hairline frame.
 */
export default function FeatureCard({
  icon,
  title,
  text,
  index = 0,
  align = "left",
}: {
  icon: FwIconName
  title: string
  text: string
  index?: number
  align?: "left" | "center"
}) {
  const center = align === "center"
  return (
    <article
      data-reveal
      style={revealDelay(index)}
      className={`flex h-full flex-col rounded-fw-card border border-fw-line bg-fw-panel p-6 transition-colors duration-300 ease-calm hover:border-fw-line-strong md:p-7 ${
        center ? "items-center text-center" : ""
      }`}
    >
      <IconFrame name={icon} />
      <h3 className="mt-6 font-fw-display text-fw-h3 font-semibold text-fw-ink">{title}</h3>
      <p className="mt-2 text-fw-small text-fw-ink-2">{text}</p>
    </article>
  )
}
