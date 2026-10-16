import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ABOUT_DOCUMENTS, ABOUT_DOCUMENTS_CAPTION } from "@/lib/about-copy";
import { HOME_DOCUMENTS, HOME_DOCUMENTS_CAPTION } from "@/lib/home-copy";
import { UnityDocumentFan } from "./UnityDocumentFan";

const [, , act] = HOME_DOCUMENTS;

describe("UnityDocumentFan", () => {
  it("draws one zoom button per archive page and no viewer until one is clicked", () => {
    render(<UnityDocumentFan documents={HOME_DOCUMENTS} caption={HOME_DOCUMENTS_CAPTION} />);

    for (const doc of HOME_DOCUMENTS) {
      expect(screen.getByRole("button", { name: `გადიდება — ${doc.name}` })).toBeInTheDocument();
    }
    expect(screen.getByText(HOME_DOCUMENTS_CAPTION)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the clicked page large with its caption, offers one close button and returns focus", () => {
    render(<UnityDocumentFan documents={HOME_DOCUMENTS} caption={HOME_DOCUMENTS_CAPTION} />);
    const trigger = screen.getByRole("button", { name: `გადიდება — ${act.name}` });

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: act.name });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("img", { name: act.name })).toHaveAttribute("src", act.src);
    expect(dialog).toHaveTextContent(act.caption);

    // The backdrop also closes on click, but it is not a second button for keyboards or readers.
    const close = screen.getByRole("button", { name: "დახურვა" });
    expect(close).toHaveFocus();
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape", () => {
    render(<UnityDocumentFan documents={ABOUT_DOCUMENTS} caption={ABOUT_DOCUMENTS_CAPTION} />);
    const [first] = ABOUT_DOCUMENTS;
    fireEvent.click(screen.getByRole("button", { name: `გადიდება — ${first.name}` }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
