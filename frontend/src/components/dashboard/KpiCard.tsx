import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: number; label: string };
  tone?: "primary" | "success" | "warning" | "info";
  className?: string;
}

const tones = {
  primary: "tdz-kpi-icon--primary",
  success: "tdz-kpi-icon--success",
  warning: "tdz-kpi-icon--warning",
  info: "tdz-kpi-icon--info",
};

export function KpiCard({ label, value, icon, trend, tone = "primary", className }: KpiCardProps) {
  const positive = (trend?.value ?? 0) >= 0;
  return (
    <article className={cn("tdz-kpi-card", className)}>
      <div className={cn("tdz-kpi-icon", tones[tone])} aria-hidden="true">{icon}</div>
      <div className="tdz-kpi-copy">
        <p className="tdz-kpi-value">{value}</p>
        <p className="tdz-kpi-label">{label}</p>
      </div>
      {trend && (
        <p className={cn("tdz-kpi-trend", positive ? "tdz-kpi-trend--positive" : "tdz-kpi-trend--negative")}>
          <span aria-hidden="true">{positive ? "↗" : "↘"}</span>
          <span>{trend.label}</span>
        </p>
      )}
    </article>
  );
}
