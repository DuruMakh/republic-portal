import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { CoverUpload } from "./CoverUpload";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("./actions", () => ({ setNewsCoverAction: mocks.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue({ ok: true });
  mocks.refresh.mockReset();
});

describe("CoverUpload", () => {
  function setup(bytes = 4_194_304) {
    const { container } = render(<CoverUpload newsId="news-1" imageUrl={null} />);
    const input = container.querySelector("input")!;
    // A fake size tests the byte boundary only; the browser integration uses a real image.
    const file = new File(["image"], "cover.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: bytes });
    fireEvent.change(input, { target: { files: [file] } });
    return { input, file, button: screen.getByRole("button", { name: "ყდის ატვირთვა" }) };
  }

  it("accepts exactly 4,194,304 bytes", async () => {
    const { button } = setup();
    fireEvent.click(button);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  });

  it("refuses one byte above 4 MiB before sending", async () => {
    const { button } = setup(4_194_305);
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("4 MB");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(["returned", "rejected"])(
    "recovers from a %s error and retries the selected file",
    async (kind) => {
      if (kind === "returned")
        mocks.save.mockResolvedValueOnce({ ok: false, error: "save failed" });
      else mocks.save.mockRejectedValueOnce(new Error("network failed"));
      const { input, file, button } = setup();
      fireEvent.click(button);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        kind === "returned" ? "save failed" : GENERIC_FUNNEL_ERROR,
      );
      await waitFor(() => expect(button).toBeEnabled());
      expect(input.files?.[0]).toBe(file);
      fireEvent.click(button);
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
      expect((mocks.save.mock.calls[1]![0] as FormData).get("cover")).toBe(file);
    },
  );
});
