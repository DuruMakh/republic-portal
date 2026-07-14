import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CenteredNotice } from "./CenteredNotice";

describe("CenteredNotice", () => {
  it("renders the title as a heading", () => {
    render(<CenteredNotice title="სათაური" />);
    expect(screen.getByRole("heading", { name: "სათაური" })).toBeInTheDocument();
  });

  it("renders description and actions when given", () => {
    render(
      <CenteredNotice
        title="სათაური"
        description="აღწერა"
        actions={<button type="button">ღილაკი</button>}
      />,
    );
    expect(screen.getByText("აღწერა")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ღილაკი" })).toBeInTheDocument();
  });

  it("omits description and actions when not given", () => {
    render(<CenteredNotice title="სათაური" />);
    expect(screen.queryByText("აღწერა")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
