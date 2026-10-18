import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Existing isolated component tests have no app layout. English tests use the real provider.
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useLocale: () => {
      try {
        return actual.useLocale();
      } catch {
        return "ka";
      }
    },
  };
});
vi.mock("next-intl/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl/server")>();
  return { ...actual, getLocale: async () => "ka" };
});

// Mutable prefers-reduced-motion flag backing the matchMedia stub below.
// Defaults to true (reduced motion) so existing tests keep today's
// animation-free behavior unchanged; a test that needs to exercise the real
// animation path calls __setPrefersReducedMotion(false), and the afterEach
// below resets the flag so the override never leaks into the next test.
let prefersReducedMotion = true;

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query.includes("prefers-reduced-motion") ? prefersReducedMotion : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

(globalThis as Record<string, unknown>).__setPrefersReducedMotion = (value: boolean) => {
  prefersReducedMotion = value;
};

afterEach(() => {
  prefersReducedMotion = true;
  cleanup();
});
