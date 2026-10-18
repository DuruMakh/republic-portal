import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RevokeRoleButton } from "./RevokeRoleButton";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("RevokeRoleButton (spec §3.7)", () => {
  it("asks for confirmation, then revokes", async () => {
    const revoke = vi.fn().mockResolvedValue({ ok: true });
    render(<RevokeRoleButton userId="u-1" role="finance" revoke={revoke} />);
    fireEvent.click(screen.getByRole("button", { name: "როლის მოხსნა" }));
    fireEvent.click(screen.getByRole("button", { name: "მოხსნა" }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("u-1", "finance"));
  });
  it("surfaces the last-super_admin lockout error", async () => {
    const revoke = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "ბოლო super_admin-ის მოხსნა შეუძლებელია." });
    render(<RevokeRoleButton userId="u-1" role="super_admin" revoke={revoke} />);
    fireEvent.click(screen.getByRole("button", { name: "როლის მოხსნა" }));
    fireEvent.click(screen.getByRole("button", { name: "მოხსნა" }));
    await waitFor(() =>
      expect(screen.getByText("ბოლო super_admin-ის მოხსნა შეუძლებელია.")).toBeInTheDocument(),
    );
  });
});
