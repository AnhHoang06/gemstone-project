import useInlineValidation from "../hooks/useInlineValidation";
import FieldError from "../components/FieldError";
import { useState } from "react";
import api from "../api/api";
import AuthLayout from "../components/AuthLayout";
import { Link } from "react-router-dom";
import { apiError } from "../auth/session";

function ChangePassword() {
  const validation = useInlineValidation();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setMessage('');
    if (!validation.validate(e.currentTarget)) return;
    setSaving(true);
    try {
      await api.put("/users/me/password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      validation.reset();
      setMessage("Đổi mật khẩu thành công.");

      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setError(apiError(err, "Đổi mật khẩu thất bại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout title="Đổi mật khẩu" description="Nhập mật khẩu hiện tại và chọn mật khẩu mới có ít nhất 8 ký tự.">

      {message && <p className="notice notice-success" role="status">{message}</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <form noValidate onChange={validation.onChange} onSubmit={handleSubmit}><fieldset disabled={saving}>
        <div>
          <label htmlFor="currentPassword">Mật khẩu hiện tại</label>
          <input
            type="password"
            id="currentPassword" name="currentPassword" data-required-message="Vui lòng nhập mật khẩu hiện tại." {...validation.fieldProps("currentPassword")} required autoComplete="current-password"
            value={form.currentPassword}
            onChange={handleChange}
          />
          <FieldError name="currentPassword" errors={validation.errors} />
        </div>

        <div>
          <label htmlFor="newPassword">Mật khẩu mới</label>
          <input
            type="password"
            id="newPassword" name="newPassword" data-required-message="Vui lòng nhập mật khẩu mới." {...validation.fieldProps("newPassword")} required minLength={8} autoComplete="new-password"
            value={form.newPassword}
            onChange={handleChange}
          />
          <FieldError name="newPassword" errors={validation.errors} />
        </div>

        <div>
          <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
          <input
            type="password"
            id="confirmPassword" name="confirmPassword" data-required-message="Vui lòng xác nhận mật khẩu." {...validation.fieldProps("confirmPassword")} required minLength={8} autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
          />
          <FieldError name="confirmPassword" errors={validation.errors} />
        </div>

        <button type="submit">{saving ? "Đang cập nhật..." : "Lưu mật khẩu mới"}</button>
      </fieldset></form>
      <p className="auth-switch"><Link to="/account">← Về tài khoản</Link></p>
    </AuthLayout>
  );
}

export default ChangePassword;
