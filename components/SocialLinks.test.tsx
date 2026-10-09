import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocialLinks } from "./SocialLinks";

describe("SocialLinks", () => {
  it("renders one safe external link per network, named for the person", () => {
    render(
      <SocialLinks
        person="Test Member"
        links={[
          { network: "facebook", url: "https://www.facebook.com/t" },
          { network: "tiktok", url: "https://www.tiktok.com/@t" },
          { network: "linkedin", url: "https://www.linkedin.com/in/t" },
        ]}
      />,
    );
    const shapes = new Set<string>();
    for (const [name, href, network] of [
      ["Facebook: Test Member", "https://www.facebook.com/t", "facebook"],
      ["TikTok: Test Member", "https://www.tiktok.com/@t", "tiktok"],
      ["LinkedIn: Test Member", "https://www.linkedin.com/in/t", "linkedin"],
    ] as const) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      // The network's logo, not letters (owner decision 2026-10-08, ADR-047): decorative,
      // since the link's aria-label already names the network and the person.
      const logo = link.querySelector("svg");
      expect(logo, network).not.toBeNull();
      expect(logo).toHaveAttribute("aria-hidden", "true");
      expect(logo).toHaveAttribute("data-network", network);
      const shape = logo!.querySelector("path")?.getAttribute("d");
      expect(shape).toBeTruthy();
      shapes.add(shape!);
      expect(link).toHaveTextContent(/^$/);
    }
    // three different logos: a pasted-over path would show one network's mark on another
    expect(shapes.size).toBe(3);
  });

  it("renders nothing when the person has no links", () => {
    const { container } = render(<SocialLinks person="Test Member" links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
