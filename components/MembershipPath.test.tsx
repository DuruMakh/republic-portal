import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MembershipPath } from "./MembershipPath";

describe("MembershipPath", () => {
  it("renders the label and the steps as an ordered list, last step filled", () => {
    render(<MembershipPath label="როგორ ხდები წევრი" steps={["ერთი", "ორი", "სამი"]} />);
    expect(screen.getByText("როგორ ხდები წევრი")).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["1ერთი", "2ორი", "3სამი"]);
    expect(items[2]?.querySelector('[data-tone="brand"]')).toBeTruthy();
    expect(items[0]?.querySelector('[data-tone="outline"]')).toBeTruthy();
  });
});
