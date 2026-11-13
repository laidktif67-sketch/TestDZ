import type { ReactNode } from "react";

type AdminIconName = "search" | "bell" | "mail" | "home" | "file" | "calendar" | "download" | "clock" | "wallet" | "card" | "shield" | "user" | "phone" | "pin" | "alert" | "check" | "close" | "refresh" | "arrow" | "gift" | "chart" | "settings";

const paths: Record<AdminIconName, ReactNode> = {
 search: <><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 4.5 4.5"/></>,
 bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
 mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
 home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
 file: <><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v6h5M9 13h7M9 17h7"/></>,
 calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
 download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 17v4h14v-4"/></>,
 clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
 wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/></>,
 card: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>,
 shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/></>,
 user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
 phone: <><path d="M7 3H5a2 2 0 0 0-2 2c0 8.8 7.2 16 16 16a2 2 0 0 0 2-2v-2l-5-2-2 3a14 14 0 0 1-6-6l3-2z"/></>,
 pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
 alert: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5m0 3h.01"/></>,
 check: <path d="m5 12 4 4L19 6"/>,
 close: <path d="m6 6 12 12M18 6 6 18"/>,
 refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/></>,
 arrow: <><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></>,
 gift: <><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 2.5-2.5V8zM12 8h4.5A2.5 2.5 0 1 0 14 5.5V8z"/></>,
 chart: <><path d="M3 3v18h18"/><path d="m7 15 4-4 4 3 5-7"/></>,
 settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2z"/></>,
};

export default function AdminIcon({ name, size = 18 }: { name: AdminIconName; size?: number }) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
