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
    for (const [name, href, mark] of [
      ["Facebook: Test Member", "https://www.facebook.com/t", "fb"],
      ["TikTok: Test Member", "https://www.tiktok.com/@t", "tt"],
      ["LinkedIn: Test Member", "https://www.linkedin.com/in/t", "in"],
    ] as const) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveTextContent(mark);
    }
  });

  it("renders nothing when the person has no links", () => {
    const { container } = render(<SocialLinks person="Test Member" links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
