import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "../Input";

describe("Input", () => {
  it("associates its label with the input", () => {
    render(<Input label="Email address" />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("exposes the required attribute and indicator", () => {
    render(<Input label="Email address" required />);
    expect(screen.getByRole("textbox")).toBeRequired();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("announces an error and marks the field invalid", () => {
    render(<Input label="Email address" error="Enter a valid email" />);
    expect(screen.getByText("Enter a valid email")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows hint text when there is no error", () => {
    render(<Input label="Email address" hint="We will not share it" />);
    expect(screen.getByText("We will not share it")).toBeInTheDocument();
  });

  it("prioritizes the error over hint text", () => {
    render(<Input label="Email address" hint="Helpful hint" error="Invalid value" />);
    expect(screen.getByText("Invalid value")).toBeInTheDocument();
    expect(screen.queryByText("Helpful hint")).not.toBeInTheDocument();
  });

  it("accepts keyboard input", async () => {
    render(<Input label="Email address" />);
    const input = screen.getByLabelText("Email address");
    await userEvent.type(input, "test@example.com");
    expect(input).toHaveValue("test@example.com");
  });
});
