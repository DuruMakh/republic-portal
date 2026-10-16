import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Caps } from "./Caps";

describe("Caps", () => {
  it("keeps the ordinary letters as the accessible name while showing Mtavruli", () => {
    render(
      <button type="button">
        <Caps>შენახვა</Caps>
      </button>,
    );
    const button = screen.getByRole("button", { name: "შენახვა" });
    expect(button).toHaveTextContent("ᲨᲔᲜᲐᲮᲕᲐ");
    expect(button.querySelector('[aria-hidden="true"]')).toHaveTextContent("ᲨᲔᲜᲐᲮᲕᲐ");
  });
});
