import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "../Progress";

describe("Progress", () => {
  it("exposes the current value to assistive technology", () => {
    render(<Progress value={45} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "45");
  });

  it("clamps values above the maximum", () => {
    render(<Progress value={150} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders the label and calculated percentage", () => {
    render(<Progress value={25} label="Upload" showLabel />);
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
