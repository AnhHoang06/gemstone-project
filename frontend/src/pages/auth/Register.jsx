import useInlineValidation from "../../hooks/useInlineValidation";
import FieldError from "../../components/FieldError";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/api";
import { apiError } from "../../auth/session";
import AuthLayout from "../../components/AuthLayout";
import { safeNextPath, withNext } from "./nextPath";

export default function Register() {
  const validation = useInlineValidation();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const loginPath = withNext("/login", next);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!validation.validate(event.currentTarget)) return;
    setSaving(true);
    try {
      await api.post("/auth/register", {
        fullName: form.fullName.trim(), email: form.email.trim(), password: form.password,
        phone: form.phone || null, address: form.address || null,
      });
      setForm({ fullName: "", email: "", password: "", confirmPassword: "", phone: "", address: "" });
      setSuccess(true);
    } catch (err) {
      setError(apiError(err, "Không thể đăng ký. Vui lòng thử lại."));
    } finally { setSaving(false); }
  }

  return <AuthLayout title="Tạo tài khoản" description="Thông tin của bạn, được lưu giữ tại một nơi. Mật khẩu cần ít nhất 8 ký tự.">
    {success ? <p className="notice notice-success" role="status">Đăng ký thành công. <Link to={loginPath}>Đăng nhập</Link>{next ? " để tiếp tục." : ""}</p> :
      <form noValidate onChange={validation.onChange} onSubmit={submit}>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <fieldset disabled={saving}>
          {[
            ["fullName", "Họ tên", "text", 100, true],
            ["email", "Email", "email", 255, true],
            ["password", "Mật khẩu", "password", undefined, true],
            ["confirmPassword", "Xác nhận mật khẩu", "password", undefined, true],
            ["phone", "Số điện thoại (không bắt buộc)", "tel", 20, false],
            ["address", "Địa chỉ (không bắt buộc)", "text", 500, false],
          ].map(([name, label, type, maxLength, required]) => <div key={name}>
            <label>{label}<input {...validation.fieldProps(name)} data-required-message={name === "fullName" ? "Vui lòng nhập họ tên." : name === "email" ? "Vui lòng nhập email." : name === "confirmPassword" ? "Vui lòng xác nhận mật khẩu." : "Vui lòng nhập mật khẩu."} name={name} type={type} required={required} maxLength={maxLength}
              minLength={type === "password" ? 8 : undefined}
              autoComplete={type === "password" ? "new-password" : undefined}
              value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></label><FieldError name={name} errors={validation.errors} />
          </div>)}
          <button type="submit">{saving ? "Đang đăng ký..." : "Đăng ký"}</button>
        </fieldset>
      </form>}
    {!success && <p className="auth-switch">Đã có tài khoản? <Link to={loginPath}>Đăng nhập</Link></p>}
  </AuthLayout>;
}
