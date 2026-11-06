import * as React from "react";
import { cn } from "../../lib/cn";
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>{label?:string;error?:string;hint?:string;startAdornment?:React.ReactNode;endAdornment?:React.ReactNode}
export const Input=React.forwardRef<HTMLInputElement,InputProps>(function Input({label,error,hint,startAdornment,endAdornment,className,id,required,...props},ref){
  const generated=React.useId();const inputId=id??generated;const messageId=error?`${inputId}-error`:hint?`${inputId}-hint`:undefined;
  return <div className="tdz-field">{label&&<label className="tdz-label" htmlFor={inputId}>{label}{required&&<span className="tdz-required" aria-hidden="true"> *</span>}</label>}
    <div className={cn("tdz-input-wrap",error&&"is-error")}>{startAdornment&&<span className="tdz-input-adornment">{startAdornment}</span>}
      <input ref={ref} id={inputId} className={cn("tdz-input",className)} aria-invalid={!!error} aria-describedby={messageId} required={required} {...props}/>
      {endAdornment&&<span className="tdz-input-adornment">{endAdornment}</span>}</div>
    {error&&<p id={messageId} className="tdz-field-error" role="alert">{error}</p>}
    {!error&&hint&&<p id={messageId} className="tdz-field-hint">{hint}</p>}
  </div>;
});
