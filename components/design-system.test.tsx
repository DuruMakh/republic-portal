import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// TEAM_STATUS_LABELS is imported here only as a test-time guard against Pill's own
// STATUS_CONFIG literals drifting out of sync with lib/cabinet — see the "stays in sync
// with TEAM_STATUS_LABELS" test below. Pill itself must not import from lib/cabinet.
import { TEAM_STATUS_LABELS } from "@/lib/cabinet";
import { Button } from "./Button";
import { Card } from "./Card";
import { CheckboxField, Field } from "./Field";
import { Pill } from "./Pill";
import { StatCard } from "./StatCard";
import { Stepper } from "./Stepper";

describe("Button", () => {
  it("renders danger variant", () => {
    render(<Button variant="danger">წაშლა</Button>);
    const btn = screen.getByRole("button", { name: "წაშლა" });
    expect(btn.classList.contains("border-brand")).toBe(true);
    expect(btn.classList.contains("text-brand")).toBe(true);
  });

  it("renders dark as the teal secondary button (ADR-048)", () => {
    render(<Button variant="dark">Find</Button>);
    const btn = screen.getByRole("button", { name: "Find" });
    expect(btn).toHaveClass("bg-teal", "border-teal", "text-paper", "hover:bg-teal-dark");
    expect(btn).not.toHaveClass("bg-ink");
  });

  it("keeps primary on ink with the red hover", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("bg-ink", "hover:bg-brand");
  });
});

describe("Pill", () => {
  it("both member statuses read plainly as member, in one look (ADR-037: no dues, no active tier)", () => {
    const paid = render(<Pill status="active_member" />);
    const paidPill = screen.getByText("წევრი");
    const paidClass = paidPill.className;
    paid.unmount();
    render(<Pill status="profile_completed" />);
    expect(screen.getByText("წევრი").className).toBe(paidClass);
  });
  it("shows the supporter chip in teal, in the chip system's own /10 tint (ADR-048)", () => {
    const { container } = render(<Pill status="registered" />);
    const chip = container.firstElementChild;
    expect(chip).toHaveClass("bg-teal/10", "text-teal");
    expect(chip).not.toHaveClass("bg-surface");
  });
  it("Pill label override keeps status colors but swaps text (Phase 3)", () => {
    render(<Pill status="profile_completed" label="რეგისტრირებული" />);
    expect(screen.getByText("რეგისტრირებული")).toBeInTheDocument();
  });
  it("stays in sync with TEAM_STATUS_LABELS (lib/cabinet) for profile_completed/active_member", () => {
    // Pill's STATUS_CONFIG duplicates these two labels as its own literals (kept in sync
    // only by a code comment) — this is the exact drift that let Pill's active_member
    // default fall behind lib/cabinet's TEAM_STATUS_LABELS previously. Pinning the
    // *rendered* text to TEAM_STATUS_LABELS' values, rather than to a second hardcoded
    // copy of the strings, makes that drift fail a test instead of only a code comment.
    const profileCompleted = render(<Pill status="profile_completed" />);
    expect(profileCompleted.container.textContent).toBe(TEAM_STATUS_LABELS.profile_completed);
    profileCompleted.unmount();

    const activeMember = render(<Pill status="active_member" />);
    expect(activeMember.container.textContent).toBe(TEAM_STATUS_LABELS.active_member);
    activeMember.unmount();
  });
});

describe("StatCard", () => {
  it("shows label and value", () => {
    render(<StatCard label="აქტიური წევრი" value={1700} />);
    expect(screen.getByText("1700")).toBeInTheDocument();
    expect(screen.getByText("აქტიური წევრი")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("links label to input and shows error text", () => {
    render(<Field label="ტელეფონი" name="phone" error="სავალდებულოა" />);
    expect(screen.getByLabelText("ტელეფონი")).toBeInTheDocument();
    expect(screen.getByText("სავალდებულოა")).toBeInTheDocument();
  });
  it("respects a caller-supplied id (label stays linked)", () => {
    render(<Field label="ქალაქი" id="city-input" name="city" />);
    const input = screen.getByLabelText("ქალაქი");
    expect(input.getAttribute("id")).toBe("city-input");
  });
});

describe("CheckboxField", () => {
  it("is a real checkbox named by its label, toggled by clicking the text", () => {
    render(<CheckboxField label="თანახმა ვარ" defaultChecked={false} />);
    const box = screen.getByRole("checkbox", { name: "თანახმა ვარ" });
    expect(box).not.toBeChecked();
    fireEvent.click(screen.getByText("თანახმა ვარ"));
    expect(box).toBeChecked();
  });
});

describe("Stepper", () => {
  it("marks the current step", () => {
    render(<Stepper steps={["პროფილი", "საწევრო"]} current={1} />);
    expect(screen.getByText("პროფილი")).toBeInTheDocument();
    expect(screen.getByText("საწევრო")).toBeInTheDocument();
    // Roman-numeral marker furniture (spec §3.1) replaces the old plain "1" —
    // aria-current still lands on the current step's marker element.
    expect(screen.getByText(/^I\./).getAttribute("aria-current")).toBe("step");
  });
});

describe("Card", () => {
  it("callout keeps the ink border on bright paper", () => {
    const { container } = render(<Card variant="callout">x</Card>);
    expect(container.firstElementChild).toHaveClass("border-ink", "bg-paper-bright");
  });

  it("callout-teal is the same surface with a teal border (ADR-048)", () => {
    const { container } = render(<Card variant="callout-teal">x</Card>);
    expect(container.firstElementChild).toHaveClass("border-teal", "bg-paper-bright");
    expect(container.firstElementChild).not.toHaveClass("border-ink");
  });
});
