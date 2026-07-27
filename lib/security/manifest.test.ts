import { describe, expect, it } from "vitest";
import { reconcile } from "./manifest";
import type { Surface } from "./types";

const surface = (kind: Surface["kind"], name: string): Surface => ({
  id: `${kind}:${name}`,
  kind,
  name,
  layer: "db",
});

describe("reconcile", () => {
  it("reports a live object missing from the manifest as added", () => {
    const result = reconcile([], [{ kind: "function", name: "admin_new_thing" }]);
    expect(result.added).toEqual(["function:admin_new_thing"]);
    expect(result.removed).toEqual([]);
  });

  it("reports a manifest entry absent from the database as removed", () => {
    const result = reconcile([surface("view", "gone_view")], []);
    expect(result.removed).toEqual(["view:gone_view"]);
    expect(result.added).toEqual([]);
  });

  it("counts matches as unchanged", () => {
    const result = reconcile(
      [surface("function", "register")],
      [{ kind: "function", name: "register" }],
    );
    expect(result.unchanged).toBe(1);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("ignores app-layer manifest entries during reconciliation", () => {
    const action: Surface = {
      id: "action:submitJoin",
      kind: "action",
      name: "submitJoin",
      layer: "app",
    };
    const result = reconcile([action], []);
    expect(result.removed).toEqual([]);
  });
});
