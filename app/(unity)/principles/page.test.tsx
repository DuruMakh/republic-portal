import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GEORGIAN_NUMERALS, PRINCIPLES } from "@/lib/principles-copy";
import PrinciplesPage, { metadata } from "./page";

function article(number: number): HTMLElement {
  const el = document.getElementById(`principle-${number}`);
  if (!el) throw new Error(`no #principle-${number}`);
  return el;
}

function toggle(number: number): HTMLElement {
  return within(article(number)).getByRole("button");
}

afterEach(() => {
  window.history.replaceState(null, "", "/principles");
});

describe("/principles", () => {
  it("opens with the headline, lede and a link down to the contents", () => {
    render(<PrinciplesPage />);
    expect(screen.getByRole("heading", { level: 1, name: "პრინციპები" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "ჩვენი მიზანია ქართველი ერის გაერთიანება საერთო პრინციპების, ღირებულებებისა და მიზნების გარშემო.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "სარჩევი" })).toHaveAttribute("href", "#contents");
    expect(document.getElementById("contents")).not.toBeNull();
  });

  it("rings the knot with the twelve numerals, each linking to its principle", () => {
    render(<PrinciplesPage />);
    const seal = screen.getByRole("navigation", { name: "პრინციპების ბეჭედი" });
    const links = within(seal).getAllByRole("link");
    expect(links).toHaveLength(12);
    links.forEach((link, i) => {
      expect(link).toHaveAccessibleName(`პრინციპი ${i + 1}`);
      expect(link).toHaveTextContent(GEORGIAN_NUMERALS[i] ?? "");
      expect(link).toHaveAttribute("href", `#principle-${i + 1}`);
    });
  });

  it("lists the contents, each entry linking to its principle", () => {
    render(<PrinciplesPage />);
    const contents = screen.getByRole("navigation", { name: "სარჩევი" });
    const links = within(contents).getAllByRole("link");
    expect(links).toHaveLength(12);
    PRINCIPLES.forEach(({ title }, i) => {
      expect(links[i]).toHaveTextContent(title);
      expect(links[i]).toHaveAttribute("href", `#principle-${i + 1}`);
    });
  });

  it("gives every principle its own section with the full text and its historical roots", () => {
    render(<PrinciplesPage />);
    PRINCIPLES.forEach(({ title, lead, body, roots }, i) => {
      const section = article(i + 1);
      expect(section).toHaveAccessibleName(title);
      // The desktop heading and the phone accordion's heading; CSS shows one per width.
      expect(within(section).getAllByRole("heading", { level: 2, name: title })).toHaveLength(2);
      expect(within(section).getByText(lead)).toBeInTheDocument();
      for (const text of body) {
        expect(within(section).getByText(text.replace(/\s+/g, " "))).toBeInTheDocument();
      }
      const note = within(section).getByRole("complementary", { name: "ჩვენი მემკვიდრეობა" });
      for (const root of roots) {
        if (root.kind === "event") expect(note.textContent).toContain(root.date);
        if (root.kind === "quote") expect(note.textContent).toContain(root.text);
      }
      expect(
        screen.queryByText(`ᲞᲠᲘᲜᲪᲘᲞᲘ ${String(i + 1).padStart(2, "0")}`),
      ).not.toBeInTheDocument();
    });
  });

  it("continues directly from principle 2 to 3 without a separate quote band", () => {
    render(<PrinciplesPage />);
    expect(screen.queryByRole("region", { name: "ციტატა" })).not.toBeInTheDocument();
    expect(article(2).nextElementSibling).toBe(article(3));
    expect(article(2)).toHaveTextContent(
      "ხელისუფლება არის ქართველი ერის მიერ შეზღუდული ვადით დაქირავებული, ანგარიშვალდებული მსახური და არა მისი ბატონი.",
    );
  });

  it("on phones folds the principles into rows, one open at a time, the first open", () => {
    render(<PrinciplesPage />);
    expect(toggle(1)).toHaveAttribute("aria-expanded", "true");
    for (let n = 2; n <= 12; n++) expect(toggle(n)).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(toggle(3).getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    expect(article(3)).toContainElement(panel);

    fireEvent.click(toggle(3));
    expect(toggle(3)).toHaveAttribute("aria-expanded", "true");
    expect(toggle(1)).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle(3));
    expect(toggle(3)).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the principle a link points at (#principle-N)", () => {
    window.history.replaceState(null, "", "/principles#principle-4");
    render(<PrinciplesPage />);
    expect(toggle(4)).toHaveAttribute("aria-expanded", "true");
    expect(toggle(1)).toHaveAttribute("aria-expanded", "false");

    act(() => {
      window.history.replaceState(null, "", "/principles#principle-9");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(toggle(9)).toHaveAttribute("aria-expanded", "true");
    expect(toggle(4)).toHaveAttribute("aria-expanded", "false");
  });

  it("closes with the join call and a link on to the structure", () => {
    render(<PrinciplesPage />);
    expect(screen.getByRole("heading", { level: 2, name: "ერთად შეგვიძლია." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ორგანიზაციული სტრუქტურა →" })).toHaveAttribute(
      "href",
      "/structure",
    );
  });

  it("carries the site-name suffix in its tab title", () => {
    expect(metadata.title).toBe("პრინციპები — ქართული რესპუბლიკა");
  });
});
