import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/content/events" }));

import { ContentNav } from "./ContentNav";

describe("ContentNav", () => {
  it("renders the three sections and marks the active one", () => {
    render(<ContentNav eventsShown />);
    expect(screen.getByRole("link", { name: "სიახლეები" })).toHaveAttribute(
      "href",
      "/admin/content/news",
    );
    expect(screen.getByRole("link", { name: "ღონისძიებები" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "გამოკითხვები" })).not.toHaveAttribute("aria-current");
  });

  it("active section has the brand underline classes, not the old pill highlight", () => {
    const { container } = render(<ContentNav eventsShown />);
    const active = container.querySelector<HTMLAnchorElement>('a[href="/admin/content/events"]');
    expect(active!.className).toContain("border-brand");
    expect(active!.className).not.toContain("bg-brand/10");
    const inactive = container.querySelector<HTMLAnchorElement>('a[href="/admin/content/news"]');
    expect(inactive!.className).not.toContain("bg-brand/10");
    expect(inactive!.className).toContain("text-ink");
  });

  it("leaves out the events section while events are hidden (ADR-042)", () => {
    const { container } = render(<ContentNav eventsShown={false} />);
    expect(screen.queryByRole("link", { name: "ღონისძიებები" })).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/content/events"]')).toBeNull();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/admin/content/news",
      "/admin/content/polls",
    ]);
  });
});
