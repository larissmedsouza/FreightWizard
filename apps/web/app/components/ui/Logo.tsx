/**
 * Freightwizard logo (W mark + wordmark). Monochrome only:
 *  - "white" on dark grounds (top bar, landing, OG image)
 *  - "navy"  on light grounds (portal, quote preview, light pages); app ink #0B1B2B
 * Width and height are always set from the artwork's ratio, so it never stretches.
 * Source artwork: public/brand/freightwizard-logo-*.png (1114 × 141, trimmed).
 */
const RATIO = 1114 / 141;

export const BRAND_NAME = "Freightwizard";

export default function Logo({ tone = "white", height = 20, className = "" }: { tone?: "white" | "navy"; height?: number; className?: string }) {
  const width = Math.round(height * RATIO);
  return (
    <img
      src={`/brand/freightwizard-logo-${tone}.png`}
      alt={BRAND_NAME}
      width={width}
      height={height}
      style={{ width, height }}
      className={`block max-w-none shrink-0 ${className}`}
    />
  );
}
