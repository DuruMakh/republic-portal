import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhotoFigure } from "./PhotoFigure";

describe("PhotoFigure", () => {
  it("renders image with border", () => {
    render(
      <PhotoFigure
        src="/test.jpg"
        alt="Test image"
        width={300}
        height={200}
      />
    );
    const image = screen.getByAltText("Test image");
    expect(image).toBeInTheDocument();
  });

  it("renders caption when provided", () => {
    render(
      <PhotoFigure
        src="/test.jpg"
        alt="Test image"
        caption="This is a caption"
        width={300}
        height={200}
      />
    );
    expect(screen.getByText("This is a caption")).toBeInTheDocument();
  });

  it("does not render caption when not provided", () => {
    render(
      <PhotoFigure
        src="/test.jpg"
        alt="Test image"
        width={300}
        height={200}
      />
    );
    expect(screen.queryByText(/caption/)).not.toBeInTheDocument();
  });
});
