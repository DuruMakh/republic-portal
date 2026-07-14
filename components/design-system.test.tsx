import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
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
  it("keeps md size classes by default (back-compat)", () => {
    render(<Button>გაგრძელება</Button>);
    expect(screen.getByRole("button", { name: "გაგრძელება" }).className).toContain(
      "px-5 py-2.5 text-sm",
    );
  });
  it("renders lg size", () => {
    render(<Button size="lg">რეგისტრაცია</Button>);
    expect(screen.getByRole("button", { name: "რეგისტრაცია" }).className).toContain("px-6");
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
});

describe("Badge", () => {
  it("renders children in a rounded chip", () => {
    render(<Badge>12 დელეგატი</Badge>);
    expect(screen.getByText("12 დელეგატი").className).toContain("rounded-full");
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
});

describe("Stepper", () => {
  it("marks the current step", () => {
    render(<Stepper current={2} />);
    expect(screen.getByText("2").getAttribute("aria-current")).toBe("step");
  });
});
