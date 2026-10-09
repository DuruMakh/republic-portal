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

  it("carries no draft banner (owner decision, 2026-10-08)", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).not.toContain("სამუშაო ვერსია");
  });

  it("names the movement and no service provider", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("მოძრაობა ქართული რესპუბლიკა");
    for (const company of ["Supabase", "Vercel", "Verify.ge"]) expect(text).not.toContain(company);
  });

  it("states the 18+ rule and that processing happens in the EU and the US", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("მხოლოდ 18 წლის ან უფროს პირს");
    expect(text).toContain("ევროკავშირში");
    expect(text).toContain("აშშ-შიც");
  });

  it("names the personal ID number among the membership data", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toContain("წევრობის განაცხადისას: პირადი ნომერი,");
  });

  it("says a delegate's place in the ranking is public", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toContain("ადგილი რეიტინგში");
  });

  it("says where to send requests and how fast they are answered", () => {
    render(<PrivacyPage />);
    const links = screen.getAllByRole("link", { name: "დაგვიკავშირდი →" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/support");
    expect(screen.getByText(/10 სამუშაო დღისა/)).toBeInTheDocument();
  });

  it("lists what is collected and who sees it as bullet points", () => {
    render(<PrivacyPage />);
    const lists = screen.getAllByRole("list");
    expect(lists.map((l) => l.querySelectorAll("li").length)).toEqual([5, 5]);
  });

  it("says people can delete their account themselves, and what that does", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("ანგარიშის წაშლა შეგიძლია თავადაც, პროფილის გვერდიდან");
    expect(text).toContain("მონაცემებს ვინახავთ, სანამ ანგარიშს არ წაშლი.");
  });

  it("says honestly what outlives a deletion, and for how long", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    // the SMS rate-limit record keeps the phone number for about a day (hourly purge, 25 h max)
    expect(text).toContain("ერთი დღის განმავლობაში");
    // support messages are not linked to accounts, so a deletion does not reach them
    expect(text).toContain("ინახება ცალკე");
  });
});
