import type { HTMLAttributes } from "react";
import { cn } from "../../../lib/cn";
type CardProps=HTMLAttributes<HTMLDivElement>&{variant?:"default"|"bordered"|"elevated"|"interactive"};
export function Card({variant="default",className,...props}:CardProps){return <div className={cn("tdz-card",`tdz-card--${variant}`,className)} {...props}/>;}
export function CardHeader({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn("tdz-card-header",className)} {...props}/>;}
export function CardTitle({className,...props}:HTMLAttributes<HTMLHeadingElement>){return <h3 className={cn("tdz-card-title",className)} {...props}/>;}
export function CardContent({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn("tdz-card-content",className)} {...props}/>;}
export function CardFooter({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn("tdz-card-footer",className)} {...props}/>;}
