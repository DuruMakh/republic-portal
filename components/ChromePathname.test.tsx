import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/news/a/b" }));

import { PinChromePathname, useChromePathname } from "./ChromePathname";

function Probe() {
  const pathname = useChromePathname();
  return <p data-testid="path">{pathname}</p>;
}

describe("useChromePathname", () => {
  it("is the live path when nothing pins it", () => {
    render(<Probe />);
    expect(screen.getByTestId("path")).toHaveTextContent("/news/a/b");
  });

  it("is the pinned path inside PinChromePathname, whatever the live path is", () => {
    render(
      <PinChromePathname pathname="/_not-found">
        <Probe />
      </PinChromePathname>,
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/_not-found");
  });
});
