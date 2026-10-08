import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotFoundNotice } from "./NotFoundNotice";

describe("NotFoundNotice", () => {
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
});
