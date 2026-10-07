import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"
import Icon, { type IconName } from "./Icon"

/**
 * One button system for the app. 3px radius, flat fills, no gradients.
 *  - primary:   indigo-500 fill, white text (7.5:1); indigo-600 hover (9.5:1)
 *  - secondary: 1px outline, ink text, raised fill on hover
 *  - ghost:     no border; muted text, raised fill on hover (toolbars)
 *  - danger:    outline with danger text, tinted on hover (destructive actions)
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm"

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-fw-btn font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed"

const variants: Record<ButtonVariant, string> = {
  // Disabled primary goes neutral rather than a faded indigo
  primary: "bg-app-accent-fill text-app-on-accent hover:bg-app-accent-hover disabled:bg-app-raised disabled:text-app-ink-3 disabled:hover:bg-app-raised",
  secondary: "border border-app-line-strong bg-app-card text-app-ink hover:bg-app-raised disabled:opacity-50",
  ghost: "text-app-ink-2 hover:bg-app-raised hover:text-app-ink disabled:opacity-50",
  danger: "border border-app-line-strong bg-app-card text-app-danger-ink hover:bg-app-danger-bg disabled:opacity-50",
}

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-app-ui-sm",
  sm: "h-8 px-3 text-app-ui-sm",
  md: "h-9 px-4 text-app-ui",
  lg: "h-11 px-5 text-app-ui",
  icon: "size-9",
  "icon-sm": "size-7",
}

const iconSize: Record<ButtonSize, number> = { xs: 14, sm: 15, md: 16, lg: 18, icon: 18, "icon-sm": 15 }

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; icon?: IconName; iconRight?: IconName; children?: ReactNode }

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  className = "",
  type = "button",
  children,
  ...props
}: Common & Omit<ComponentProps<"button">, "children">) {
  return (
    <button type={type} {...props} className={buttonClass(variant, size, className)}>
      {icon && <Icon name={icon} size={iconSize[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize[size]} />}
    </button>
  )
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  className = "",
  children,
  ...props
}: Common & Omit<ComponentProps<typeof Link>, "children" | "className"> & { className?: string }) {
  return (
    <Link {...props} className={buttonClass(variant, size, className)}>
      {icon && <Icon name={icon} size={iconSize[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize[size]} />}
    </Link>
  )
}

/** Small spinner that inherits the current text colour. */
export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
}
