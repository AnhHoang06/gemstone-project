import useInlineValidation from "../../hooks/useInlineValidation";
import FieldError from "../../components/FieldError";
import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import api from "../../api/api";
import { apiError, saveSession } from "../../auth/session";
import AuthLayout from "../../components/AuthLayout";
import { safeNextPath, withNext } from "./nextPath";

function Login() {
  const validation = useInlineValidation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (!validation.validate(e.currentTarget)) return;
    setSaving(true);
    setError("");

    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      saveSession(response.data);

      if (next) {
        navigate(next, { replace: true });
      } else if (response.data.role === "Admin") {
        navigate("/admin/products");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(apiError(err, "Không thể đăng nhập. Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout title="Chào mừng trở lại" description="Đăng nhập để quản lý tài khoản và tiếp tục khám phá bộ sưu tập đá quý.">

      {next && <p className="notice" role="status">{next.startsWith("/hen-lich") ? "Đăng nhập để hoàn tất đặt lịch tư vấn. Dịch vụ và thời gian bạn chọn vẫn được giữ nguyên." : "Đăng nhập để tiếp tục, bạn sẽ được đưa về trang đang xem."}</p>}
      <form noValidate onChange={validation.onChange} onSubmit={handleSubmit}>
        <div>
          <label htmlFor="login-email">Email</label>
          <input
            name="email" data-required-message="Vui lòng nhập email." {...validation.fieldProps("email")} id="login-email" type="email" required maxLength={255} autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError name="email" errors={validation.errors} />
        </div>

        <div>
          <label htmlFor="login-password">Mật khẩu</label>
          <input
            name="password" data-required-message="Vui lòng nhập mật khẩu." {...validation.fieldProps("password")} id="login-password" type="password" required autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FieldError name="password" errors={validation.errors} />
        </div>

        {error && <p className="notice notice-error" role="alert">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form><p className="auth-switch">Chưa có tài khoản? <Link to={withNext("/register", next)}>Đăng ký</Link></p>
    </AuthLayout>
  );
}

export default Login;
