import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "./ButtonLink";

describe("ButtonLink", () => {
  it("renders a link styled as the primary button", () => {
    render(<ButtonLink href="/join">გახდი წევრი</ButtonLink>);
    const link = screen.getByRole("link", { name: "გახდი წევრი" });
    expect(link.getAttribute("href")).toBe("/join");
    expect(link.className).toContain("bg-ink");
    expect(link.className).toContain("hover:bg-brand");
  });
  it("supports the dark variant", () => {
    render(
      <ButtonLink href="/leaderboard" variant="dark">
        რეიტინგი
      </ButtonLink>,
    );
    expect(screen.getByRole("link", { name: "რეიტინგი" }).className).toContain("bg-ink");
  });
  it("supports the ghost-inverse variant for dark backgrounds", () => {
    render(
      <ButtonLink href="/join" variant="ghost-inverse">
        დელეგატი
      </ButtonLink>,
    );
    expect(screen.getByRole("link", { name: "დელეგატი" }).className).toContain("text-paper");
    expect(screen.getByRole("link", { name: "დელეგატი" }).className).toContain("border-paper");
  });
  it("supports the sm size without leaking md padding", () => {
    render(
      <ButtonLink href="/x" size="sm">
        შესვლა
      </ButtonLink>,
    );
    const cls = screen.getByRole("link", { name: "შესვლა" }).className;
    expect(cls).toContain("h-[34px]");
    expect(cls).toContain("px-4");
    expect(cls).not.toContain("px-5");
  });
});
