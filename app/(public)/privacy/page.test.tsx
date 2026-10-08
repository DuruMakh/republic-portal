import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata } from "./page";

const SECTIONS = [
  "ვინ ვართ",
  "რა მონაცემებს ვაგროვებთ",
  "რისთვის ვიყენებთ",
  "ვინ ხედავს შენს მონაცემებს",
  "ვის ვუზიარებთ",
  "რამდენ ხანს ვინახავთ",
  "შენი უფლებები",
  "ასაკი",
  "ქუქი-ფაილები",
  "ცვლილებები",
];

describe("/privacy", () => {
  it("is titled as the privacy policy", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "კონფიდენციალურობის პოლიტიკა" }),
    ).toBeInTheDocument();
    expect(metadata.title).toBe("კონფიდენციალურობის პოლიტიკა — ქართული რესპუბლიკა");
  });

  it("has the ten sections, in order", () => {
    render(<PrivacyPage />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      SECTIONS,
    );
  });

  it("is marked as a working version pending legal review", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText("სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას."),
    ).toBeInTheDocument();
  });

  it("names the movement and no service provider", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("მოძრაობა ქართული რესპუბლიკა");
    for (const company of ["Supabase", "Vercel", "Verify.ge"]) expect(text).not.toContain(company);
  });

  it("states the 18+ rule and the transfer to the EU", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("მხოლოდ 18 წლის ან უფროს პირს");
    expect(text).toContain("ევროკავშირში");
  });

  it("lists what is collected and who sees it as bullet points", () => {
    render(<PrivacyPage />);
    const lists = screen.getAllByRole("list");
    expect(lists.map((l) => l.querySelectorAll("li").length)).toEqual([4, 5]);
  });
});
