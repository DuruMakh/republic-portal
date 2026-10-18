import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RevealPersonalId } from "./RevealPersonalId";

describe("RevealPersonalId (spec §3.3 — audited click-to-reveal)", () => {
  it("shows the mask until clicked, then the returned ID", async () => {
    const reveal = vi.fn().mockResolvedValue({ ok: true, personalId: "01017056789" });
    render(<RevealPersonalId memberId="m-1" reveal={reveal} />);
    expect(screen.getByText("•••••••••••")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ჩვენება" }));
    await waitFor(() => expect(screen.getByText("01017056789")).toBeInTheDocument());
    expect(reveal).toHaveBeenCalledWith("m-1");
    expect(screen.queryByRole("button", { name: "ჩვენება" })).not.toBeInTheDocument();
  });
  it("renders a Georgian error and keeps the mask on failure", async () => {
    const reveal = vi.fn().mockResolvedValue({ ok: false, error: "შეცდომა" });
    render(<RevealPersonalId memberId="m-1" reveal={reveal} />);
    fireEvent.click(screen.getByRole("button", { name: "ჩვენება" }));
    await waitFor(() => expect(screen.getByText("შეცდომა")).toBeInTheDocument());
    expect(screen.getByText("•••••••••••")).toBeInTheDocument();
  });
  it("null ID (legacy row) renders an em dash", async () => {
    const reveal = vi.fn().mockResolvedValue({ ok: true, personalId: null });
    render(<RevealPersonalId memberId="m-1" reveal={reveal} />);
    fireEvent.click(screen.getByRole("button", { name: "ჩვენება" }));
    await waitFor(() => expect(screen.getByText("—")).toBeInTheDocument());
  });
});
