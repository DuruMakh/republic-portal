"use client";

import { renderSVG } from "uqr";

/**
 * QR of a URL as inline SVG. The markup comes from uqr (pure, zero-dep —
 * ADR-011) applied to our own value, never to user input, so inlining is safe.
 */
export function QrCode({
  value,
  label,
  size = 200,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const svg = renderSVG(value);
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size }}
      className="mx-auto overflow-hidden rounded-lg border border-line bg-white p-2 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
