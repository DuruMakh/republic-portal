import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrivacyConsentField } from "./PrivacyConsentField";

const SENTENCE =
  "ვადასტურებ, რომ 18 წლის ან უფროსი ვარ და ვეთანხმები ჩემი პერსონალური მონაცემების დამუშავებას კონფიდენციალურობის პოლიტიკის შესაბამისად.";

describe("PrivacyConsentField", () => {
  it("is one checkbox whose name is the whole consent sentence", () => {
    render(<PrivacyConsentField checked={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: SENTENCE })).not.toBeChecked();
  });

  it("links the policy in a new tab so typed input is kept", () => {
    render(<PrivacyConsentField checked={false} onChange={() => {}} />);
    const link = screen.getByRole("link", { name: "კონფიდენციალურობის პოლიტიკის" });
    expect(link).toHaveAttribute("href", "/privacy");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("reports the new checked state", () => {
    const onChange = vi.fn();
    render(<PrivacyConsentField checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: SENTENCE }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows an error as an alert and marks the box invalid", () => {
    render(
      <PrivacyConsentField
        checked={false}
        onChange={() => {}}
        error="გასაგრძელებლად მონიშნე თანხმობა."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("გასაგრძელებლად მონიშნე თანხმობა.");
    expect(screen.getByRole("checkbox", { name: SENTENCE })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("has no alert without an error", () => {
    render(<PrivacyConsentField checked onChange={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
