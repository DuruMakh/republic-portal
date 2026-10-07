import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NOT_FOUND_METADATA, NotFoundNotice } from "./NotFoundNotice";

describe("NotFoundNotice", () => {
  it("says in Georgian that the page was not found", () => {
    render(<NotFoundNotice />);
    expect(
      screen.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა." }),
    ).toBeInTheDocument();
    expect(screen.getByText("ბმული შეიძლება მოძველდა ან არასწორად ჩაიწერა.")).toBeInTheDocument();
  });

  it("offers exactly one way out: back to the home page", () => {
    render(<NotFoundNotice />);
    expect(screen.getByRole("link", { name: "დაბრუნდი მთავარ გვერდზე" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows no English text at all (the framework default is English)", () => {
    const { container } = render(<NotFoundNotice />);
    expect(container.textContent).not.toMatch(/[A-Za-z]/);
  });

  it("titles the browser tab in Georgian, with the site name", () => {
    expect(NOT_FOUND_METADATA.title).toBe("გვერდი ვერ მოიძებნა — ქართული რესპუბლიკა");
  });
});
