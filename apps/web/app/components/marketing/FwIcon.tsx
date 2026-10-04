/**
 * FreightWizard line icons, in the FreightGuild style: route motif, one
 * continuous stroke where possible, round caps and joins, node dots and one
 * filled "accent" node. 24px grid, 1.5px stroke everywhere. Single colour via
 * currentColor (violet-400 on the landing page). No filled tiles.
 */
import type { ReactNode } from "react"

export type FwIconName =
  | "email"
  | "workflow"
  | "reply"
  | "priority"
  | "extract"
  | "intent"
  | "assistant"
  | "timeline"
  | "bell"
  | "analytics"
  | "quote"
  | "tracking"
  | "portal"
  | "rates"
  | "compliance"
  | "docs"
  | "forwarder"
  | "operations"
  | "sales"
  | "small"
  | "check"
  | "plus"
  | "minus"
  | "chevron"

const AF = "fill-current stroke-none" // accent node

const icons: Record<FwIconName, ReactNode> = {
  // Message frame with a route running into it
  email: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3.5 7 12 13l8.5-6" />
      <circle cx="12" cy="13" r="1.75" className={AF} />
    </>
  ),
  // One input routed to the right next step
  workflow: (
    <>
      <path d="M4 12h5l5-5h6M9 12l5 5h6" />
      <circle cx="4" cy="12" r="1.25" />
      <circle cx="20" cy="7" r="1.25" />
      <circle cx="20" cy="17" r="2" className={AF} />
    </>
  ),
  // Route returning to its origin
  reply: (
    <>
      <path d="M20.5 18v-3a5 5 0 0 0-5-5H5" />
      <path d="M8.5 6.5 5 10l3.5 3.5" />
      <circle cx="20.5" cy="18" r="1.75" className={AF} />
    </>
  ),
  // Inbox tray with the top item lifted out
  priority: (
    <>
      <path d="M3.5 13.5 6 5.5h12l2.5 8v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M3.5 13.5h5l1 2h5l1-2h5" />
      <circle cx="12" cy="9.5" r="1.75" className={AF} />
    </>
  ),
  // Document with a field routed out of it
  extract: (
    <>
      <path d="M12.5 21h-6V3h7.5l4 4v5.5" />
      <path d="M14 3v4h4M9.5 10.5h5M9.5 14h3" />
      <path d="M15.5 17.5h6M19 15l2.5 2.5L19 20" />
      <circle cx="15.5" cy="17.5" r="1.25" className={AF} />
    </>
  ),
  // Concentric rings: the message's intent pinned down
  intent: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.75" className={AF} />
    </>
  ),
  // Message frame with a drafted line and an assist node
  assistant: (
    <>
      <path d="M4 4.5h12A1.5 1.5 0 0 1 17.5 6v6a1.5 1.5 0 0 1-1.5 1.5h-6L6 17v-3.5H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5z" />
      <path d="M6 8.5h7.5M6 11h4.5" />
      <circle cx="19.5" cy="18" r="2" className={AF} />
    </>
  ),
  // Vertical route with dated entries
  timeline: (
    <>
      <path d="M6 3.5v17" />
      <circle cx="6" cy="6.5" r="1.25" />
      <circle cx="6" cy="12" r="1.25" />
      <circle cx="6" cy="17.5" r="2" className={AF} />
      <path d="M10 6.5h9.5M10 12h6.5M10 17.5h8" />
    </>
  ),
  // Bell with an alert node
  bell: (
    <>
      <path d="M6 10.5a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
      <circle cx="18.5" cy="5" r="2" className={AF} />
    </>
  ),
  // KPI line rising across nodes
  analytics: (
    <>
      <path d="M3.5 20h17" />
      <path d="M4.5 16 9 11.5l3.5 3L19 7.5" />
      <circle cx="9" cy="11.5" r="1.25" />
      <circle cx="12.5" cy="14.5" r="1.25" />
      <circle cx="19" cy="7.5" r="2" className={AF} />
    </>
  ),
  // Quote sheet with line items and a total
  quote: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="1.5" />
      <path d="M8 7.5h8M8 11h8M8 16.5h3.5" />
      <circle cx="15.5" cy="16.5" r="1.75" className={AF} />
    </>
  ),
  // Arc between two nodes, current position marked
  tracking: (
    <>
      <path d="M3.5 18.5C6 11 13 6.5 20.5 5.5" />
      <circle cx="3.5" cy="18.5" r="1.25" />
      <circle cx="20.5" cy="5.5" r="1.25" />
      <circle cx="9.6" cy="10.6" r="2" className={AF} />
    </>
  ),
  // Browser frame with a shared link
  portal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
      <path d="M3 8.5h18" />
      <path d="M9 14.5h6M13 12.5l2 2-2 2" />
      <circle cx="8.5" cy="14.5" r="1.5" className={AF} />
    </>
  ),
  // Rate table with one rate selected
  rates: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M3.5 14.5h17M10 4.5v15" />
      <circle cx="15.25" cy="12" r="1.5" className={AF} />
    </>
  ),
  // Shield with a check
  compliance: (
    <>
      <path d="M12 3.5 5.5 6v5c0 4.5 3 7.5 6.5 9.5 3.5-2 6.5-5 6.5-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  // Document with fields, one checked
  docs: (
    <>
      <path d="M6.5 3h7.5l4 4v14h-11.5z" />
      <path d="M14 3v4h4M10 14h5M10 17h3" />
      <circle cx="10.5" cy="10.5" r="1.5" className={AF} />
    </>
  ),
  // Hub coordinating several routes
  forwarder: (
    <>
      <path d="M12 12 4.5 6M12 12l7.5-6M12 12v8" />
      <circle cx="4.5" cy="6" r="1.25" />
      <circle cx="19.5" cy="6" r="1.25" />
      <circle cx="12" cy="20" r="1.25" />
      <circle cx="12" cy="12" r="2.25" className={AF} />
    </>
  ),
  // Workflow segments in sequence
  operations: (
    <>
      <path d="M3 7h6v10h6V7h6" />
      <circle cx="3" cy="7" r="1.25" />
      <circle cx="21" cy="7" r="1.25" />
      <circle cx="12" cy="17" r="1.75" className={AF} />
    </>
  ),
  // Opportunity caught: rising route with arrowhead
  sales: (
    <>
      <path d="M3.5 20h17" />
      <path d="m5 16 4.5-4.5 3 3 7-7" />
      <path d="M15 7.5h4.5V12" />
      <circle cx="5" cy="16" r="1.75" className={AF} />
    </>
  ),
  // Small team, room to grow
  small: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <path d="M18 10v6M15 13h6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevron: <path d="m6 9.5 6 6 6-6" />,
}

export default function FwIcon({
  name,
  size = 24,
  className = "",
}: {
  name: FwIconName
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`flex-none ${className}`}
    >
      {icons[name]}
    </svg>
  )
}
