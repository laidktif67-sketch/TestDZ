import * as React from "react";
import { cn } from "../../lib/cn";
interface AvatarProps{src?:string|null;fallback?:string;size?:"xs"|"sm"|"md"|"lg"|"xl";className?:string;alt?:string}
function initials(value?:string){const parts=value?.trim().split(/\s+/).filter(Boolean)??[];return parts.length>1?(parts[0][0]+parts.at(-1)![0]).toLocaleUpperCase():parts[0]?.slice(0,2).toLocaleUpperCase()??"؟"}
export function Avatar({src,fallback,size="md",className,alt=""}:AvatarProps){
 const [failed,setFailed]=React.useState(false);React.useEffect(()=>setFailed(false),[src]);
 return <span className={cn("tdz-avatar",`tdz-avatar--${size}`,className)}>{src&&!failed?<img src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>:<span aria-hidden="true">{initials(fallback)}</span>}</span>;
}
