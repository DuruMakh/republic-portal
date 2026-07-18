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
  it("renders applicant facts with the ID masked and both actions", () => {
    render(
      <VerifyCard
        applicant={applicant}
        mode="pending"
        reveal={noopReveal}
        approve={vi.fn()}
        reject={vi.fn()}
      />,
    );
    expect(screen.getByText("გიორგი მელაძე")).toBeInTheDocument();
    expect(screen.getByText("იმერეთი")).toBeInTheDocument();
    expect(screen.getByText("•••••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "დადასტურება" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "უარყოფა" })).toBeInTheDocument();
  });

  it("approve calls the action and shows the public-page link on success", async () => {
    const approve = vi.fn().mockResolvedValue({ ok: true, slug: "giorgi-meladze" });
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
    await waitFor(() => expect(screen.getByText(/დელეგატი დამტკიცდა/)).toBeInTheDocument());
    expect(approve).toHaveBeenCalledWith("d-1");
    expect(screen.getByRole("link", { name: /საჯარო გვერდი/ })).toHaveAttribute(
      "href",
      "/delegates/giorgi-meladze",
    );
  });

  it("reject asks for an optional note, then confirms", async () => {
    const reject = vi.fn().mockResolvedValue({ ok: true });
    render(
      <VerifyCard
        applicant={applicant}
        mode="pending"
        reveal={noopReveal}
        approve={vi.fn()}
        reject={reject}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "უარყოფა" }));
    fireEvent.change(screen.getByLabelText(/შიდა შენიშვნა/), {
      target: { value: "დოკუმენტები აკლია" },
    });
    fireEvent.click(screen.getByRole("button", { name: "უარყოფის დადასტურება" }));
    await waitFor(() => expect(screen.getByText(/უარყოფილია/)).toBeInTheDocument());
    expect(reject).toHaveBeenCalledWith("d-1", "დოკუმენტები აკლია");
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
