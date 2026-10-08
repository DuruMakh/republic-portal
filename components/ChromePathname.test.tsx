import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

import { PinChromePathname, useChromePathname } from "./ChromePathname";

function Probe() {
  const pathname = useChromePathname();
  return <p data-testid="path">{pathname}</p>;
}

describe("useChromePathname", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/news/a/b");
  });

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

  it("reads the /index alias of the root page as / (Vercel regenerates the homepage at /index)", () => {
    vi.mocked(usePathname).mockReturnValue("/index");
    render(<Probe />);
    expect(screen.getByTestId("path").textContent).toBe("/");
  });

  it("leaves real paths that merely contain index alone", () => {
    vi.mocked(usePathname).mockReturnValue("/news/index-of-things");
    render(<Probe />);
    expect(screen.getByTestId("path").textContent).toBe("/news/index-of-things");
  });
});
