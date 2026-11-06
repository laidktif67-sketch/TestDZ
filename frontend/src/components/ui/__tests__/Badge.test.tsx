import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../Badge";

describe("Badge", () => {
  it("renders its label", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders a decorative dot when requested", () => {
    const { container } = render(<Badge dot>Active</Badge>);
    expect(container.querySelector(".tdz-badge-dot")).toHaveAttribute("aria-hidden", "true");
  });
});
