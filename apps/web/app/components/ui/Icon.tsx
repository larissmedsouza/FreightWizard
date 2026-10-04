/**
 * FreightWizard line icons, in the FreightGuild style: route motif, one
 * continuous stroke where possible, round caps and joins, node dots and one
 * filled "accent" node. 24px grid, 1.5px stroke everywhere. Single colour via
 * currentColor. One set for the whole product: landing page and app.
 */
import type { ReactNode } from "react"

// Accent node: filled with the current colour.
const AF = { className: "fill-current stroke-none" }

const icons = {
  // Message frame with a route running into it
  email: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3.5 7 12 13l8.5-6" />
      <circle cx="12" cy="13" r="1.75" {...AF} />
    </>
  ),
  // One input routed to the right next step
  workflow: (
    <>
      <path d="M4 12h5l5-5h6M9 12l5 5h6" />
      <circle cx="4" cy="12" r="1.25" />
      <circle cx="20" cy="7" r="1.25" />
      <circle cx="20" cy="17" r="2" {...AF} />
    </>
  ),
  // Route returning to its origin
  reply: (
    <>
      <path d="M20.5 18v-3a5 5 0 0 0-5-5H5" />
      <path d="M8.5 6.5 5 10l3.5 3.5" />
      <circle cx="20.5" cy="18" r="1.75" {...AF} />
    </>
  ),
  // Inbox tray with the top item lifted out
  priority: (
    <>
      <path d="M3.5 13.5 6 5.5h12l2.5 8v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M3.5 13.5h5l1 2h5l1-2h5" />
      <circle cx="12" cy="9.5" r="1.75" {...AF} />
    </>
  ),
  // Document with a field routed out of it
  extract: (
    <>
      <path d="M12.5 21h-6V3h7.5l4 4v5.5" />
      <path d="M14 3v4h4M9.5 10.5h5M9.5 14h3" />
      <path d="M15.5 17.5h6M19 15l2.5 2.5L19 20" />
      <circle cx="15.5" cy="17.5" r="1.25" {...AF} />
    </>
  ),
  // Concentric rings: the message's intent pinned down
  intent: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.75" {...AF} />
    </>
  ),
  // Message frame with a drafted line and an assist node
  assistant: (
    <>
      <path d="M4 4.5h12A1.5 1.5 0 0 1 17.5 6v6a1.5 1.5 0 0 1-1.5 1.5h-6L6 17v-3.5H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5z" />
      <path d="M6 8.5h7.5M6 11h4.5" />
      <circle cx="19.5" cy="18" r="2" {...AF} />
    </>
  ),
  // Vertical route with dated entries
  timeline: (
    <>
      <path d="M6 3.5v17" />
      <circle cx="6" cy="6.5" r="1.25" />
      <circle cx="6" cy="12" r="1.25" />
      <circle cx="6" cy="17.5" r="2" {...AF} />
      <path d="M10 6.5h9.5M10 12h6.5M10 17.5h8" />
    </>
  ),
  // Bell with an alert node
  bell: (
    <>
      <path d="M6 10.5a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
      <circle cx="18.5" cy="5" r="2" {...AF} />
    </>
  ),
  // KPI line rising across nodes
  analytics: (
    <>
      <path d="M3.5 20h17" />
      <path d="M4.5 16 9 11.5l3.5 3L19 7.5" />
      <circle cx="9" cy="11.5" r="1.25" />
      <circle cx="12.5" cy="14.5" r="1.25" />
      <circle cx="19" cy="7.5" r="2" {...AF} />
    </>
  ),
  // Quote sheet with line items and a total
  quote: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="1.5" />
      <path d="M8 7.5h8M8 11h8M8 16.5h3.5" />
      <circle cx="15.5" cy="16.5" r="1.75" {...AF} />
    </>
  ),
  // Arc between two nodes, current position marked
  tracking: (
    <>
      <path d="M3.5 18.5C6 11 13 6.5 20.5 5.5" />
      <circle cx="3.5" cy="18.5" r="1.25" />
      <circle cx="20.5" cy="5.5" r="1.25" />
      <circle cx="9.6" cy="10.6" r="2" {...AF} />
    </>
  ),
  // Browser frame with a shared link
  portal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
      <path d="M3 8.5h18" />
      <path d="M9 14.5h6M13 12.5l2 2-2 2" />
      <circle cx="8.5" cy="14.5" r="1.5" {...AF} />
    </>
  ),
  // Rate table with one rate selected
  rates: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M3.5 14.5h17M10 4.5v15" />
      <circle cx="15.25" cy="12" r="1.5" {...AF} />
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
      <circle cx="10.5" cy="10.5" r="1.5" {...AF} />
    </>
  ),
  // Hub coordinating several routes
  forwarder: (
    <>
      <path d="M12 12 4.5 6M12 12l7.5-6M12 12v8" />
      <circle cx="4.5" cy="6" r="1.25" />
      <circle cx="19.5" cy="6" r="1.25" />
      <circle cx="12" cy="20" r="1.25" />
      <circle cx="12" cy="12" r="2.25" {...AF} />
    </>
  ),
  // Workflow segments in sequence
  operations: (
    <>
      <path d="M3 7h6v10h6V7h6" />
      <circle cx="3" cy="7" r="1.25" />
      <circle cx="21" cy="7" r="1.25" />
      <circle cx="12" cy="17" r="1.75" {...AF} />
    </>
  ),
  // Opportunity caught: rising route with arrowhead
  sales: (
    <>
      <path d="M3.5 20h17" />
      <path d="m5 16 4.5-4.5 3 3 7-7" />
      <path d="M15 7.5h4.5V12" />
      <circle cx="5" cy="16" r="1.75" {...AF} />
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
  /* ---- App UI ------------------------------------------------------- */
  // Inbox tray
  inbox: (
    <>
      <path d="M3.5 13.5 6 5.5h12l2.5 8v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M3.5 13.5h5l1 2h5l1-2h5" />
    </>
  ),
  // Stack of messages
  mail: (
    <>
      <rect x="3" y="7" width="15" height="11" rx="1.5" />
      <path d="M3.5 8.5 10.5 13l7-4.5" />
      <path d="M6 4.5h13.5A1.5 1.5 0 0 1 21 6v9.5" />
    </>
  ),
  // Pen over a line
  compose: (
    <>
      <path d="M4 20h7" />
      <path d="M14.5 4.5a2.1 2.1 0 0 1 3 3L8 17l-4 1 1-4z" />
    </>
  ),
  // Route leaving towards a node
  send: (
    <>
      <path d="M3.5 12h12" />
      <path d="m12 7.5 4.5 4.5-4.5 4.5" />
      <circle cx="20" cy="12" r="1.75" {...AF} />
    </>
  ),
  // Sheet with folded corner and dashed draft lines
  draft: (
    <>
      <path d="M13.5 3H6.5v18h11V7z" />
      <path d="M13.5 3v4h4" />
      <path d="M9.5 13h5M9.5 16.5h3" strokeDasharray="1.5 2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M17.5 3v3.8h-3.8" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  "chevron-right": <path d="m9.5 6 6 6-6 6" />,
  "chevron-left": <path d="m14.5 6-6 6 6 6" />,
  "chevron-up": <path d="m6 14.5 6-6 6 6" />,
  "arrow-right": (
    <>
      <path d="M4 12h15" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M20 12H5" />
      <path d="m10 7-5 5 5 5" />
    </>
  ),
  external: (
    <>
      <path d="M13.5 4.5h6v6M19.5 4.5 11 13" />
      <path d="M17.5 14v5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5" />
      <path d="M6 6.5 7 20h10l1-13.5M10 10.5v6M14 10.5v6" />
    </>
  ),
  restore: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M6.5 3v3.8h3.8" />
      <path d="M12 8.5V12l2.5 1.5" />
    </>
  ),
  folder: <path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2h8.5A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />,
  "folder-plus": (
    <>
      <path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2h8.5A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
      <path d="M12 11v5M9.5 13.5h5" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 4.5v6.8l9 9 7.8-7.8-9-9H4.5a1 1 0 0 0-1 1z" />
      <circle cx="8" cy="8.5" r="1.5" {...AF} />
    </>
  ),
  flag: (
    <>
      <path d="M5.5 21V4" />
      <path d="M5.5 4.5h12l-2.5 4 2.5 4h-12" />
    </>
  ),
  // Transport modes: route motif, no vehicles
  ocean: (
    <>
      <path d="M2.5 16.5c5-5 14-5 19 0" />
      <path d="M2.5 20h19" strokeDasharray="1.5 2.5" />
      <circle cx="2.5" cy="16.5" r="1.25" />
      <circle cx="21.5" cy="16.5" r="2" {...AF} />
    </>
  ),
  air: (
    <>
      <path d="M2.5 18.5C5 6 19 6 21.5 18.5" strokeDasharray="1.5 2.5" />
      <path d="M2.5 20.5h19" />
      <circle cx="2.5" cy="18.5" r="1.25" />
      <circle cx="21.5" cy="18.5" r="2" {...AF} />
    </>
  ),
  road: (
    <>
      <path d="M2.5 17h19" />
      <path d="M4 13h16" strokeDasharray="3 3" />
      <circle cx="2.5" cy="17" r="1.25" />
      <circle cx="21.5" cy="17" r="2" {...AF} />
    </>
  ),
  rail: (
    <>
      <path d="M2.5 14h19M2.5 18h19" />
      <path d="M5.5 12v8M10 12v8M14.5 12v8M19 12v8" />
      <circle cx="12" cy="7.5" r="2" {...AF} />
    </>
  ),
  booking: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="m9 14.5 2 2 4-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <circle cx="15.5" cy="15" r="1.5" {...AF} />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="9" r="2.25" />
      <path d="M16 14.6c2.9 0 4.5 2 4.5 4.9" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
    </>
  ),
  // Owner: person with a check (responsible)
  owner: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.9 2.9-6.5 6.5-6.5 1.4 0 2.6.3 3.7.9" />
      <path d="m15 18 2 2 4-4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  queue: (
    <>
      <path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" />
      <circle cx="4.5" cy="6.5" r="1.25" />
      <circle cx="4.5" cy="12" r="1.25" />
      <circle cx="4.5" cy="17.5" r="1.25" {...AF} />
    </>
  ),
  note: (
    <>
      <path d="M5 4h14v11l-5 5H5z" />
      <path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4" />
    </>
  ),
  // One-click action
  bolt: <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />,
  // AI: four-point mark with a node
  sparkle: (
    <>
      <path d="M12 3.5c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z" />
      <circle cx="19" cy="4.5" r="1.25" {...AF} />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.25" r="1" {...AF} />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.75" r="1" {...AF} />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  attach: <path d="m19 11.5-7.4 7.4a4.5 4.5 0 0 1-6.4-6.4l7.8-7.8a3 3 0 0 1 4.2 4.2l-7.6 7.6a1.5 1.5 0 0 1-2.1-2.1L14.5 7.5" />,
  signature: (
    <>
      <path d="M3.5 20h17" />
      <path d="M4 15.5c2-4 4-7.5 5.5-7.5 2 0-1 7 1 7 1.5 0 2.5-3 4-3 1.2 0 1 2 2.5 2s2-1 2.5-1.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.3 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.3-3.5-8.5s1-6 3.5-8.5z" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.5" cy="6.5" r="1" {...AF} />
      <circle cx="4.5" cy="12" r="1" {...AF} />
      <circle cx="4.5" cy="17.5" r="1" {...AF} />
    </>
  ),
  "list-numbered": (
    <>
      <path d="M10 6.5h10M10 12h10M10 17.5h10" />
      <path d="M4 5.5 5.5 4.5v4M3.5 14.5c.4-.6 1-1 1.7-1 .8 0 1.3.5 1.3 1.1 0 1-3 2.1-3 3.4h3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11.5M7.5 11 12 15.5l4.5-4.5" />
      <path d="M4 15.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="1.5" />
      <path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5" />
    </>
  ),
  edit: (
    <>
      <path d="M14.5 4.5a2.1 2.1 0 0 1 3 3L8 17l-4 1 1-4z" />
      <path d="M12.5 6.5l3 3" />
    </>
  ),
  filter: <path d="M3.5 5h17l-6.5 7.5V19l-4 1.5v-8z" />,
  // Settings: three sliders (distinct from the sun icon)
  settings: (
    <>
      <path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1" />
      <circle cx="15" cy="6.5" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  logout: (
    <>
      <path d="M14 4.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14" />
      <path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.5" {...AF} />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.5" />
      <path d="M11.2 11.8 20 3M16.5 6.5l2.5 2.5M14 9l2 2" />
    </>
  ),
  plug: (
    <>
      <path d="M8.5 3v4.5M15.5 3v4.5" />
      <path d="M6 7.5h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 16.5V21" />
    </>
  ),
  building: (
    <>
      <path d="M4.5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14.5 10h4a1 1 0 0 1 1 1v10M3 21h18" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </>
  ),
  "credit-card": (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3 10h18M6.5 15h4" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />,
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.25" {...AF} />
    </>
  ),
  container: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1" />
      <path d="M6.5 6.5v11M10.5 6.5v11M14.5 6.5v11M18.5 6.5v11" />
    </>
  ),
  compare: (
    <>
      <rect x="3" y="4" width="7.5" height="16" rx="1" />
      <rect x="13.5" y="4" width="7.5" height="16" rx="1" />
      <path d="M5.5 8h2.5M16 8h2.5M5.5 15.5h2.5M16 15.5h2.5M5.5 11.75h2.5M16 11.75h2.5" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="3" {...AF} />,
  pause: <path d="M8.5 5v14M15.5 5v14" />,
  play: <path d="M7 4.5v15l12-7.5z" />,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.25" {...AF} />
      <circle cx="12" cy="12" r="1.25" {...AF} />
      <circle cx="18.5" cy="12" r="1.25" {...AF} />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevron: <path d="m6 9.5 6 6 6-6" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof icons

export const isIconName = (name: string): name is IconName => Object.prototype.hasOwnProperty.call(icons, name)

/**
 * Folders/labels saved before the restyle stored an emoji as their icon (in
 * localStorage). Render those with the matching line icon instead.
 */
const LEGACY_EMOJI: Record<string, IconName> = {
  "🏷️": "tag", "📌": "pin", "⭐": "star", "🔖": "tag", "📎": "attach",
  "🗂️": "folder", "✅": "check", "🔔": "bell", "💼": "building", "🌟": "star",
}
export function toIconName(stored: string | undefined | null, fallback: IconName = "tag"): IconName {
  if (!stored) return fallback
  if (isIconName(stored)) return stored
  return LEGACY_EMOJI[stored] || fallback
}

export default function Icon({
  name,
  size = 24,
  className = "",
}: {
  name: IconName
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
