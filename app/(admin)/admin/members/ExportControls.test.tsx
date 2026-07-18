import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExportControls } from "./ExportControls";

describe("ExportControls (spec §3.3 — decision #4/#6)", () => {
  it("builds the export URL from the active filters", () => {
    render(
      <ExportControls search="ნინო" regionId={3} status="active_member" canIncludeIds={false} />,
    );
    const link = screen.getByRole("link", { name: "ექსპორტი (CSV)" });
    expect(link).toHaveAttribute(
      "href",
      "/admin/members/export?search=%E1%83%9C%E1%83%98%E1%83%9C%E1%83%9D&regionId=3&status=active_member",
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("super_admin sees the include-IDs checkbox, off by default; ticking adds includeIds=1", async () => {
    render(
      <ExportControls search={undefined} regionId={undefined} status={undefined} canIncludeIds />,
    );
    const checkbox = screen.getByRole("checkbox", { name: "პირადი ნომრების ჩართვა" });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("link", { name: "ექსპორტი (CSV)" })).toHaveAttribute(
      "href",
      "/admin/members/export?",
    );
    fireEvent.click(checkbox);
    expect(screen.getByRole("link", { name: "ექსპორტი (CSV)" })).toHaveAttribute(
      "href",
      "/admin/members/export?includeIds=1",
    );
  });
});
