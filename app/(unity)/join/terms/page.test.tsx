import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DELEGATE_TERMS } from "@/components/DelegateTerms";
import TermsPage from "./page";

describe("/join/terms", () => {
  it("lists the four delegate terms in order under the page heading", () => {
    render(<TermsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "წესები და პირობები" }),
    ).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    items.forEach((item, i) => expect(item).toHaveTextContent(DELEGATE_TERMS[i]!));
  });

  it("keeps the draft notice until legal review", () => {
    render(<TermsPage />);
    expect(screen.getByRole("note")).toHaveTextContent(
      "სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.",
    );
  });
});
