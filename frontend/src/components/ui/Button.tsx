import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; fullWidth?: boolean;
  leftIcon?: ReactNode; rightIcon?: ReactNode;
}
export function Button({variant="primary",size="md",loading=false,fullWidth=false,leftIcon,rightIcon,className,children,disabled,...props}:ButtonProps){
  return <button className={cn("tdz-button",`tdz-button--${variant}`,`tdz-button--${size}`,fullWidth&&"tdz-button--full",className)}
    disabled={disabled||loading} aria-busy={loading||undefined} {...props}>
    {loading?<span className="tdz-spinner" aria-hidden="true"/>:leftIcon}
    {children}{!loading&&rightIcon}
  </button>;
}
