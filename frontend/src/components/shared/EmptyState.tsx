import type { ReactNode } from "react";
import { Button } from "../ui/Button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <section className="tdz-empty-state" aria-labelledby="tdz-empty-state-title">
      {icon && <div className="tdz-empty-state-icon" aria-hidden="true">{icon}</div>}
      <h2 id="tdz-empty-state-title">{title}</h2>
      <p>{description}</p>
      {(action || secondaryAction) && (
        <div className="tdz-empty-state-actions">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && <Button variant="ghost" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
        </div>
      )}
    </section>
  );
}
