import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DelegateChange } from "./DelegateChange";

const changeDelegateAction = vi.fn();
vi.mock("../actions", () => ({
  changeDelegateAction: (input: unknown) => changeDelegateAction(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const REGIONS = [
  { id: 1, name_ka: "თბილისი" },
  { id: 2, name_ka: "იმერეთი" },
];
const DELEGATES = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    first_name: "გიორგი",
    last_name: "მაისურაძე",
    region_id: 1,
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000002",
    first_name: "თამარ",
    last_name: "კვარაცხელია",
    region_id: 2,
  },
];

beforeEach(() => changeDelegateAction.mockReset());

describe("DelegateChange", () => {
  it("lists central first, filters by region, marks the current choice", () => {
    render(
      <DelegateChange
        regions={REGIONS}
        delegates={DELEGATES}
        currentDelegateId={DELEGATES[0]!.id}
        initialRegionId={1}
      />,
    );
    const select = screen.getByLabelText("დელეგატი");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options[0]).toBe("ცენტრალური მოძრაობა");
    expect(options[1]).toBe("გიორგი მაისურაძე (მიმდინარე)");
    expect(options).toHaveLength(2); // Imereti delegate filtered out
  });

  it("refuses re-choosing the current delegate without a server call", () => {
    render(
      <DelegateChange
        regions={REGIONS}
        delegates={DELEGATES}
        currentDelegateId={DELEGATES[0]!.id}
        initialRegionId={1}
      />,
    );
    fireEvent.change(screen.getByLabelText("დელეგატი"), { target: { value: DELEGATES[0]!.id } });
    fireEvent.click(screen.getByRole("button", { name: "დელეგატის შეცვლა" }));
    expect(screen.getByText("ეს დელეგატი უკვე არჩეულია")).toBeInTheDocument();
    expect(changeDelegateAction).not.toHaveBeenCalled();
  });

  it("changes to central (null) and confirms", async () => {
    changeDelegateAction.mockResolvedValue({ ok: true, state: {} });
    render(
      <DelegateChange
        regions={REGIONS}
        delegates={DELEGATES}
        currentDelegateId={DELEGATES[0]!.id}
        initialRegionId={1}
      />,
    );
    fireEvent.change(screen.getByLabelText("დელეგატი"), { target: { value: "central" } });
    fireEvent.click(screen.getByRole("button", { name: "დელეგატის შეცვლა" }));
    await waitFor(() => expect(changeDelegateAction).toHaveBeenCalledWith({ delegateId: null }));
    expect(await screen.findByText("დელეგატი შეიცვალა ✓")).toBeInTheDocument();
  });
});
