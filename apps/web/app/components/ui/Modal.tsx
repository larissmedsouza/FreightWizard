import type { ReactNode } from "react"
import Icon, { type IconName } from "./Icon"

const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }

/**
 * Modal shell: theme overlay, flat panel with 1px border and 4px radius,
 * one subtle shadow. Children render inside the body.
 */
export default function Modal({
  title,
  icon,
  onClose,
  size = "md",
  children,
  footer,
  className = "",
  align = "center",
}: {
  title: ReactNode
  icon?: IconName
  onClose: () => void
  size?: keyof typeof widths
  children: ReactNode
  footer?: ReactNode
  className?: string
  align?: "center" | "bottom-right"
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex bg-app-overlay p-4 ${align === "center" ? "items-center justify-center" : "items-end justify-end"}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[90vh] w-full ${widths[size]} flex-col rounded-fw-card border border-app-line bg-app-card text-app-ink shadow-app-pop ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-app-line px-5 py-3.5">
          <h3 className="flex items-center gap-2 font-fw-display text-app-title-sm font-normal">
            {icon && <Icon name={icon} size={18} className="text-app-accent" />}
            {title}
          </h3>
          <button onClick={onClose} aria-label="Close" className="flex size-7 items-center justify-center rounded-fw-btn text-app-ink-3 hover:bg-app-raised hover:text-app-ink">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-app-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}
