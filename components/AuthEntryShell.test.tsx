import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthEntryShell } from "./AuthEntryShell";
import { AuthProgress } from "./AuthProgress";

describe("AuthEntryShell", () => {
  it("labels the page, action, and explanatory rail as one auth experience", () => {
    render(
      <AuthEntryShell
        eyebrow="წევრის რეგისტრაცია"
        title="შემოგვიერთდი ერთ წუთში"
        intro="მხოლოდ ძირითადი მონაცემები — დანარჩენს კაბინეტში ნახავ."
        progress={<AuthProgress currentStep="google" />}
        asideTitle="როგორ მუშაობს"
        aside={<p>შემდეგი ნაბიჯი</p>}
      >
        <button>Google-ით გაგრძელება</button>
      </AuthEntryShell>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-labelledby", "auth-entry-title");
    expect(within(main).getByRole("heading", { name: "შემოგვიერთდი ერთ წუთში" })).toHaveAttribute(
      "id",
      "auth-entry-title",
    );
    expect(within(main).getByRole("button", { name: "Google-ით გაგრძელება" })).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveAccessibleName("როგორ მუშაობს");
  });

  it("allows login to use the same composition without registration progress", () => {
    render(
      <AuthEntryShell
        eyebrow="პირადი კაბინეტი"
        title="შესვლა"
        intro="Google-ით შესვლა"
        asideTitle="პირველად ხარ?"
        aside={<p>წევრის რეგისტრაცია</p>}
      >
        <button>Google-ით შესვლა</button>
      </AuthEntryShell>,
    );

    expect(screen.queryByRole("list", { name: "რეგისტრაციის ნაბიჯები" })).toBeNull();
    expect(screen.getByRole("complementary")).toHaveAccessibleName("პირველად ხარ?");
  });
});
