/**
 * On/off switch. Square (3px) track and knob to match the app's shape rules;
 * indigo fill when on. Exposes role="switch" + aria-checked.
 */
export default function Toggle({
  checked,
  onChange,
  label,
  className = "",
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 flex-shrink-0 rounded-fw-btn border transition-colors disabled:opacity-50 ${
        checked ? "border-app-accent-fill bg-app-accent-fill" : "border-app-line-strong bg-app-raised"
      } ${className}`}
    >
      <span
        aria-hidden
        className={`absolute left-0.5 top-0.5 size-3.5 rounded-[2px] transition-transform ${checked ? "translate-x-4 bg-app-on-accent" : "translate-x-0 bg-app-ink-3"}`}
      />
    </button>
  )
}
