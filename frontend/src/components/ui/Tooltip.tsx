import type { ReactNode } from "react";
interface TooltipProps{content:string;children:ReactNode}
export function Tooltip({content,children}:TooltipProps){return <span className="tdz-tooltip" data-tooltip={content}>{children}</span>;}
