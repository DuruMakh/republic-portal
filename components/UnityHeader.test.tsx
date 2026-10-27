import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnityHeader } from "./UnityHeader";

let pathname = "/";
vi.mock("@/components/ChromePathname", () => ({ useChromePathname: () => pathname }));
vi.mock("@/components/useSignedIn", () => ({ useSignedIn: () => false }));
vi.mock("@/components/LanguageSwitch", () => ({ LanguageSwitch: () => null }));

describe("UnityHeader", () => {
  it("closes on pathname changes and releases body scroll and focus", () => {
    const props = {
      navItems: [{ href: "/about", label: "ჩვენ შესახებ" }],
      eventsShown: false,
      ratingsShown: false,
    };
    const { rerender } = render(<UnityHeader {...props} />);
    const trigger = screen.getByRole("button", { name: "მენიუ" });
    expect(trigger).not.toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    pathname = "/about";
    rerender(<UnityHeader {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(trigger).toHaveFocus();
  });
});
