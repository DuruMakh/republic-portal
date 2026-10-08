import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerifyCard } from "./VerifyCard";

const applicant = {
  id: "d-1",
  firstName: "გიორგი",
  lastName: "მელაძე",
  regionNameKa: "იმერეთი",
  phone: "+995551112233",
  createdAt: "2026-07-10T10:00:00Z",
  reviewNote: null as string | null,
  verifiedAt: null as string | null,
  verifiedByName: null as string | null,
};

function noopReveal() {
  return Promise.resolve({ ok: true as const, personalId: "01017056789" });
}

describe("VerifyCard (spec §3.4)", () => {
  it("masks the personal ID until it is revealed", () => {
    render(
      <VerifyCard
        applicant={applicant}
        mode="pending"
        reveal={noopReveal}
        approve={vi.fn()}
        reject={vi.fn()}
      />,
    );
    expect(screen.getByText("•••••••••••")).toBeInTheDocument();
    expect(screen.queryByText("01017056789")).not.toBeInTheDocument();
  });

  it("rejected mode shows the stored note, the decision stamp, and only re-approve", () => {
    render(
      <VerifyCard
        applicant={{
          ...applicant,
          reviewNote: "დოკუმენტები აკლია",
          verifiedAt: "2026-07-12T09:30:00Z",
          verifiedByName: "ვერიფიკატორი გუნდი",
        }}
        mode="rejected"
        reveal={noopReveal}
        approve={vi.fn()}
        reject={vi.fn()}
      />,
    );
    expect(screen.getByText(/დოკუმენტები აკლია/)).toBeInTheDocument();
    // the decision stamp (spec §3.4): date + who decided
    expect(screen.getByText(/უარყოფილია 12\.07\.2026 · ვერიფიკატორი გუნდი/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "დადასტურება" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "უარყოფა" })).not.toBeInTheDocument();
  });

  it("surfaces action errors in Georgian", async () => {
    const approve = vi.fn().mockResolvedValue({ ok: false, error: "შეცდომა" });
    render(
      <VerifyCard
        applicant={applicant}
        mode="pending"
        reveal={noopReveal}
        approve={approve}
        reject={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "დადასტურება" }));
    await waitFor(() => expect(screen.getByText("შეცდომა")).toBeInTheDocument());
  });
});
