import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DelegateProfileForm } from "./DelegateProfileForm";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";

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
    const big = new File([new Uint8Array(4_194_305)], "big.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText(/ფოტო/), { target: { files: [big] } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(screen.getByText(/ფოტო არ უნდა აღემატებოდეს 4 MB-ს/)).toBeInTheDocument(),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("accepts exactly 4,194,304 bytes", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    render(<DelegateProfileForm delegateId="d-1" initialBio="" photoUrl={null} save={save} />);
    const file = new File([new Uint8Array(4_194_304)], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/ფოტო/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
  });

  it.each(["returned", "rejected"])(
    "recovers from a %s error without losing the photo or edited bio",
    async (kind) => {
      const save = vi.fn().mockResolvedValue({ ok: true });
      if (kind === "returned") save.mockResolvedValueOnce({ ok: false, error: "save failed" });
      else save.mockRejectedValueOnce(new Error("network failed"));
      render(<DelegateProfileForm delegateId="d-1" initialBio="old" photoUrl={null} save={save} />);
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      const input = screen.getByLabelText(/ფოტო/) as HTMLInputElement;
      const bio = screen.getByLabelText(/ბიოგრაფია/);
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.change(bio, { target: { value: "edited biography" } });
      const button = screen.getByRole("button", { name: "შენახვა" });
      fireEvent.click(button);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        kind === "returned" ? "save failed" : GENERIC_FUNNEL_ERROR,
      );
      await waitFor(() => expect(button).toBeEnabled());
      expect(input.files?.[0]).toBe(file);
      expect(bio).toHaveValue("edited biography");
      fireEvent.click(button);
      expect(await screen.findByText(/პროფილი განახლდა/)).toBeInTheDocument();
      const retried = save.mock.calls[1]![0] as FormData;
      expect(retried.get("bio")).toBe("edited biography");
      expect(retried.get("photo")).toBe(file);
    },
  );

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
