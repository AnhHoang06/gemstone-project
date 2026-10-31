import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo-mark.svg';
import { logout } from '../auth/session';
import CategoryTree from './CategoryTree';
import CategoryMegaMenu from './CategoryMegaMenu';
import useCategoryTree from '../hooks/useCategoryTree';
import { useCommerce } from '../commerce/context';
import { findCategoryPath } from '../utils/categoryTree';
import { CalendarIcon } from '../consultation/icons';
import { AdminIcon, BagIcon, ChevronIcon, HeadsetIcon, HeartIcon, LogoutIcon, MenuIcon, OrdersIcon, UserIcon, UserPlusIcon, VietnamFlag } from './Icons';

function IconLink({ to, label, children }) {
  return <NavLink to={to} className="header-icon" aria-label={label} data-tooltip={label}>{children}</NavLink>;
}

export default function Header() {
  const { token, cart, cartError } = useCommerce();
  const { data, loading, error } = useCategoryTree();
  const [open, setOpen] = useState(false), [mobile, setMobile] = useState(false), [language, setLanguage] = useState(false);
  const menu = useRef(null), trigger = useRef(null), drawer = useRef(null), languageRef = useRef(null);
  const { pathname, search } = useLocation();
  const nodes = data || [];
  const category = pathname === '/shop' ? new URLSearchParams(search).get('category') : null;
  const categoryPath = findCategoryPath(nodes, category);
  const currentRoot = categoryPath[0];
  useEffect(() => {
    const outside = event => {
      if (!menu.current?.contains(event.target)) setOpen(false);
      if (!languageRef.current?.contains(event.target)) setLanguage(false);
    };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); setLanguage(false); if (open) trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => {
    if (!mobile) return;
    const dialog = drawer.current, previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, [mobile]);
  const close = () => { setOpen(false); setMobile(false); };
  const isAdmin = token && localStorage.getItem('role') === 'Admin';
  const cartLabel = token ? `Giỏ hàng: ${cartError ? 'chưa tải được số lượng' : `${cart?.totalQuantity ?? '…'} sản phẩm`}` : 'Giỏ hàng';
  return <header className="store-header">
    <div className="store-topnav"><div className="store-container store-topnav-inner">
      <button className="mobile-menu-button" aria-label="Mở menu điều hướng" onClick={() => setMobile(true)}><MenuIcon /></button>
      <nav className="store-desktop-nav" aria-label="Điều hướng chính">
        <NavLink to="/" end>Trang chủ</NavLink>
        <div className="store-mega" ref={menu}>
          <button ref={trigger} type="button" aria-expanded={open} aria-controls={open ? 'gem-mega-menu' : undefined}
            className={pathname === '/shop' || open ? 'active' : ''} onClick={() => setOpen(value => !value)}>
            {currentRoot ? <><span className="visually-hidden">Thế giới đá quý: </span><span className="mega-current">{currentRoot.name}</span></> : 'Thế giới đá quý'}
            <ChevronIcon direction={open ? 'up' : 'down'} size={12} />
          </button>
          {open && <CategoryMegaMenu id="gem-mega-menu" nodes={nodes} loading={loading} error={error} initialRootId={currentRoot?.id}
            selected={category} onNavigate={close} />}
        </div>
        <NavLink to="/kien-thuc">Kiến thức</NavLink><NavLink to="/lien-he">Liên hệ</NavLink><NavLink to="/hen-lich">Hẹn lịch</NavLink>
      </nav>
      <div className="store-support">
        <NavLink to="/ho-tro" className="support-link"><HeadsetIcon /> Hỗ trợ</NavLink>
        <div className="language-control" ref={languageRef} onMouseEnter={() => setLanguage(true)} onMouseLeave={() => setLanguage(false)}>
          <button type="button" aria-describedby={language ? 'language-note' : undefined} onClick={() => setLanguage(true)}
            onFocus={() => setLanguage(true)} onBlur={() => setLanguage(false)}>
            <VietnamFlag /> VI<span className="visually-hidden"> – Tiếng Việt</span> <ChevronIcon size={11} />
          </button>
          {language && <span id="language-note" role="tooltip">Sắp có tiếng Anh</span>}
        </div>
      </div>
    </div></div>
    <div className="store-brand-strip"><div className="store-container store-brand-row">
      <Link className="store-brand" to="/" aria-label="Gem Aurelia · Trang chủ"><img src={logo} alt="Gem Aurelia" /></Link>
      <nav className="store-account-nav" aria-label="Tài khoản và mua sắm">
        {token ? <IconLink to="/account" label="Tài khoản"><UserIcon /></IconLink>
          : <><IconLink to="/login" label="Đăng nhập"><UserIcon /></IconLink><IconLink to="/register" label="Đăng ký"><UserPlusIcon /></IconLink></>}
        <IconLink to="/wishlist" label="Yêu thích"><HeartIcon /></IconLink>
        <NavLink to="/cart" className="header-icon" aria-label={cartLabel} data-tooltip="Giỏ hàng"><BagIcon />
          {token && <span className="cart-count" aria-hidden="true">{cartError ? '!' : cart?.totalQuantity ?? '…'}</span>}</NavLink>
        <IconLink to="/orders" label="Đơn hàng"><OrdersIcon /></IconLink>
        {token && !isAdmin && <IconLink to="/appointments" label="Lịch hẹn"><CalendarIcon /></IconLink>}
        {isAdmin && <IconLink to="/admin/dashboard" label="Quản trị"><AdminIcon /></IconLink>}
        {token && <button type="button" className="header-icon logout-button" aria-label="Đăng xuất" data-tooltip="Đăng xuất" onClick={logout}><LogoutIcon /></button>}
      </nav>
    </div></div>
    {mobile && <dialog ref={drawer} className="store-drawer" aria-label="Menu điều hướng" onCancel={event => { event.preventDefault(); close(); }}>
      <button className="drawer-close" aria-label="Đóng menu" onClick={close}>×</button>
      <nav aria-label="Điều hướng di động">
        <NavLink to="/" end onClick={close}>Trang chủ</NavLink><NavLink to="/kien-thuc" onClick={close}>Kiến thức</NavLink><NavLink to="/lien-he" onClick={close}>Liên hệ</NavLink><NavLink to="/hen-lich" onClick={close}>Hẹn lịch</NavLink><NavLink to="/ho-tro" onClick={close}>Hỗ trợ</NavLink>
        <h2>Thế giới đá quý</h2>
        {loading && <p role="status">Đang tải danh mục…</p>}{error && <p role="alert">{error}</p>}
        <CategoryTree nodes={nodes} selected={category} onNavigate={close} className="drawer-tree" />
        <Link className="tree-all" to="/shop" onClick={close}>Xem tất cả đá quý</Link>
      </nav>
    </dialog>}
  </header>;
}
