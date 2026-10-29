import { categoryIconKind } from '../utils/categoryTree';

// Inline line icons (no image assets, no icon library). All are decorative: callers provide the accessible name.
function Svg({ size = 18, children, className, strokeWidth = 1.5 }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
}

const CATEGORY_PATHS = {
  ring: <><circle cx="12" cy="15" r="5.5" /><circle cx="12" cy="15" r="3.8" /><path d="M9.6 6.2 12 3.5l2.4 2.7L12 9.4z" /></>,
  necklace: <><path d="M4.5 3.5c0 6.5 3.4 10.5 7.5 10.5s7.5-4 7.5-10.5" /><path d="M12 14v1.6" /><path d="m12 15.6-2.4 2.6 2.4 3.3 2.4-3.3z" /></>,
  earring: <><path d="M9.5 5.5a2.5 2.5 0 1 1 2.5 2.5v2" /><circle cx="12" cy="11.6" r="1.4" /><path d="m12 13-2.8 4 2.8 4 2.8-4z" /></>,
  bracelet: <><ellipse cx="12" cy="13.5" rx="8" ry="4.5" /><ellipse cx="12" cy="13.5" rx="5.8" ry="2.8" /><circle cx="12" cy="7.3" r="1.5" /></>,
  kieng: <><path d="M3.5 8.5c0 5.2 3.8 8.5 8.5 8.5s8.5-3.3 8.5-8.5" /><path d="M5.6 8.8c.4 3.9 3 6.2 6.4 6.2s6-2.3 6.4-6.2" /><circle cx="12" cy="17.8" r="1.4" /></>,
  brooch: <><circle cx="15.5" cy="8.5" r="4.5" /><circle cx="15.5" cy="8.5" r="1.5" /><path d="M3 21 12.3 11.7" /><path d="M4.5 16.5l3 3" /></>,
  gem: <><path d="M6 4h12l3.5 5L12 20.5 2.5 9z" /><path d="M2.5 9h19M9 4l3 16.5L15 4" /></>,
};
export function CategoryIcon({ name, size = 16 }) {
  return <Svg size={size} className="category-icon">{CATEGORY_PATHS[categoryIconKind(name)]}</Svg>;
}
export function ChevronIcon({ direction = 'down', size = 14 }) {
  const d = { down: 'm6 9 6 6 6-6', up: 'm6 15 6-6 6 6', left: 'm15 6-6 6 6 6', right: 'm9 6 6 6-6 6' }[direction];
  return <Svg size={size} strokeWidth={1.8}><path d={d} /></Svg>;
}
export function HeadsetIcon() {
  return <Svg size={16}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /><path d="M19 19c0 1.7-2 2.5-5 2.5" /></Svg>;
}
export function VietnamFlag() {
  return <svg className="flag-icon" width="20" height="14" viewBox="0 0 30 20" aria-hidden="true" focusable="false">
    <rect width="30" height="20" rx="2" fill="#da251d" />
    <path fill="#ffcd00" d="m15 4.2 1.35 4.15h4.36l-3.53 2.56 1.35 4.15L15 12.5l-3.53 2.56 1.35-4.15-3.53-2.56h4.36z" />
  </svg>;
}
export function UserIcon() { return <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></Svg>; }
export function UserPlusIcon() { return <Svg><circle cx="10" cy="8" r="4" /><path d="M2.5 21c.8-4 3.8-6 7.5-6 1.6 0 3 .4 4.2 1.1M18 14v6M15 17h6" /></Svg>; }
export function HeartIcon() { return <Svg><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></Svg>; }
export function BagIcon() { return <Svg><path d="M5 8h14l-1.2 12.5H6.2z" /><path d="M9 10V6.5a3 3 0 0 1 6 0V10" /></Svg>; }
export function OrdersIcon() { return <Svg><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></Svg>; }
export function AdminIcon() { return <Svg><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></Svg>; }
export function LogoutIcon() { return <Svg><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></Svg>; }
export function SearchIcon() { return <Svg size={18}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Svg>; }
export function MenuIcon() { return <Svg size={22}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>; }
