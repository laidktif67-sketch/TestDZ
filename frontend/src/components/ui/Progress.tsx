import { cn } from "../../lib/cn";
interface ProgressProps{value:number;max?:number;variant?:"default"|"success"|"warning"|"error";size?:"sm"|"md"|"lg";showLabel?:boolean;label?:string;className?:string}
export function Progress({value,max=100,variant="default",size="md",showLabel=false,label,className}:ProgressProps){
 const safeMax=Number.isFinite(max)&&max>0?max:100;const safeValue=Number.isFinite(value)?Math.min(safeMax,Math.max(0,value)):0;const percent=(safeValue/safeMax)*100;
 return <div className={cn("tdz-progress",className)}>{(showLabel||label)&&<div className="tdz-progress-label"><span>{label}</span>{showLabel&&<span>{Math.round(percent)}%</span>}</div>}
 <div className={cn("tdz-progress-track",`tdz-progress--${size}`)} role="progressbar" aria-label={label??"التقدم"} aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={safeMax}><span className={`tdz-progress-fill tdz-progress-fill--${variant}`} style={{width:`${percent}%`}}/></div></div>;
}
