import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// TEAM_STATUS_LABELS is imported here only as a test-time guard against Pill's own
// STATUS_CONFIG literals drifting out of sync with lib/cabinet — see the "stays in sync
// with TEAM_STATUS_LABELS" test below. Pill itself must not import from lib/cabinet.
import { TEAM_STATUS_LABELS } from "@/lib/cabinet";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { Eyebrow } from "./Eyebrow";
import { Field } from "./Field";
import { Pill } from "./Pill";
import { StatCard } from "./StatCard";
import { Stepper } from "./Stepper";

describe("Button", () => {
  it("renders primary variant with brand styling by default", () => {
    render(<Button>გაგრძელება</Button>);
    const btn = screen.getByRole("button", { name: "გაგრძელება" });
    expect(btn.className).toContain("bg-ink");
    expect(btn.className).toContain("hover:bg-brand");
  });
  it("renders danger variant", () => {
    render(<Button variant="danger">წაშლა</Button>);
    expect(screen.getByRole("button", { name: "წაშლა" }).className).toContain("border-brand");
    expect(screen.getByRole("button", { name: "წაშლა" }).className).toContain("text-brand");
  });
  it("renders dark variant", () => {
    render(<Button variant="dark">რეიტინგი</Button>);
    expect(screen.getByRole("button", { name: "რეიტინგი" }).className).toContain("bg-ink");
  });
  it("keeps md size classes by default (back-compat)", () => {
    render(<Button>გაგრძელება</Button>);
    expect(screen.getByRole("button", { name: "გაგრძელება" }).className).toContain("h-10 px-5");
  });
  it("renders lg size", () => {
    render(<Button size="lg">რეგისტრაცია</Button>);
    expect(screen.getByRole("button", { name: "რეგისტრაცია" }).className).toContain("h-[46px]");
  });
});

describe("Card", () => {
  it("keeps title and p-6 on the section by default (back-compat)", () => {
    render(
      <Card title="სათაური">
        <p>შიგთავსი</p>
      </Card>,
    );
    expect(screen.getByText("სათაური")).toBeInTheDocument();
    const section = screen.getByText("შიგთავსი").closest("section");
    expect(section?.className).toContain("p-6");
    expect(section?.className).toContain("bg-paper-bright");
    expect(section?.className).not.toContain("overflow-hidden");
    expect(screen.getByText("შიგთავსი").parentElement?.tagName).toBe("SECTION");
  });
  it("renders header content in a divided header row", () => {
    render(
      <Card header={<h2>ცოცხალი რეიტინგი</h2>}>
        <p>რიგები</p>
      </Card>,
    );
    expect(screen.getByText("ცოცხალი რეიტინგი")).toBeInTheDocument();
    const section = screen.getByText("რიგები").closest("section");
    expect(section?.className).toContain("overflow-hidden");
  });
  it("drops content padding with padded={false}", () => {
    render(
      <Card padded={false}>
        <p>უპადინგოდ</p>
      </Card>,
    );
    const wrapper = screen.getByText("უპადინგოდ").parentElement;
    expect(wrapper?.className).not.toContain("p-6");
    expect(wrapper?.className).toContain("p-0");
  });
  it("variant callout renders the full ink border instead of the hairline", () => {
    render(
      <Card variant="callout">
        <p>რჩევა</p>
      </Card>,
    );
    const section = screen.getByText("რჩევა").closest("section");
    expect(section?.className).toContain("border-ink");
  });
});

describe("Eyebrow", () => {
  it("renders children in uppercase brand-colored text", () => {
    render(<Eyebrow>საჯარო პორტალი</Eyebrow>);
    const eyebrow = screen.getByText("საჯარო პორტალი");
    expect(eyebrow.className).toContain("uppercase");
    expect(eyebrow.className).toContain("text-brand");
  });
});

describe("Badge", () => {
  it("renders children in a rounded chip", () => {
    render(<Badge>12 დელეგატი</Badge>);
    expect(screen.getByText("12 დელეგატი").className).toContain("rounded-full");
  });
  it("tone warn renders bg-warn (admin verify nav badge, Task 18) instead of the default brand", () => {
    render(<Badge tone="warn">3</Badge>);
    expect(screen.getByText("3").className).toContain("bg-warn");
  });
});

describe("Pill", () => {
  it("maps status to Georgian label", () => {
    render(<Pill status="active_member" />);
    // team-status vocabulary (lib/cabinet.ts TEAM_STATUS_LABELS): "აქტიური", not
    // the retired "აქტიური წევრი" (V17/V23 sweep — Pill's own defaults were missed).
    expect(screen.getByText("აქტიური")).toBeInTheDocument();
  });
  it("profile_completed maps to the current team-status label (V17)", () => {
    render(<Pill status="profile_completed" />);
    // was the retired "პროფილი შევსებულია"; every other member-status display
    // already reads "წევრი" (TEAM_STATUS_LABELS.profile_completed).
    expect(screen.getByText("წევრი")).toBeInTheDocument();
    expect(screen.getByText("წევრი").className).toContain("text-ink");
  });
  it("Pill label override keeps status colors but swaps text (Phase 3)", () => {
    render(<Pill status="profile_completed" label="რეგისტრირებული" />);
    expect(screen.getByText("რეგისტრირებული")).toBeInTheDocument();
  });
  it("registered status renders the light-tier label", () => {
    render(<Pill status="registered" />);
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
    expect(screen.getByText("1700").className).toContain("font-serif");
  });
  it("supports brand accent and sub text", () => {
    render(<StatCard label="აქტიური მხარდამჭერი" value={294} accent="brand" sub="ღია რეიტინგში" />);
    expect(screen.getByText("294").className).toContain("text-brand");
    expect(screen.getByText("ღია რეიტინგში")).toBeInTheDocument();
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
  it("input class contains border-b and bg-transparent and does not contain rounded", () => {
    render(<Field label="ტელეფონი" name="phone" />);
    const input = screen.getByLabelText("ტელეფონი");
    expect(input.className).toContain("border-b");
    expect(input.className).toContain("bg-transparent");
    expect(input.className).not.toContain("rounded");
  });
  it("label class contains tracking-[.08em]", () => {
    render(<Field label="ტელეფონი" name="phone" />);
    const label = screen.getByText("ტელეფონი");
    expect(label.className).toContain("tracking-[.08em]");
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
