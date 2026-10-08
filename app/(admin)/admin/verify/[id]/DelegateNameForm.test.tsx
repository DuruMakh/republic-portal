import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DelegateNameForm } from "./DelegateNameForm";

describe("DelegateNameForm", () => {
  it("prefills both names and saves them together", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    render(
      <DelegateNameForm
        delegateId="d1"
        initialFirstName="ნინო"
        initialLastName="ბერიძე"
        save={save}
      />,
    );
    const first = screen.getByLabelText("სახელი");
    expect(first).toHaveValue("ნინო");
    expect(screen.getByLabelText("გვარი")).toHaveValue("ბერიძე");
    fireEvent.change(first, { target: { value: "ნინა" } });
    fireEvent.click(screen.getByRole("button", { name: "სახელის შენახვა" }));
    expect(await screen.findByText("სახელი განახლდა ✓")).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith({ delegateId: "d1", firstName: "ნინა", lastName: "ბერიძე" });
  });

  it("shows the server's refusal", async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, error: "შეავსე სახელი და გვარი." });
    render(
      <DelegateNameForm delegateId="d1" initialFirstName="ა" initialLastName="ბ" save={save} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "სახელის შენახვა" }));
    expect(await screen.findByText("შეავსე სახელი და გვარი.")).toBeInTheDocument();
  });
});
