import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger" | "dark" | "ghost-inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50";

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

const styles: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  ghost: "bg-transparent text-ink border border-line hover:bg-surface",
  danger: "bg-danger text-white hover:opacity-90",
  dark: "bg-navy text-white hover:bg-navy-dark",
  "ghost-inverse": "bg-transparent text-white border border-white/30 hover:bg-white/10",
};

export function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize = "md",
  extra = "",
): string {
  return `${base} ${sizes[size]} ${styles[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
