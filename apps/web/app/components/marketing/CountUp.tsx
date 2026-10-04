"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Counts up to `value` once when scrolled into view, then eases between values
 * when `value` changes (e.g. the monthly/annual pricing toggle). Server-renders
 * the final value, so no-JS, reduced-motion users and crawlers always see real
 * numbers.
 */
export default function CountUp({
  value,
  prefix = "",
  suffix = "",
  duration = 1200,
}: {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const [display, setDisplay] = useState(value)
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(value) // last value actually on screen
  const started = useRef(false) // first scroll-in animation has run

  useEffect(() => {
    const el = ref.current
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!el || reduced || !("IntersectionObserver" in window)) {
      shown.current = value
      setDisplay(value)
      return
    }

    let frame = 0
    const animate = (from: number) => {
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        const next = Math.round(from + (value - from) * eased)
        shown.current = next
        setDisplay(next)
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    if (started.current) {
      animate(shown.current)
      return () => cancelAnimationFrame(frame)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        started.current = true
        animate(0)
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
