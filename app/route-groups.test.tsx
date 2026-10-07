import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminNotFound from "./(admin)/not-found";
import DelegateNotFound from "./(delegate)/not-found";
import MemberNotFound from "./(member)/not-found";

const APP_DIR = path.join(process.cwd(), "app");

const groups = readdirSync(APP_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\(.+\)$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

// A route group without its own not-found.tsx renders the ROOT app/not-found.tsx inside the
// group's layout. The root file wraps the notice in the public header and footer, so a missing
// page in the member, admin or delegate area would show the public chrome nested inside the
// cabinet's own (two headers, two bottom bars). Every group therefore owns a not-found page that
// shows just the notice within its own layout.
describe("route groups", () => {
  it("include the four known groups, so the check below cannot pass by matching nothing", () => {
    expect(groups).toEqual(
      expect.arrayContaining(["(admin)", "(delegate)", "(member)", "(public)"]),
    );
  });

  it("each own a not-found page", () => {
    const without = groups.filter(
      (group) => !existsSync(path.join(APP_DIR, group, "not-found.tsx")),
    );
    expect(without).toEqual([]);
  });
});

describe.each([
  ["(admin)", AdminNotFound],
  ["(delegate)", DelegateNotFound],
  ["(member)", MemberNotFound],
])("%s not-found page", (_group, NotFound) => {
  it("shows none of the public site chrome (its group layout has its own)", () => {
    render(<NotFound />);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
