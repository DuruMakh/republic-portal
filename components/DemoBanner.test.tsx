import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoBanner } from "./DemoBanner";

afterEach(() => vi.unstubAllEnvs());

describe("DemoBanner", () => {
  it("renders the demo notice on preview", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
    render(<DemoBanner />);
    expect(screen.getByText("სადემონსტრაციო გარემო — მონაცემები ფიქტიურია")).toBeInTheDocument();
  });
  it("renders the demo notice when production flag is set but the database is still staging", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
    render(<DemoBanner />);
    expect(screen.getByText("სადემონსტრაციო გარემო — მონაცემები ფიქტიურია")).toBeInTheDocument();
  });
  it("renders nothing in production with a non-staging database", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://prodrefabcdefgh.supabase.co");
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
