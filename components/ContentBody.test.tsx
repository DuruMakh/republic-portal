import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentBody } from "./ContentBody";

describe("ContentBody", () => {
  it("renders one <p> per paragraph", () => {
    const { container } = render(<ContentBody body={"პირველი.\n\nმეორე."} />);
    const ps = container.querySelectorAll("p");
    expect(ps).toHaveLength(2);
    expect(ps[0]).toHaveTextContent("პირველი.");
    expect(ps[1]).toHaveTextContent("მეორე.");
  });

  it("renders links with safe rel/target and the URL as text", () => {
    render(<ContentBody body="ნახე https://example.ge/x დღეს." />);
    const link = screen.getByRole("link", { name: "https://example.ge/x" });
    expect(link).toHaveAttribute("href", "https://example.ge/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("appends custom className to the wrapper", () => {
    const { container } = render(<ContentBody body="ა" className="text-lg" />);
    expect(container.firstElementChild).toHaveClass("text-lg");
  });
});
