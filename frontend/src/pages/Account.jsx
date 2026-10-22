import useInlineValidation from "../hooks/useInlineValidation";
import FieldError from "../components/FieldError";
import { useEffect, useState } from "react";
import api from "../api/api";
import LogoutButton from "../components/LogoutButton";
import { apiError } from "../auth/session";

function Account() {
  const validation = useInlineValidation();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    role: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAccount = async () => {
      try {
        const response = await api.get("/users/me");

        if (!active) return;
        setLoaded(true);
        setForm({
          fullName: response.data.fullName || "",
          email: response.data.email || "",
          phone: response.data.phone || "",
          address: response.data.address || "",
          role: response.data.role || "",
        });
      } catch (err) {
        if (!active) return;
        setError(apiError(err, "Không thể tải thông tin tài khoản. Hãy tải lại trang để thử lại."));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAccount();
    return () => { active = false; };
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loaded || saving) return;
    setError('');
    setMessage('');
    if (!validation.validate(e.currentTarget)) return;
    setSaving(true);

    setMessage("");
    setError("");

    try {
      await api.put("/users/me", {
        fullName: form.fullName.trim(),
        phone: form.phone,
        address: form.address,
      });

      localStorage.setItem("fullName", form.fullName.trim());

      setMessage("Cập nhật thông tin thành công.");
    } catch (err) {
      console.error(err);
      setError(apiError(err, "Cập nhật thông tin thất bại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="page-title">
        <div className="container">
          <h1>Tài khoản</h1>
          <p>Thông tin tài khoản và hồ sơ cá nhân.</p>
        </div>
      </section>

      <section className="account-section">
        <div className="container account-grid">

          <div className="account-panel">
            <h2>Thông tin cá nhân</h2>

            {message && <p className="notice notice-success" role="status">{message}</p>}
            {error && <p className="notice notice-error" role="alert">{error}</p>}

            <form noValidate onChange={validation.onChange} className="profile-form" onSubmit={handleSubmit} aria-busy={loading || saving}>
              {loading && <p className="notice" role="status">Đang tải thông tin tài khoản...</p>}
              <fieldset disabled={!loaded || loading || saving}>
              <div>
                <label htmlFor="profile-fullName">Họ tên</label>
                <input
                  type="text"
                  id="profile-fullName" data-required-message="Vui lòng nhập họ tên." name="fullName" {...validation.fieldProps("fullName")} required maxLength={100}
                  value={form.fullName}
                  onChange={handleChange}
                />
                <FieldError name="fullName" errors={validation.errors} />
              </div>

              <div>
                <label htmlFor="profile-email">Email <span className="readonly-label">Chỉ đọc</span></label>
                <input
                  type="email"
                  id="profile-email" value={form.email}
                  disabled
                />
              </div>

              <div>
                <label htmlFor="profile-phone">Số điện thoại</label>
                <input
                  type="text"
                  id="profile-phone" name="phone" {...validation.fieldProps("phone")} maxLength={20}
                  value={form.phone}
                  onChange={handleChange}
                />
                <FieldError name="phone" errors={validation.errors} />
              </div>

              <div>
                <label htmlFor="profile-address">Địa chỉ</label>
                <input
                  type="text"
                  id="profile-address" name="address" {...validation.fieldProps("address")} maxLength={500}
                  value={form.address}
                  onChange={handleChange}
                />
                <FieldError name="address" errors={validation.errors} />
              </div>

              <div>
                <label htmlFor="profile-role">Vai trò <span className="readonly-label">Chỉ đọc</span></label>
                <input
                  type="text"
                  id="profile-role" value={form.role}
                  disabled
                />
              </div>

              <button type="submit">
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </fieldset></form>
          </div>

          <div className="account-panel">
            <h2>Bảo mật</h2>
            <p>Bạn có thể đổi mật khẩu tài khoản tại đây.</p>

            <div className="account-actions"><a className="secondary-action" href="/change-password">
              Đổi mật khẩu
            </a><LogoutButton /></div>
          </div>

        </div>
      </section>
    </>
  );
}

export default Account;
