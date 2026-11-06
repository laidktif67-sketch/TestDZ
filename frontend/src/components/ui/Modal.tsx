import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
interface ModalProps{open:boolean;onClose:()=>void;title:string;description?:string;children:React.ReactNode;footer?:React.ReactNode;closeLabel?:string}
export function Modal({open,onClose,title,description,children,footer,closeLabel="إغلاق"}:ModalProps){
 const dialogRef=React.useRef<HTMLDivElement>(null);const titleId=React.useId();
 React.useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null;const oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";dialogRef.current?.focus();
 const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();onClose();}if(event.key==="Tab"&&dialogRef.current){const items=dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');if(!items.length){event.preventDefault();return;}const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};
 document.addEventListener("keydown",onKey);return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=oldOverflow;previous?.focus();};},[open,onClose]);
 if(!open||typeof document==="undefined")return null;
 return createPortal(<div className="tdz-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={dialogRef} className="tdz-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
 <header className="tdz-modal-header"><div><h2 id={titleId}>{title}</h2>{description&&<p>{description}</p>}</div><Button variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel}>×</Button></header>
 <div className="tdz-modal-body">{children}</div>{footer&&<footer className="tdz-modal-footer">{footer}</footer>}</section></div>,document.body);
}
