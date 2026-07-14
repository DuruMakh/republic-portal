import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RankedDelegate } from "@/lib/ranking";
import { DelegateDirectory } from "./DelegateDirectory";

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

const delegates = [
  mk({ slug: "giorgi-maisuradze", first_name: "გიორგი", last_name: "მაისურაძე", rank: 1 }),
  mk({ slug: "eka-meladze", first_name: "ეკა", last_name: "მელაძე", region_id: 8, region_name_ka: "გურია", rank: 2 }),
];
const regions = [
  { id: 1, name_ka: "თბილისი" },
  { id: 8, name_ka: "გურია" },
];

describe("DelegateDirectory", () => {
  it("shows all delegates and the count line", () => {
    render(<DelegateDirectory delegates={delegates} regions={regions} />);
    expect(screen.getByText("ნაჩვენებია 2 დელეგატი")).toBeInTheDocument();
  });
  it("filters by name search", () => {
    render(<DelegateDirectory delegates={delegates} regions={regions} />);
    const input = screen.getByPlaceholderText("ძებნა სახელით...");
    fireEvent.change(input, { target: { value: "ეკა" } });
    expect(screen.getByText("ნაჩვენებია 1 დელეგატი")).toBeInTheDocument();
    expect(screen.queryByText("გიორგი მაისურაძე")).not.toBeInTheDocument();
  });
  it("filters by region", () => {
    render(<DelegateDirectory delegates={delegates} regions={regions} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "8" } });
    expect(screen.getByText("ნაჩვენებია 1 დელეგატი")).toBeInTheDocument();
    expect(screen.getByText("ეკა მელაძე")).toBeInTheDocument();
  });
  it("shows the empty state when nothing matches", () => {
    render(<DelegateDirectory delegates={delegates} regions={regions} />);
    const input = screen.getByPlaceholderText("ძებნა სახელით...");
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(
      screen.getByText('ამ პარამეტრებით დელეგატი ვერ მოიძებნა. სცადე სხვა ძებნა ან აირჩიე "ყველა მხარე".')
    ).toBeInTheDocument();
  });
});
