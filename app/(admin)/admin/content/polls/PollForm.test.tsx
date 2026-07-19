import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
vi.mock("./actions", () => ({ savePollAction: (input: unknown) => saveMock(input) }));
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { PollForm } from "./PollForm";

describe("PollForm", () => {
  beforeEach(() => {
    saveMock.mockReset();
    pushMock.mockReset();
  });

  it("starts with two option rows; rows are addable and removable to a floor of 2", () => {
    render(<PollForm poll={null} />);
    expect(screen.getAllByLabelText(/^პასუხი \d+$/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "პასუხის დამატება" }));
    expect(screen.getAllByLabelText(/^პასუხი \d+$/)).toHaveLength(3);
    const removes = screen.getAllByRole("button", { name: "წაშალე პასუხი" });
    fireEvent.click(removes[2]!);
    expect(screen.getAllByLabelText(/^პასუხი \d+$/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "წაშალე პასუხი" })).not.toBeInTheDocument();
  });

  it("submits question, trimmed options and empty endsAt", async () => {
    saveMock.mockResolvedValue({ ok: true, id: "p-new" });
    render(<PollForm poll={null} />);
    fireEvent.change(screen.getByLabelText("კითხვა"), { target: { value: "სად?" } });
    const options = screen.getAllByLabelText(/^პასუხი \d+$/);
    fireEvent.change(options[0]!, { target: { value: "თბილისი" } });
    fireEvent.change(options[1]!, { target: { value: "ბათუმი" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({
        id: undefined,
        question: "სად?",
        options: ["თბილისი", "ბათუმი"],
        endsAt: "",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/content/polls/p-new"));
  });
});
