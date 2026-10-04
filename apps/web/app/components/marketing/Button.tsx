import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"

/**
 * One button system for the landing page. 3px radius, flat fills, 44px minimum
 * tap target.
 *  - primary:   indigo-500 fill, white text (7.5:1); indigo-600 on hover (9.5:1).
 *  - secondary: 1px white-20% outline, ink text; raised fill on hover.
 */
export type ButtonVariant = "primary" | "secondary"

const base =
  "inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-fw-btn px-5 text-fw-small font-semibold whitespace-nowrap transition-colors duration-200 ease-calm"

const styles: Record<ButtonVariant, string> = {
  primary: "bg-fw-indigo-500 text-fw-white hover:bg-fw-indigo-600",
  secondary: "border border-fw-line-strong text-fw-ink hover:border-fw-ink-3 hover:bg-fw-raised",
}

export function buttonClass(variant: ButtonVariant = "primary", className = "") {
  return `${base} ${styles[variant]} ${className}`
}

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonVariant
  className?: string
  children: ReactNode
}

export function ButtonLink({ variant = "primary", className = "", ...props }: LinkButtonProps) {
  return <Link {...props} className={buttonClass(variant, className)} />
}
