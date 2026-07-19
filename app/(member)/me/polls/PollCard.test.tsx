import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const voteMock = vi.fn();
vi.mock("./actions", () => ({ voteAction: (input: unknown) => voteMock(input) }));
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { PollCard } from "./PollCard";

const POLL_ID = "6f1b0a9e-0000-4000-8000-0000000000aa";
const OPT_A = "6f1b0a9e-0000-4000-8000-0000000000a1";
const OPT_B = "6f1b0a9e-0000-4000-8000-0000000000a2";

describe("PollCard", () => {
  beforeEach(() => {
    voteMock.mockReset();
    refreshMock.mockReset();
  });

  it("buttons view: one ghost button per option, vote submits", async () => {
    voteMock.mockResolvedValue({ ok: true });
    render(
      <PollCard
        pollId={POLL_ID}
        question="პრიორიტეტი?"
        view="buttons"
        deadlineKa="ბოლო ვადა: 29.07.2026, 12:00"
        options={[
          { optionId: OPT_A, label: "დიახ", pct: 0, votes: 0, mine: false },
          { optionId: OPT_B, label: "არა", pct: 0, votes: 0, mine: false },
        ]}
        total={0}
      />,
    );
    expect(screen.getByText("ბოლო ვადა: 29.07.2026, 12:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "დიახ" }));
    await waitFor(() =>
      expect(voteMock).toHaveBeenCalledWith({ pollId: POLL_ID, optionId: OPT_A }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("results-own view: bars with percentages, own choice marked, total line", () => {
    render(
      <PollCard
        pollId={POLL_ID}
        question="პრიორიტეტი?"
        view="results-own"
        deadlineKa={null}
        options={[
          { optionId: OPT_A, label: "დიახ", pct: 67, votes: 2, mine: true },
          { optionId: OPT_B, label: "არა", pct: 33, votes: 1, mine: false },
        ]}
        total={3}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText(/შენი არჩევანი/)).toBeInTheDocument();
    expect(screen.getByText("✓ შენ უკვე მიეცი ხმა · სულ 3 ხმა")).toBeInTheDocument();
  });

  it("results-closed view: bars for everyone, closed line", () => {
    render(
      <PollCard
        pollId={POLL_ID}
        question="დახურული?"
        view="results-closed"
        deadlineKa={null}
        options={[{ optionId: OPT_A, label: "დიახ", pct: 100, votes: 5, mine: false }]}
        total={5}
      />,
    );
    expect(screen.getByText("გამოკითხვა დასრულებულია · სულ 5 ხმა")).toBeInTheDocument();
  });

  it("surfaces the server error inline and keeps the buttons", async () => {
    voteMock.mockResolvedValue({ ok: false, error: "გამოკითხვა დახურულია." });
    render(
      <PollCard
        pollId={POLL_ID}
        question="გვიანი?"
        view="buttons"
        deadlineKa={null}
        options={[{ optionId: OPT_A, label: "დიახ", pct: 0, votes: 0, mine: false }]}
        total={0}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "დიახ" }));
    expect(await screen.findByText("გამოკითხვა დახურულია.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "დიახ" })).toBeInTheDocument();
  });
});
