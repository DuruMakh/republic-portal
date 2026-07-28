import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RankedDelegate } from "@/lib/ranking";
import { LeaderboardDirectory } from "./LeaderboardDirectory";

const mk = (over: Partial<RankedDelegate>): RankedDelegate => ({
  id: crypto.randomUUID(),
  slug: "x",
  first_name: "ანა",
  last_name: "ჯაფარიძე",
  region_id: 1,
  region_name_ka: "თბილისი",
  bio: null,
  photo_url: null,
  active_supporters: 10,
  rank: 1,
  ...over,
});

const DELEGATES = [
  mk({ slug: "giorgi-maisuradze", first_name: "გიორგი", last_name: "მაისურაძე", rank: 1 }),
  mk({
    slug: "eka-meladze",
    first_name: "ეკა",
    last_name: "მელაძე",
    region_id: 8,
    region_name_ka: "გურია",
    rank: 2,
  }),
];
const REGIONS = [
  { id: 1, name_ka: "თბილისი" },
  { id: 8, name_ka: "გურია" },
];

describe("LeaderboardDirectory", () => {
  it("renders every delegate as a leader row by default", () => {
    render(<LeaderboardDirectory delegates={DELEGATES} regions={REGIONS} />);
    expect(screen.getAllByTestId("leader-row")).toHaveLength(DELEGATES.length);
  });

  it("filters by name", () => {
    render(<LeaderboardDirectory delegates={DELEGATES} regions={REGIONS} />);
    fireEvent.change(screen.getByPlaceholderText("ძებნა სახელით..."), {
      target: { value: DELEGATES[0]!.first_name },
    });
    expect(screen.getAllByTestId("leader-row")).toHaveLength(1);
  });

  it("filters by region", () => {
    render(<LeaderboardDirectory delegates={DELEGATES} regions={REGIONS} />);
    fireEvent.change(screen.getByRole("combobox", { name: "მხარე" }), {
      target: { value: String(REGIONS[0]!.id) },
    });
    for (const row of screen.getAllByTestId("leader-row")) {
      expect(row).toHaveTextContent(REGIONS[0]!.name_ka);
    }
  });

  it("shows the no-results notice when nothing matches", () => {
    render(<LeaderboardDirectory delegates={DELEGATES} regions={REGIONS} />);
    fireEvent.change(screen.getByPlaceholderText("ძებნა სახელით..."), {
      target: { value: "zzz" },
    });
    expect(screen.queryAllByTestId("leader-row")).toHaveLength(0);
    expect(screen.getByText(/ვერ მოიძებნა/)).toBeInTheDocument();
  });
});
