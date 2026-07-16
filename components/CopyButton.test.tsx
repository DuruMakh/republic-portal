import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

// @testing-library/user-event is not in devDependencies (checked package.json) —
// fireEvent from @testing-library/react stands in for the click interaction.
describe("CopyButton", () => {
  it("copies the text and confirms in Georgian", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyButton text="https://example.org/join?ref=AB2C3D" />);
    fireEvent.click(screen.getByRole("button", { name: "კოპირება" }));
    expect(writeText).toHaveBeenCalledWith("https://example.org/join?ref=AB2C3D");
    expect(await screen.findByRole("button", { name: "დაკოპირდა ✓" })).toBeInTheDocument();
  });
});
