import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ABOUT_DOCUMENTS } from "@/lib/about-copy";
import { AboutDocuments } from "./AboutDocuments";

const act = ABOUT_DOCUMENTS.find((doc) => doc.id === "act")!;

describe("AboutDocuments", () => {
  it("opens a page large with its caption and closes it with the close button", () => {
    render(<AboutDocuments />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: `გადიდება — ${act.name}` });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: act.name });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("img", { name: act.name })).toHaveAttribute("src", act.src);
    expect(screen.getByText(act.caption)).toBeInTheDocument();

    const closers = screen.getAllByRole("button", { name: "დახურვა" });
    expect(closers.at(-1)).toHaveFocus();
    fireEvent.click(closers.at(-1)!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape", () => {
    render(<AboutDocuments />);
    fireEvent.click(screen.getByRole("button", { name: `გადიდება — ${act.name}` }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
