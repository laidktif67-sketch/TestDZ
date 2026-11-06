import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "../Avatar";

describe("Avatar", () => {
  it("derives initials from a multi-part fallback name", () => {
    render(<Avatar fallback="Test DZ" />);
    expect(screen.getByText("TD")).toBeInTheDocument();
  });

  it("falls back to initials when the image fails to load", () => {
    render(<Avatar src="/missing-avatar.png" fallback="Test User" alt="Test User" />);
    fireEvent.error(screen.getByRole("img", { name: "Test User" }));
    expect(screen.getByText("TU")).toBeInTheDocument();
  });
});
