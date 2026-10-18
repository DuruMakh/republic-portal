import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { HomeHero } from "./HomeHero";
import { HomeMission } from "./HomeMission";
import { HomePrinciples } from "./HomePrinciples";
import { UnityDocumentFan } from "./UnityDocumentFan";
import { UnityNewsTile } from "./UnityNewsTile";
import { HOME_DOCUMENTS, HOME_DOCUMENTS_CAPTION } from "@/lib/home-copy";
import StructurePage from "@/app/[locale]/(unity)/structure/page";
import { SupportForm } from "@/app/[locale]/(unity)/support/SupportForm";

describe("English public pages", () => {
  it("presents the homepage invitation and agreement in English", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <HomeHero />
        <HomeMission
          stats={{
            registered_total: 100,
            members_total: 20,
            approved_delegates: 5,
            active_members: 20,
          }}
        />
        <HomePrinciples />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Together, let’s build the Georgian Republic",
    );
    expect(screen.getByRole("link", { name: "Become a supporter" })).toHaveAttribute(
      "href",
      "/en/join",
    );
    expect(screen.getByRole("heading", { name: "What unites us" })).toBeInTheDocument();
    expect(screen.getByText("Supporters")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Delegates")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Georgia’s independence and sovereignty" }),
    ).toHaveAttribute("href", "/en/principles#principle-1");
  });

  it("keeps published Georgian text intact and labels its language", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <UnityNewsTile
          href="/news/original"
          title="ჩვენი ახალი ამბავი"
          excerptText="ავტორის უცვლელი ტექსტი"
          publishedAt="18 October 2026"
          imageUrl={null}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("This content is available in Georgian.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ჩვენი ახალი ამბავი" })).toHaveAttribute(
      "lang",
      "ka",
    );
    expect(screen.getByText("ავტორის უცვლელი ტექსტი")).toHaveAttribute("lang", "ka");
  });

  it("translates archive controls and captions while retaining the original scan", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <UnityDocumentFan documents={HOME_DOCUMENTS} caption={HOME_DOCUMENTS_CAPTION} />
      </NextIntlClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enlarge — Cover of the 1921 Constitution" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Cover of the 1921 Constitution" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cover of the 1921 Constitution" })).toHaveAttribute(
      "src",
      HOME_DOCUMENTS[0].src,
    );
    expect(screen.getAllByText("Original document in Georgian.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("explains changing board decisions in English", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <StructurePage />
      </NextIntlClientProvider>,
    );

    const votes = screen.getByRole("group", { name: "4 of 5 votes" });
    fireEvent.click(within(votes).getByRole("button", { name: "Board member 1" }));
    expect(screen.getByText("The decision does not pass")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Organisational structure");
  });

  it("explains contact-form validation in English before sending", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <SupportForm submit={async () => ({ ok: true })} />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Complete this field")).toBeInTheDocument();
    expect(screen.getByText("Enter an email address or phone number.")).toBeInTheDocument();
  });
});
