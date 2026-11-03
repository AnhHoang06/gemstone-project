// Decorative line icons for the chat UI (callers provide accessible names).
function Svg({ size = 20, strokeWidth = 1.7, children, className }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
}
export function ChatBubbleIcon({ size = 26 }) {
  return <Svg size={size}><path d="M20.5 11.6c0 4.4-3.8 7.9-8.5 7.9-1.2 0-2.3-.2-3.3-.6L3.5 20.5l1.5-4.1c-.9-1.3-1.5-3-1.5-4.8C3.5 7.2 7.3 3.7 12 3.7s8.5 3.5 8.5 7.9Z" />
    <path d="M8.2 11.8h.01M12 11.8h.01M15.8 11.8h.01" strokeWidth={2.4} /></Svg>;
}
export function SendIcon() { return <Svg size={19}><path d="M4.5 12 3 4.5l18 7.5-18 7.5z" /><path d="M4.5 12H11" /></Svg>; }
export function CloseIcon({ size = 20 }) { return <Svg size={size}><path d="M6 6l12 12M18 6 6 18" /></Svg>; }
export function GemIcon({ size = 18 }) { return <Svg size={size} strokeWidth={1.4}><path d="M6 4h12l3.5 5L12 20.5 2.5 9z" /><path d="M2.5 9h19M9 4l3 16.5L15 4" /></Svg>; }
export function RetryIcon() { return <Svg size={14} strokeWidth={2}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></Svg>; }
export function BackIcon() { return <Svg size={18}><path d="m15 6-6 6 6 6" /></Svg>; }
export function ArrowDownIcon() { return <Svg size={16} strokeWidth={2}><path d="M12 5v14M6 13l6 6 6-6" /></Svg>; }
export function ClockIcon({ size = 18 }) { return <Svg size={size}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>; }
export function CalendarIcon({ size = 18 }) { return <Svg size={size}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>; }
export function PinIcon({ size = 18 }) { return <Svg size={size}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></Svg>; }
export function PhoneIcon({ size = 18 }) { return <Svg size={size}><path d="M5 3.5h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.8 6.8l1.4-2.2 4.3 1.7V19a1.6 1.6 0 0 1-1.7 1.6C10.4 20.1 3.9 13.6 3.4 5.2A1.6 1.6 0 0 1 5 3.5Z" /></Svg>; }
export function MailIcon({ size = 18 }) { return <Svg size={size}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></Svg>; }
export function LinkIcon({ size = 18 }) { return <Svg size={size}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>; }
export function SearchIcon() { return <Svg size={17}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Svg>; }
// The gem mark from assets/logo-mark.svg without the wordmark (same paths/colours), for small avatars.
export function BrandMark({ size = 22 }) {
  return <svg width={size} height={size} viewBox="3 2 47 44" aria-hidden="true" focusable="false">
    <path d="M27 4 48 17 40 43H14L5 17z" fill="#0b5f4d" />
    <path d="M27 4 26 43 48 17z" fill="#d8b56d" opacity=".65" />
    <path d="M5 17h43M14 43 27 4l13 39M5 17l21 26" fill="none" stroke="#fff6d8" strokeWidth="1.6" />
  </svg>;
}
