function Account() {
  // TODO: Replace this mock profile with authenticated account data when available.
  return (
    <>
      <section className="page-title">
        <div className="container">
          <h1>Tài khoản</h1>
          <p>Hồ sơ khách hàng, chứng nhận đã lưu, lịch hẹn và yêu cầu tư vấn đá quý.</p>
        </div>
      </section>
      <section className="account-section">
        <div className="container account-grid">
          <div className="account-panel">
            <h2>Khách hàng riêng</h2>
            <p>Minh Tran</p>
            <span>Hạng sưu tầm: Maison</span>
          </div>
          <div className="account-panel">
            <h2>Yêu cầu gần đây</h2>
            <p>Royal Ceylon Sapphire / rà soát chứng nhận</p>
            <p>Muzo Garden Emerald / tư vấn thiết kế</p>
          </div>
          <div className="account-panel">
            <h2>Lịch hẹn</h2>
            <p>Yêu cầu xem đá tại showroom Saigon</p>
            <span>Dữ liệu tài khoản hiện là mock data.</span>
          </div>
        </div>
      </section>
    </>
  );
}

export default Account;
