/**
 * Semantic tones for status / priority tags (FreightGuild style: tinted
 * background, coloured dot, readable text). Every tone's text/background pair
 * is >= 5.3:1 in light mode and >= 6.9:1 in dark mode (see brand/tokens.js).
 */
export type Tone = "danger" | "warn" | "info" | "ok" | "accent" | "neutral"

// Full class strings so Tailwind can see them.
export const toneClass: Record<Tone, { tag: string; dot: string; text: string; row: string }> = {
  danger: { tag: "bg-app-danger-bg text-app-danger-ink", dot: "bg-app-danger-dot", text: "text-app-danger-ink", row: "bg-app-danger-bg" },
  warn: { tag: "bg-app-warn-bg text-app-warn-ink", dot: "bg-app-warn-dot", text: "text-app-warn-ink", row: "bg-app-warn-bg" },
  info: { tag: "bg-app-info-bg text-app-info-ink", dot: "bg-app-info-dot", text: "text-app-info-ink", row: "bg-app-info-bg" },
  ok: { tag: "bg-app-ok-bg text-app-ok-ink", dot: "bg-app-ok-dot", text: "text-app-ok-ink", row: "bg-app-ok-bg" },
  accent: { tag: "bg-app-accent-bg text-app-accent-ink", dot: "bg-app-accent-dot", text: "text-app-accent-ink", row: "bg-app-accent-bg" },
  neutral: { tag: "bg-app-neutral-bg text-app-neutral-ink", dot: "bg-app-neutral-dot", text: "text-app-neutral-ink", row: "bg-app-neutral-bg" },
}

/** Email priority -> tone. Unknown values fall back to neutral. */
export function priorityTone(p?: string | null): Tone {
  switch ((p || "").toLowerCase()) {
    case "urgent":
      return "danger"
    case "high":
      return "warn"
    case "medium":
      return "info"
    default:
      return "neutral"
  }
}

/** Inbox workflow status -> tone. */
export function workflowTone(status?: string | null): Tone {
  switch (status) {
    case "new":
      return "info"
    case "quoted":
      return "accent"
    case "booked":
      return "ok"
    case "pending_docs":
      return "warn"
    default:
      return "neutral" // waiting_customer, closed
  }
}

/** Shipment tracker status -> tone. */
export function shipmentTone(status?: string | null): Tone {
  switch (status) {
    case "quoted":
    case "in_transit":
      return "info"
    case "booked":
      return "accent"
    case "at_destination":
      return "warn"
    case "delivered":
      return "ok"
    case "cancelled":
      return "danger"
    default:
      return "neutral" // inquiry, closed
  }
}

/** Quote status -> tone. */
export function quoteTone(status?: string | null): Tone {
  switch (status) {
    case "sent":
      return "info"
    case "accepted":
      return "ok"
    case "rejected":
    case "declined":
      return "danger"
    case "expired":
      return "warn"
    default:
      return "neutral" // draft
  }
}

/** Transport mode -> line icon name. */
export const MODE_ICON: Record<string, "ocean" | "air" | "road" | "rail" | "container"> = {
  ocean: "ocean", sea: "ocean", fcl: "ocean", lcl: "ocean", air: "air", road: "road", truck: "road", rail: "rail", "": "container",
}

/**
 * Custom folder/label colours were stored in localStorage as Tailwind classes
 * ("text-purple-400"). Map them onto tones so existing labels keep a distinct,
 * accessible colour without migrating saved data.
 */
export function labelTone(stored?: string | null): Tone {
  const s = stored || ""
  if (/purple|violet|indigo/.test(s)) return "accent"
  if (/blue|cyan|sky/.test(s)) return "info"
  if (/green|emerald|teal/.test(s)) return "ok"
  if (/yellow|amber|orange/.test(s)) return "warn"
  if (/red|pink|rose/.test(s)) return "danger"
  return "neutral"
}
