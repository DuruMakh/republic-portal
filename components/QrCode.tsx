"use client";

import { renderSVG } from "uqr";

/**
 * QR of a URL as inline SVG. Safe to inline: uqr's renderSVG encodes the value
 * into QR geometry (paths/rects) — the input string is never reflected as
 * markup, so no caller-supplied value can inject content (ADR-011).
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
