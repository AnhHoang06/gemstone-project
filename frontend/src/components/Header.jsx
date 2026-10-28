import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo-mark.svg';
import LogoutButton from './LogoutButton';
import CategoryTree from './CategoryTree';
import useApiData from '../hooks/useApiData';
import { useCommerce } from '../commerce/context';

export default function Header() {
  const { token, cart, cartError } = useCommerce();
  const { data, loading, error } = useApiData('/categories/tree');
  const [open, setOpen] = useState(false), [mobile, setMobile] = useState(false), [language, setLanguage] = useState(false);
  const menu = useRef(null), trigger = useRef(null), drawer = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const outside = event => { if (!menu.current?.contains(event.target)) setOpen(false); };
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
  const categoryContent = <>{loading && <p role="status">Đang tải danh mục…</p>}{error && <p role="alert">{error}</p>}<CategoryTree nodes={data || []} onNavigate={close} /><Link to="/shop" onClick={close}>Xem tất cả đá quý</Link></>;
  const links = <><NavLink to="/" end onClick={close}>Trang chủ</NavLink><NavLink to="/kien-thuc" onClick={close}>Kiến thức</NavLink><NavLink to="/lien-he" onClick={close}>Liên hệ</NavLink><NavLink to="/hen-lich" onClick={close}>Hẹn lịch</NavLink></>;
  return <header className="store-header">
    <div className="store-topnav"><div className="store-container store-topnav-inner">
      <button className="mobile-menu-button" aria-label="Mở menu điều hướng" onClick={() => setMobile(true)}>☰</button>
      <nav className="store-desktop-nav" aria-label="Điều hướng chính"><NavLink to="/" end>Trang chủ</NavLink>
        <div className="store-mega" ref={menu}><button ref={trigger} aria-expanded={open} aria-controls="gem-mega-menu" className={pathname === '/shop' ? 'active' : ''} onClick={() => setOpen(value => !value)}>Thế giới đá quý <span aria-hidden="true">⌄</span></button>
          {open && <div id="gem-mega-menu" className="store-mega-panel">{categoryContent}</div>}</div>
        <NavLink to="/kien-thuc">Kiến thức</NavLink><NavLink to="/lien-he">Liên hệ</NavLink><NavLink to="/hen-lich">Hẹn lịch</NavLink>
      </nav><div className="store-support"><Link to="/ho-tro"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v7h4v-7zm16 0h2v7h-4v-7zm0 7c0 3-4 3-6 3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg> Hỗ trợ</Link><div className="language-control"><button aria-describedby={language ? 'language-note' : undefined} onClick={() => setLanguage(v => !v)}>VI</button>{language && <span id="language-note" role="tooltip">Sắp có tiếng Anh</span>}</div></div>
    </div></div>
    <div className="store-container store-brand-row"><Link className="store-brand" to="/" aria-label="Gem Aurelia · Trang chủ"><img src={logo} alt="Gem Aurelia" /></Link>
      <nav className="store-account-nav" aria-label="Tài khoản và mua sắm">
        <NavLink to="/wishlist">♡ <span>Yêu thích</span></NavLink><NavLink to="/cart">Giỏ hàng {token && <span className="cart-count" aria-label="Số sản phẩm trong giỏ">{cartError ? '!' : cart?.totalQuantity ?? '…'}</span>}</NavLink>
        <NavLink to="/orders">Đơn hàng</NavLink>{token ? <><NavLink to="/account">Tài khoản</NavLink><LogoutButton /></> : <><NavLink to="/login">Đăng nhập</NavLink><NavLink to="/register">Đăng ký</NavLink></>}
        {token && localStorage.getItem('role') === 'Admin' && <NavLink to="/admin/dashboard">Quản trị</NavLink>}
      </nav>
    </div>
    {mobile && <dialog ref={drawer} className="store-drawer" aria-label="Menu điều hướng" onCancel={event => { event.preventDefault(); close(); }}><button className="drawer-close" aria-label="Đóng menu" onClick={close}>×</button><nav>{links}<h2>Thế giới đá quý</h2>{categoryContent}</nav></dialog>}
  </header>;
}
