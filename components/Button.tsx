import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger" | "dark" | "ghost-inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center font-bold no-underline transition-colors disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "border border-ink bg-ink text-paper hover:border-brand hover:bg-brand",
  dark: "border border-ink bg-ink text-paper hover:border-brand hover:bg-brand",
  ghost: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
  "ghost-inverse": "border border-paper bg-transparent text-paper hover:bg-paper hover:text-ink",
  danger: "border border-brand bg-transparent text-brand hover:bg-brand hover:text-paper",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-[34px] px-4 text-[0.76rem]",
  md: "h-10 px-5 text-[0.86rem]",
  lg: "h-[46px] px-8 text-[0.92rem]",
};

export function buttonClasses(variant: ButtonVariant, size: ButtonSize = "md", extra = ""): string {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
