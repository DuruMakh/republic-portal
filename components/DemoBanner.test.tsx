import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoBanner } from "./DemoBanner";

afterEach(() => vi.unstubAllEnvs());

describe("DemoBanner", () => {
  it("renders the demo notice outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    render(<DemoBanner />);
    expect(screen.getByText("სადემონსტრაციო გარემო — მონაცემები ფიქტიურია")).toBeInTheDocument();
  });
  it("renders nothing in production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
