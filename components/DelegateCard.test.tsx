import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RankedDelegate } from "@/lib/ranking";
import { DelegateCard } from "./DelegateCard";

const delegate: RankedDelegate = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "giorgi-maisuradze",
  first_name: "გიორგი",
  last_name: "მაისურაძე",
  region_id: 1,
  region_name_ka: "თბილისი",
  bio: null,
  photo_url: null,
  active_supporters: 294,
  rank: 1,
};

describe("DelegateCard", () => {
  it("shows region, name, count, approved pill and links to the delegate page", () => {
    render(<DelegateCard delegate={delegate} />);
    expect(screen.getByText("თბილისი")).toBeInTheDocument();
    expect(screen.getByText("გიორგი მაისურაძე")).toBeInTheDocument();
    expect(screen.getByText("294")).toBeInTheDocument();
    expect(screen.getByText("აქტიური მხარდამჭერი")).toBeInTheDocument();
    expect(screen.getByText("დამტკიცებული")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/delegates/giorgi-maisuradze");
  });
});
