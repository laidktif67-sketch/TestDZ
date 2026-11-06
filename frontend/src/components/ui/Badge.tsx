import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
export type BadgeVariant="success"|"warning"|"error"|"info"|"neutral"|"primary";
interface BadgeProps extends HTMLAttributes<HTMLSpanElement>{variant?:BadgeVariant;dot?:boolean}
export function Badge({variant="neutral",dot=false,className,children,...props}:BadgeProps){return <span className={cn("tdz-badge",`tdz-badge--${variant}`,className)} {...props}>{dot&&<i className="tdz-badge-dot" aria-hidden="true"/>}{children}</span>;}
