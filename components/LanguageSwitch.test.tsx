import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { EnglishShownProvider } from "./EnglishShown";
import { LanguageSwitch } from "./LanguageSwitch";

vi.mock("next/navigation", () => ({ usePathname: () => "/about" }));

function inGeorgian(children: ReactNode) {
  return (
    <NextIntlClientProvider locale="ka" messages={{}}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("LanguageSwitch", () => {
  it("renders nothing while English is hidden", () => {
    const { container } = render(
      inGeorgian(
        <EnglishShownProvider shown={false}>
          <LanguageSwitch />
        </EnglishShownProvider>,
      ),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no layout has said English is on", () => {
    const { container } = render(inGeorgian(<LanguageSwitch />));
    expect(container).toBeEmptyDOMElement();
  });

  it("offers both languages once English is on", () => {
    window.history.replaceState(null, "", "/about");
    const { container } = render(
      inGeorgian(
        <EnglishShownProvider shown>
          <LanguageSwitch />
        </EnglishShownProvider>,
      ),
    );
    expect(container).toHaveTextContent("KA");
    expect(container.querySelector('a[hreflang="en"]')).toHaveAttribute("href", "/en/about");
  });
});
