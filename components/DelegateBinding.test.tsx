import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DelegateBinding } from "./DelegateBinding";

const options = [
  { id: "11111111-1111-4111-8111-111111111111", fullName: "გიორგი მაისურაძე", regionNameKa: "თბილისი" },
];

describe("DelegateBinding", () => {
  it("referral mode: read-only card, no picker", () => {
    render(
      <DelegateBinding
        referral={{ fullName: "გიორგი მაისურაძე", regionNameKa: "თბილისი" }}
        options={[]}
        value={null}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByText("გიორგი მაისურაძე")).toBeInTheDocument();
    expect(screen.getByText(/რეფერალური ბმულით/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("picker mode: central movement first and default", () => {
    render(<DelegateBinding referral={null} options={options} value={null} onChange={() => undefined} />);
    const select = screen.getByRole("combobox");
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveTextContent("ცენტრალური მოძრაობა");
    expect(select).toHaveValue("central");
  });
  it("picker mode: selecting a delegate reports its id, reselecting central reports null", () => {
    const onChange = vi.fn();
    render(<DelegateBinding referral={null} options={options} value={null} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: options[0]!.id },
    });
    expect(onChange).toHaveBeenCalledWith(options[0]!.id);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "central" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
