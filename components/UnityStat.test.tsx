import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnityStat } from "./UnityStat";

describe("UnityStat", () => {
  it("pairs the figure with its label and note in a description list", () => {
    render(
      <dl>
        <UnityStat value="1 240 ₾" label="შეგროვებული" sub="სულ, დაარსებიდან" />
      </dl>,
    );
    expect(screen.getByRole("term")).toHaveTextContent("შეგროვებული");
    const values = screen.getAllByRole("definition");
    expect(values.map((v) => v.textContent)).toEqual(["1 240 ₾", "სულ, დაარსებიდან"]);
  });
});
