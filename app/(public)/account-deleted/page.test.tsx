import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETED_HOME, ACCOUNT_DELETED_TITLE } from "@/lib/account-deletion-copy";
import Page, { metadata } from "./page";

describe("/account-deleted", () => {
  it("confirms the deletion, links home, and stays out of search", () => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { level: 1, name: ACCOUNT_DELETED_TITLE }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ACCOUNT_DELETED_HOME })).toHaveAttribute("href", "/");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
