import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
type ToastKind="success"|"error"|"warning"|"info";
interface ToastItem{id:number;title:string;description?:string;kind:ToastKind}
interface ToastContextValue{show:(toast:Omit<ToastItem,"id">)=>void}
const ToastContext=React.createContext<ToastContextValue|null>(null);
export function ToastProvider({children}:{children:React.ReactNode}){
 const [items,setItems]=React.useState<ToastItem[]>([]);
 const timers=React.useRef(new Map<number,number>());
 const dismiss=React.useCallback((id:number)=>{setItems(current=>current.filter(item=>item.id!==id));const timer=timers.current.get(id);if(timer)window.clearTimeout(timer);timers.current.delete(id);},[]);
 const show=React.useCallback((toast:Omit<ToastItem,"id">)=>{const id=Date.now()+Math.floor(Math.random()*1000);setItems(current=>[...current,{...toast,id}].slice(-5));const timer=window.setTimeout(()=>dismiss(id),5000);timers.current.set(id,timer);},[dismiss]);
 React.useEffect(()=>()=>timers.current.forEach(timer=>window.clearTimeout(timer)),[]);
 return <ToastContext.Provider value={{show}}>{children}{typeof document!=="undefined"&&createPortal(<div className="tdz-toast-region" aria-live="polite" aria-relevant="additions text">{items.map(item=><div key={item.id} className={cn("tdz-toast",`tdz-toast--${item.kind}`)} role={item.kind==="error"?"alert":"status"}><div><strong>{item.title}</strong>{item.description&&<p>{item.description}</p>}</div><button type="button" onClick={()=>dismiss(item.id)} aria-label="إغلاق الإشعار">×</button></div>)}</div>,document.body)}</ToastContext.Provider>;
}
export function useToast(){const context=React.useContext(ToastContext);if(!context)throw new Error("useToast must be used inside ToastProvider");return context;}
