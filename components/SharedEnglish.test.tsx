import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicError from "@/app/[locale]/(unity)/error";
import OfflinePage from "@/app/[locale]/offline/page";
import { CopyButton } from "./CopyButton";
import { Masthead } from "./Masthead";
import { MobileTabBar } from "./MobileTabBar";
import { Pill } from "./Pill";
import { UnityHeader } from "./UnityHeader";
import { UnityJoinBar } from "./UnityJoinBar";
import { UnityNotFoundNotice } from "./UnityNotice";

const { currentPath } = vi.hoisted(() => ({ currentPath: { value: "/en" } }));
vi.mock("next/navigation", () => ({ usePathname: () => currentPath.value }));
vi.mock("@/components/useSignedIn", () => ({ useSignedIn: () => false }));
vi.mock("@/components/useSignOut", () => ({ useSignOut: () => vi.fn() }));

function english(children: ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={{}}>
      {children}
    </NextIntlClientProvider>
  );
}

const navItems = [
  { href: "/", label: "მთავარი" },
  { href: "/about", label: "ჩვენ შესახებ" },
];

describe("English shared chrome", () => {
  beforeEach(() => {
    currentPath.value = "/en";
    window.history.replaceState(null, "", "/en");
  });

  it("keeps public navigation and account entry in English", () => {
    currentPath.value = "/en/about";
    render(english(<UnityHeader navItems={navItems} eventsShown={false} ratingsShown={false} />));
    expect(screen.getByRole("link", { name: "About us" })).toHaveAttribute("href", "/en/about");
    expect(screen.getByRole("link", { name: "About us" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Join us" })).toHaveAttribute("href", "/en/join");
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Georgian Republic");
  });

  it("switches the real current address with referral details and an updated section anchor", () => {
    currentPath.value = "/en/about";
    window.history.replaceState(null, "", "/en/about?ref=AB2C3D#principles");
    render(english(<UnityHeader navItems={navItems} eventsShown={false} ratingsShown={false} />));
    const georgian = screen.getByRole("link", { name: "ქართული" });
    expect(georgian).toHaveAttribute("href", "/about?ref=AB2C3D#principles");
    expect(georgian).toHaveAttribute("hrefLang", "ka");
    act(() => {
      window.history.replaceState(null, "", "/en/about?ref=AB2C3D#agreement");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(georgian).toHaveAttribute("href", "/about?ref=AB2C3D#agreement");
  });

  it("offers translated mobile menu links and a language choice", () => {
    render(english(<UnityHeader navItems={navItems} eventsShown={false} ratingsShown={false} />));
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = within(screen.getByRole("dialog", { name: "Menu" }));
    expect(menu.getByRole("link", { name: "About us" })).toHaveAttribute("href", "/en/about");
    expect(menu.getByRole("link", { name: "ქართული" })).toHaveAttribute("href", "/");
  });

  it("returns to the Georgian homepage while keeping homepage referral details", () => {
    window.history.replaceState(null, "", "/en?ref=AB2C3D#goal");
    render(english(<UnityHeader navItems={navItems} eventsShown={false} ratingsShown={false} />));
    expect(screen.getByRole("link", { name: "ქართული" })).toHaveAttribute(
      "href",
      "/?ref=AB2C3D#goal",
    );
  });

  it("keeps the English join page free of the repeated join bar", () => {
    currentPath.value = "/en/join";
    render(english(<UnityJoinBar />));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("marks the matching English account tab and preserves administrative destinations", () => {
    currentPath.value = "/en/me/profile";
    render(
      english(
        <MobileTabBar
          tabs={[{ href: "/me/profile", label: "პროფილი" }]}
          more={[{ href: "/admin", label: "ადმინისტრირება" }]}
        />,
      ),
    );
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/en/me/profile");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
  });

  it("does not add an English switch to the Georgian administration header", () => {
    currentPath.value = "/admin";
    render(<Masthead navItems={[]} cta={null} tag="ადმინისტრირება" />);
    expect(screen.queryByRole("link", { name: "English" })).not.toBeInTheDocument();
  });
});

describe("English shared notices", () => {
  it("offers an English explanation and an English way home for missing pages", () => {
    render(english(<UnityNotFoundNotice />));
    expect(screen.getByRole("heading", { name: "Page not found." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to the homepage" })).toHaveAttribute(
      "href",
      "/en",
    );
  });

  it("lets visitors retry a failed page using English controls", () => {
    const reset = vi.fn();
    render(english(<PublicError error={new Error("temporary")} reset={reset} />));
    expect(screen.getByRole("heading", { name: "Temporary interruption" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("explains the offline state in English", () => {
    render(english(<OfflinePage />));
    expect(screen.getByRole("heading", { name: "You are offline" })).toBeInTheDocument();
  });

  it("confirms a clipboard copy in English", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(english(<CopyButton text="https://example.org/en/join?ref=AB2C3D" />));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copied ✓" })).toBeInTheDocument();
  });

  it("translates the default account status", () => {
    render(english(<Pill status="registered" />));
    expect(screen.getByText("Supporter")).toBeInTheDocument();
  });
});
