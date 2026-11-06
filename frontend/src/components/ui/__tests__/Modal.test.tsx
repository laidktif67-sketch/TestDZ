import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../Modal";

describe("Modal", () => {
  it("renders nothing while closed", () => {
    render(<Modal open={false} onClose={vi.fn()} title="Dialog">Body</Modal>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an accessible dialog with its title and content", () => {
    render(<Modal open onClose={vi.fn()} title="Confirm action">Dialog content</Modal>);
    expect(screen.getByRole("dialog", { name: "Confirm action" })).toBeInTheDocument();
    expect(screen.getByText("Dialog content")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Dialog">Body</Modal>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the backdrop itself is pressed", () => {
    const onClose = vi.fn();
    const { container } = render(<Modal open onClose={onClose} title="Dialog">Body</Modal>);
    const backdrop = container.querySelector(".tdz-modal-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when the dialog content is pressed", () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Dialog">Body</Modal>);
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
