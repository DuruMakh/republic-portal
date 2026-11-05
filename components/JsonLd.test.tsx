import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonLd } from "./JsonLd";

describe("JsonLd", () => {
  it("cannot be broken out of by text inside the data", () => {
    const headline = "</script><script>alert(1)</script><!--";
    const { container } = render(
      <JsonLd data={{ "@context": "https://schema.org", "@type": "NewsArticle", headline }} />,
    );
    const scripts = container.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.getAttribute("type")).toBe("application/ld+json");
    const text = scripts[0]!.textContent ?? "";
    expect(text).not.toContain("<");
    expect(JSON.parse(text).headline).toBe(headline);
  });

  it("writes a list of objects as one array", () => {
    const { container } = render(
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "Organization" },
          { "@context": "https://schema.org", "@type": "WebSite" },
        ]}
      />,
    );
    const parsed = JSON.parse(container.querySelector("script")!.textContent ?? "");
    expect(parsed.map((o: { "@type": string }) => o["@type"])).toEqual(["Organization", "WebSite"]);
  });
});
