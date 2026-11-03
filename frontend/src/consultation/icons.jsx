import { serviceKind } from "./status";

// Thin line icons for consultation UI (decorative; callers supply accessible names).
function Svg({ size = 20, children, strokeWidth = 1.5 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
}
export function CalendarIcon({ size = 18 }) {
  return <Svg size={size}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M8 13.5h2M14 13.5h2M8 17h2" /></Svg>;
}
export function ClockIcon({ size = 14 }) { return <Svg size={size} strokeWidth={1.8}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>; }
export function CheckIcon({ size = 14 }) { return <Svg size={size} strokeWidth={2.2}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>; }
export function ArrowIcon({ direction = "right", size = 16 }) {
  return <Svg size={size} strokeWidth={1.8}><path d={direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} /></Svg>;
}
const SERVICE_PATHS = {
  design: <><circle cx="12" cy="15" r="5.5" /><circle cx="12" cy="15" r="3.6" /><path d="M9.4 6.4 12 3.5l2.6 2.9L12 9.6z" /></>,
  appraisal: <><circle cx="10" cy="10" r="6" /><path d="m14.5 14.5 6 6" /><path d="M7.5 9h5l-2.5 3.2z" /></>,
  gift: <><rect x="3.5" y="9" width="17" height="11.5" rx="1.5" /><path d="M3.5 13h17M12 9v11.5" /><path d="M12 9c-1.5-3.5-5.5-4-5.5-1.7C6.5 9 9.5 9 12 9c2.5 0 5.5 0 5.5-1.7C17.5 5 13.5 5.5 12 9z" /></>,
  gem: <><path d="M6 4h12l3.5 5L12 20.5 2.5 9z" /><path d="M2.5 9h19M9 4l3 16.5L15 4" /></>,
};
export function ServiceIcon({ name, size = 26 }) { return <Svg size={size} strokeWidth={1.3}>{SERVICE_PATHS[serviceKind(name)]}</Svg>; }
