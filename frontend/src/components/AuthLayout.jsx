import Header from "./Header";

export default function AuthLayout({ title, description, children }) {
  return <div className="site-shell">
    <Header />
    <main className="auth-page">
      <section className="auth-panel" aria-label={title}>
        <p className="eyebrow">Gem Aurelia · Tài khoản</p>
        <h1>{title}</h1>
        <p className="form-intro">{description}</p>
        {children}
      </section>
    </main>
  </div>;
}
