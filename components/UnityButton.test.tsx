import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnityButton } from "./UnityButton";
import { UnityButtonLink, unityButtonClasses } from "./UnityButtonLink";

describe("UnityButton", () => {
  it("is a real button named in ordinary letters that does not submit by default", () => {
    const onClick = vi.fn();
    render(<UnityButton onClick={onClick}>გაგზავნა</UnityButton>);
    const button = screen.getByRole("button", { name: "გაგზავნა" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("passes type and disabled through", () => {
    render(
      <UnityButton type="submit" disabled>
        გაგზავნა
      </UnityButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeDisabled();
  });

  it("looks like UnityButtonLink with the same variant and size", () => {
    render(
      <>
        <UnityButton variant="cream" size="lg">
          შემოგვიერთდი
        </UnityButton>
        <UnityButtonLink href="/join" variant="cream" size="lg">
          შემოგვიერთდი
        </UnityButtonLink>
      </>,
    );
    const shared = unityButtonClasses("cream", "lg").trim();
    expect(screen.getByRole("button").className).toContain(shared);
    expect(screen.getByRole("link").className).toContain(shared);
  });

  it("has the account screens' teal and danger variants", () => {
    expect(unityButtonClasses("teal")).toContain("bg-teal");
    expect(unityButtonClasses("teal")).toContain("hover:bg-teal-dark");
    expect(unityButtonClasses("danger")).toContain("border-brand");
    expect(unityButtonClasses("danger")).toContain("hover:bg-brand");
  });
});
