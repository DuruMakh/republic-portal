import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicNotFound from "./not-found";

describe("public not-found page", () => {
  it("shows the Georgian notice (the site header and footer come from the public layout)", () => {
    render(<PublicNotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "დაბრუნდი მთავარ გვერდზე" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
