import type { CSSProperties } from "react"
import FwIcon, { type IconName as FwIconName } from "@/app/components/ui/Icon"

/** Stagger for reveal-on-scroll: each item in a grid enters a little later. */
export function revealDelay(index: number, step = 70): CSSProperties {
  return { ["--reveal-delay" as string]: `${index * step}ms` } as CSSProperties
}

/** Card/row title that turns indigo while its `group` parent is hovered. */
export const titleHover = "transition-colors group-hover:text-fw-indigo-300"

/** Icon tile: flat indigo tint, hairline border, solid indigo line icon. */
export function IconFrame({ name, className = "" }: { name: FwIconName; className?: string }) {
  return (
    <span
      className={`flex size-11 flex-none items-center justify-center rounded-fw-card border border-fw-line bg-fw-indigo-500/10 text-fw-indigo-300 ${className}`}
    >
      <FwIcon name={name} />
    </span>
  )
}

/**
 * The one card style on the landing page: flat panel, 1px white-10% border,
 * 4px radius, indigo line icon in a tinted tile. On hover the border picks up
 * indigo and the title turns indigo-300.
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
      className={`group flex h-full flex-col rounded-fw-card border border-fw-line bg-fw-panel p-6 transition-colors duration-300 ease-calm hover:border-fw-indigo-500/50 md:p-7 ${
        center ? "items-center text-center" : ""
      }`}
    >
      <IconFrame name={icon} />
      <h3 className={`mt-6 font-fw-display text-fw-h3 font-semibold text-fw-ink ${titleHover}`}>{title}</h3>
      <p className="mt-2 text-fw-small text-fw-ink-2">{text}</p>
    </article>
  )
}
