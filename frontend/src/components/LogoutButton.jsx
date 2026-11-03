import { logout } from "../auth/session";

export default function LogoutButton() {
  return <button className="logout-button" type="button" onClick={logout}>Đăng xuất</button>;
}
