import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DelegateProfileForm } from "./DelegateProfileForm";

describe("DelegateProfileForm (spec §3.4)", () => {
  it("prefills the bio and submits FormData through the injected action", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    render(
      <DelegateProfileForm delegateId="d-1" initialBio="ძველი ბიო" photoUrl={null} save={save} />,
    );
    const bio = screen.getByLabelText(/ბიოგრაფია/);
    expect(bio).toHaveValue("ძველი ბიო");
    fireEvent.change(bio, { target: { value: "ახალი ბიო" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(screen.getByText(/პროფილი განახლდა/)).toBeInTheDocument());
    const fd = save.mock.calls[0]![0] as FormData;
    expect(fd.get("delegateId")).toBe("d-1");
    expect(fd.get("bio")).toBe("ახალი ბიო");
  });

  it("refuses an oversized photo client-side without calling the action", async () => {
    const save = vi.fn();
    render(<DelegateProfileForm delegateId="d-1" initialBio="" photoUrl={null} save={save} />);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText(/ფოტო/), { target: { files: [big] } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(screen.getByText(/ფოტო არ უნდა აღემატებოდეს 5 MB-ს/)).toBeInTheDocument(),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("refuses a wrong file type client-side", async () => {
    const save = vi.fn();
    render(<DelegateProfileForm delegateId="d-1" initialBio="" photoUrl={null} save={save} />);
    const pdf = new File([new Uint8Array(10)], "cv.pdf", { type: "application/pdf" });
    // fireEvent bypasses the input's `accept` filter (unlike user-event) — exactly
    // what this wrong-type case needs to reach the action's own MIME check
    fireEvent.change(screen.getByLabelText(/ფოტო/), { target: { files: [pdf] } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(screen.getByText(/დაშვებულია მხოლოდ JPEG, PNG ან WebP/)).toBeInTheDocument(),
    );
    expect(save).not.toHaveBeenCalled();
  });
});
