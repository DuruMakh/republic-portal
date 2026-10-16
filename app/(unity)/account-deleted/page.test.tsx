import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETED_BODY,
  ACCOUNT_DELETED_HOME,
  ACCOUNT_DELETED_PRIVACY,
  ACCOUNT_DELETED_TITLE,
} from "@/lib/account-deletion-copy";
import { PRIVACY_POLICY_PATH } from "@/lib/privacy";
import PrivacyPage from "../privacy/page";
import Page, { metadata } from "./page";

describe("/account-deleted", () => {
  it("confirms the deletion, links home, and stays out of search", () => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { level: 1, name: ACCOUNT_DELETED_TITLE }),
    ).toBeInTheDocument();
    expect(screen.getByText(ACCOUNT_DELETED_BODY)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ACCOUNT_DELETED_HOME })).toHaveAttribute("href", "/");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("links to the privacy policy, which says what outlives a deletion", () => {
    render(<Page />);
    expect(screen.getByRole("link", { name: ACCOUNT_DELETED_PRIVACY })).toHaveAttribute(
      "href",
      PRIVACY_POLICY_PATH,
    );
  });

  it("names the policy link exactly as the policy page titles itself", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(ACCOUNT_DELETED_PRIVACY);
  });
});
