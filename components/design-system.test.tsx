import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Field } from "./Field";
import { Pill } from "./Pill";
import { StatCard } from "./StatCard";
import { Stepper } from "./Stepper";

describe("Button", () => {
  it("renders primary variant with brand styling by default", () => {
    render(<Button>გაგრძელება</Button>);
    const btn = screen.getByRole("button", { name: "გაგრძელება" });
    expect(btn.className).toContain("bg-brand");
  });
  it("renders danger variant", () => {
    render(<Button variant="danger">წაშლა</Button>);
    expect(screen.getByRole("button", { name: "წაშლა" }).className).toContain("bg-danger");
  });
  it("renders dark variant", () => {
    render(<Button variant="dark">რეიტინგი</Button>);
    expect(screen.getByRole("button", { name: "რეიტინგი" }).className).toContain("bg-navy");
  });
});

describe("Pill", () => {
  it("maps status to Georgian label", () => {
    render(<Pill status="active_member" />);
    expect(screen.getByText("აქტიური წევრი")).toBeInTheDocument();
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
});

describe("Stepper", () => {
  it("marks the current step", () => {
    render(<Stepper current={2} />);
    expect(screen.getByText("2").getAttribute("aria-current")).toBe("step");
  });
});
