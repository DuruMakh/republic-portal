import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecisionRuleCard } from "./DecisionRuleCard";

describe("DecisionRuleCard", () => {
  it("shows the headline and body, and fills exactly `needed` of `total` pebbles", () => {
    render(<DecisionRuleCard headline="არანაკლებ 2/3" body="ტექსტი" needed={4} total={5} />);
    expect(screen.getByText("არანაკლებ 2/3")).toBeInTheDocument();
    expect(screen.getByText("ტექსტი")).toBeInTheDocument();
    const row = screen.getByRole("img", { name: "5-დან 4 ხმა" });
    expect(row.querySelectorAll('[data-tone="teal"]')).toHaveLength(4);
    expect(row.querySelectorAll('[data-tone="empty"]')).toHaveLength(1);
  });
});
