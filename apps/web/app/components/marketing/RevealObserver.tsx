"use client"

import { useEffect } from "react"

/**
 * One IntersectionObserver for the landing page. Any element with `data-reveal`
 * gets `.is-visible` once it scrolls into view; CSS in globals.css handles the
 * (subtle) motion. Content is fully visible without JS and with
 * prefers-reduced-motion, because the hidden state only applies under
 * `.js` + `prefers-reduced-motion: no-preference`.
 */
export default function RevealObserver() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)")
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible")
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return null
}
