import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BallotBar, ballotButtonClasses } from "./Ballot";

describe("Ballot", () => {
  describe("ballotButtonClasses", () => {
    it("muted state contains border-hairline", () => {
      const classes = ballotButtonClasses("muted");
      expect(classes).toContain("border-hairline");
    });

    it("solid state does not contain border-hairline", () => {
      const classes = ballotButtonClasses("solid");
      expect(classes).not.toContain("border-hairline");
    });

    it("solid state contains border-ink", () => {
      const classes = ballotButtonClasses("solid");
      expect(classes).toContain("border-ink");
    });
  });

  describe("BallotBar", () => {
    it("fill has width: 45% for pct={45}", () => {
      render(<BallotBar label="Yes" pct={45} tone="brand" />);
      const fillElement = document.querySelector("[style*='width: 45%']");
      expect(fillElement).toBeInTheDocument();
    });

    it("fill has bg-brand for tone brand", () => {
      render(<BallotBar label="Yes" pct={45} tone="brand" />);
      const fillElement = document.querySelector(".bg-brand");
      expect(fillElement).toBeInTheDocument();
    });

    it("fill has bg-ink for tone ink", () => {
      render(<BallotBar label="Yes" pct={45} tone="ink" />);
      const fillElement = document.querySelector(".bg-ink");
      expect(fillElement).toBeInTheDocument();
    });

    it("fill has bg-muted-fg for tone muted", () => {
      render(<BallotBar label="Yes" pct={45} tone="muted" />);
      const fillElement = document.querySelector(".bg-muted-fg");
      expect(fillElement).toBeInTheDocument();
    });

    it("renders label", () => {
      render(<BallotBar label="Yes votes" pct={45} tone="brand" />);
      expect(screen.getByText("Yes votes")).toBeInTheDocument();
    });

    it("renders pct value", () => {
      render(<BallotBar label="Yes" pct={45} tone="brand" />);
      expect(screen.getByText("45")).toBeInTheDocument();
    });

    it("renders value in place of pct when provided, fill width still from pct", () => {
      render(<BallotBar label="თბილისი" pct={45} tone="brand" value="1 204" />);
      expect(screen.getByText("1 204")).toBeInTheDocument();
      expect(screen.queryByText("45")).not.toBeInTheDocument();
      const fillElement = document.querySelector("[style*='width: 45%']");
      expect(fillElement).toBeInTheDocument();
    });
  });
});
