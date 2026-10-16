import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnityNotFoundNotice, UnityNotice } from "./UnityNotice";

describe("UnityNotice", () => {
  it("is the page's main landmark, named by its heading", () => {
    render(<UnityNotice title="დროებითი შეფერხება" description="სცადე თავიდან." />);
    expect(screen.getByRole("main", { name: "დროებითი შეფერხება" })).toBeInTheDocument();
    expect(screen.getByText("სცადე თავიდან.")).toBeInTheDocument();
  });

  it("carries the „ერთობა“ fonts itself, for error pages outside the ერთობა layout", () => {
    render(<UnityNotice title="დროებითი შეფერხება" />);
    expect(screen.getByRole("main")).toHaveClass("unity-fonts");
  });
});

describe("UnityNotFoundNotice", () => {
  it("says the page is missing and offers the way home", () => {
    render(<UnityNotFoundNotice />);
    expect(
      screen.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "დაბრუნდი მთავარ გვერდზე" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
