import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HOME_DOCUMENTS } from "@/lib/home-copy";
import { HomeDocuments } from "./HomeDocuments";

const act = HOME_DOCUMENTS.find((d) => d.id === "act")!;

describe("HomeDocuments", () => {
  it("draws one zoom button per archive page and no viewer until one is clicked", () => {
    render(<HomeDocuments />);

    for (const doc of HOME_DOCUMENTS) {
      expect(screen.getByRole("button", { name: `გადიდება — ${doc.name}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the clicked page large, with its caption, and closes it with the close button", () => {
    render(<HomeDocuments />);
    const trigger = screen.getByRole("button", { name: `გადიდება — ${act.name}` });

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: act.name });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("img", { name: act.name })).toHaveAttribute("src", act.src);
    expect(dialog).toHaveTextContent(act.caption);

    const [close] = screen.getAllByRole("button", { name: "დახურვა" });
    expect(close).toHaveFocus();
    fireEvent.click(close!);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape", () => {
    render(<HomeDocuments />);
    fireEvent.click(screen.getByRole("button", { name: `გადიდება — ${act.name}` }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
