import type { ReactNode } from "react";

type PaymentMethod = "PayPal" | "Cryptocurrency" | "Bank Transfer" | "Points" | "Platform Balance" | "Original Method" | "other";

function resolveMethod(method: string): PaymentMethod {
  const value = method.toLowerCase();
  if (value.includes("paypal")) return "PayPal";
  if (value.includes("crypto") || value.includes("usdt") || value.includes("tether")) return "Cryptocurrency";
  if (value.includes("bank") || value.includes("transfer")) return "Bank Transfer";
  if (value.includes("point") || value.includes("reward")) return "Points";
  if (value.includes("balance")) return "Platform Balance";
  if (value.includes("original")) return "Original Method";
  return "other";
}

export default function AdminPaymentMethodIcon({ method, size = 24 }: { method: string; size?: number }) {
  const kind = resolveMethod(method);
  let artwork: ReactNode;
  if (kind === "PayPal") {
    artwork = <><path fill="#003087" d="M8.1 4.2h6.1c3.5 0 5.1 1.8 4.5 4.8-.6 3.1-2.8 4.7-6 4.7h-2l-.9 5H5.9L8.1 4.2Z"/><path fill="#009CDE" d="M10.1 6.2h5.1c3.1 0 4.4 1.6 3.9 4.2-.5 2.8-2.5 4.1-5.4 4.1h-2.1l-.7 4H7.4l2.7-12.3Z"/><path fill="#012169" d="M7.1 8h5.1c2.9 0 4.1 1.4 3.7 3.7-.4 2.5-2.3 3.8-5 3.8H8.7l-.8 4H4.6L7.1 8Z"/></>;
  } else if (kind === "Cryptocurrency") {
    artwork = <><circle cx="12" cy="12" r="11" fill="#26A17B"/><path fill="#fff" d="M17.6 8.2h-4.1V6.4h-2.8v1.8H6.6v2.1h4.1v1.4H6.6v2.1h4.1v3.8h2.8v-3.8h4.1v-2.1h-4.1v-1.4h4.1z"/><path fill="#fff" d="M5.5 9.3h13v1.3h-13z" opacity=".92"/></>;
  } else if (kind === "Bank Transfer") {
    artwork = <><rect x="2" y="3" width="20" height="18" rx="4" fill="#E8F0FE"/><path d="M4.5 9 12 4.5 19.5 9M5.5 10h13M7 10v7m5-7v7m5-7v7M4.5 18.5h15" fill="none" stroke="#2859A8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></>;
  } else if (kind === "Points") {
    artwork = <><circle cx="12" cy="12" r="11" fill="#F3E8FF"/><path d="m12 4 2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" fill="#7E22CE"/></>;
  } else if (kind === "Platform Balance") {
    artwork = <><rect x="2" y="4" width="20" height="16" rx="4" fill="#E0F2FE"/><path d="M3 9h18M15.5 14h3" stroke="#0369A1" strokeWidth="1.8" strokeLinecap="round"/></>;
  } else {
    artwork = <><circle cx="12" cy="12" r="10" fill="#F1F5F9"/><path d="M7 12h10" stroke="#64748B" strokeWidth="2" strokeLinecap="round"/></>;
  }
  return <svg className={"admin-payment-method-icon admin-payment-method-icon--" + kind.toLowerCase().replace(/[^a-z]+/g, "-")} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{artwork}</svg>;
}
