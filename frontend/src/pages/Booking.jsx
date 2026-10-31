import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { apiError, getSessionToken, subscribeSession } from "../auth/session";
import { consultationApi } from "../consultation/api";
import { bookingStorage } from "../consultation/bookingStorage";
import { monthEnd, monthStart, viewOf } from "../consultation/calendar";
import MonthCalendar from "../consultation/MonthCalendar";
import TimeSlots from "../consultation/TimeSlots";
import AppointmentStatusBadge from "../consultation/AppointmentStatusBadge";
import { CalendarIcon, CheckIcon, ClockIcon, ServiceIcon } from "../consultation/icons";
import { addDays, BOOKING_WINDOW_DAYS, daysBetween, downloadIcs, formatDate, formatDuration, formatPriceOrFree, isValidPhone, minutesOf,
  storeToday, wallClockParts, WEEKDAYS_SHORT } from "../consultation/time";
import { formatPrice } from "../utils/formatPrice";
import "../styles/consultation.css";

const NEXT = "/hen-lich";
const loginPath = `/login?next=${encodeURIComponent(NEXT)}`;
const registerPath = `/register?next=${encodeURIComponent(NEXT)}`;
const isCanceled = error => error?.name === "CanceledError" || error?.code === "ERR_CANCELED";
const plusMinutes = (time, minutes) => {
  const total = minutesOf(time) + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Booking() {
  const token = useSyncExternalStore(subscribeSession, getSessionToken, () => "");
  // A new session gets a fresh flow (no request IDs or contact data from another account).
  return <BookingFlow key={token} token={token} />;
}

function BookingFlow({ token }) {
  const [today] = useState(() => storeToday());
  const maxDate = addDays(today, BOOKING_WINDOW_DAYS);
  const [draft] = useState(() => bookingStorage.readDraft() || {});
  const [services, setServices] = useState(null);
  const [servicesError, setServicesError] = useState("");
  const [servicesAttempt, setServicesAttempt] = useState(0);
  const [serviceId, setServiceId] = useState(draft.serviceId ?? null);
  const [date, setDate] = useState(draft.date && draft.date >= today && draft.date <= maxDate ? draft.date : null);
  const [start, setStart] = useState(draft.start ?? null);
  const [view, setView] = useState(() => viewOf(date || today));
  // Until the visitor navigates, skip ahead from a month with no free slot left (e.g. the last days of a month).
  const autoAdvance = useRef(!date);
  const [cache, setCache] = useState({});
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState(draft.start ? 3 : draft.serviceId ? 2 : 1);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [form, setForm] = useState({ contactName: "", phone: "", note: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);
  const submitting = useRef(false);
  const stepRefs = useRef({});
  const nameRef = useRef(null);
  const resultRef = useRef(null);
  // Pointer picks advance to the next step; keyboard (arrow keys in a radio group) never does.
  const pointer = useRef(false);
  const formId = useId();

  useEffect(() => {
    let active = true;
    consultationApi.services().then(list => { if (active) { setServices(list); setServicesError(""); } })
      .catch(err => { if (active && !isCanceled(err)) setServicesError(apiError(err, "Không tải được danh sách dịch vụ. Vui lòng thử lại.")); });
    return () => { active = false; };
  }, [servicesAttempt]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    api.get("/users/me").then(({ data }) => {
      if (!active || token !== getSessionToken()) return;
      setProfile(data);
      const saved = bookingStorage.readRequest(data.id);
      if (saved) {
        // An earlier submit has no confirmed outcome: restore it so a retry reuses the same requestId.
        setPending(saved); setServiceId(saved.serviceId); setDate(saved.date); setStart(saved.start); setView(viewOf(saved.date));
        setForm({ contactName: saved.contactName, phone: saved.phone, note: saved.note || "" }); setStep(3);
      } else {
        setForm(previous => ({ ...previous, contactName: previous.contactName || data.fullName || "", phone: previous.phone || data.phone || "" }));
      }
    }).catch(err => { if (active && !isCanceled(err)) setProfileError(apiError(err, "Không tải được thông tin tài khoản. Hãy tải lại trang.")); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!result) bookingStorage.writeDraft({ serviceId, date, start });
  }, [serviceId, date, start, result]);

  const service = services?.find(item => item.id === serviceId) || null;
  const rangeFor = ({ year, month }) => {
    const from = monthStart(year, month) < today ? today : monthStart(year, month);
    const to = monthEnd(year, month) > maxDate ? maxDate : monthEnd(year, month);
    return from > to ? null : { from, days: daysBetween(from, to) + 1 };
  };
  const keyFor = target => { const range = service && rangeFor(target); return range ? `${service.id}|${range.from}|${range.days}` : null; };
  const viewKey = keyFor(view);
  const viewEntry = viewKey ? cache[viewKey] : null;
  const calendarLoading = Boolean(viewKey) && (!viewEntry || viewEntry.reload !== reload);

  useEffect(() => {
    if (!viewKey) return;
    let active = true;
    const [id, from, days] = viewKey.split("|");
    consultationApi.availability(Number(id), from, Number(days)).then(list => {
      if (!active) return;
      setCache(previous => ({ ...previous, [viewKey]: { reload, days: Object.fromEntries(list.map(day => [day.date, day])) } }));
      const free = list.some(day => day.isOpen && day.slots.some(slot => slot.remaining > 0));
      if (!free && autoAdvance.current && from.slice(0, 7) < maxDate.slice(0, 7)) {
        autoAdvance.current = false;
        setView(viewOf(addDays(from.slice(0, 8) + "01", 31).slice(0, 8) + "01"));
      }
    }).catch(err => {
      if (active && !isCanceled(err)) setCache(previous => ({ ...previous, [viewKey]: { reload, days: previous[viewKey]?.days || {},
        error: apiError(err, "Không tải được lịch trống. Vui lòng thử lại.") } }));
    });
    return () => { active = false; };
  }, [viewKey, reload, maxDate]);

  const dateKey = date ? keyFor(viewOf(date)) : null;
  const dateEntry = dateKey ? cache[dateKey] : null;
  const day = dateEntry?.days[date] || null;
  const dayLoading = Boolean(dateKey) && (!dateEntry || (dateKey === viewKey && dateEntry.reload !== reload));
  const slot = day?.isOpen ? day.slots.find(item => item.start === start) : null;
  // A restored or stale time that is no longer free is not a selection (pending retries keep their body).
  const startGone = Boolean(start) && !pending && Boolean(dateEntry) && !dayLoading && !(slot && slot.remaining > 0);
  const selectedStart = startGone ? null : start;
  const endTime = slot?.end || (selectedStart && service ? plusMinutes(selectedStart, service.durationMinutes) : "");
  const ready = Boolean(service && date && selectedStart);
  const locked = Boolean(pending) || saving;

  function goTo(target, { focus = true } = {}) {
    setStep(target);
    if (!focus) return;
    requestAnimationFrame(() => {
      const node = stepRefs.current[target];
      node?.focus({ preventScroll: true });
      node?.scrollIntoView?.({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    });
  }
  function chooseService(id, advance) {
    if (locked) return;
    if (id !== serviceId) { setServiceId(id); setStart(null); setNotice(""); }
    if (advance) goTo(2);
  }
  function chooseDate(iso) { if (locked) return; autoAdvance.current = false; setDate(iso); if (iso !== date) setStart(null); setNotice(""); }
  function chooseStart(value, advance) { if (locked) return; setStart(value); setNotice(""); if (advance) goTo(3); }

  function validate() {
    const errors = {};
    if (!form.contactName.trim()) errors.contactName = "Vui lòng nhập họ tên.";
    if (!form.phone.trim()) errors.phone = "Vui lòng nhập số điện thoại.";
    else if (!isValidPhone(form.phone)) errors.phone = "Số điện thoại không hợp lệ (8–15 chữ số).";
    setFieldErrors(errors);
    return errors;
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !profile || token !== getSessionToken()) return;
    if (!pending) {
      if (!ready) return;
      const errors = validate();
      if (Object.keys(errors).length) {
        setStep(3);
        requestAnimationFrame(() => document.getElementById(`${formId}-${Object.keys(errors)[0]}`)?.focus());
        return;
      }
    }
    const request = pending || { requestId: crypto.randomUUID(), serviceId: service.id, date, start: selectedStart,
      contactName: form.contactName.trim(), phone: form.phone.trim(), note: form.note.trim() || null };
    bookingStorage.writeRequest(profile.id, request);
    submitting.current = true; setPending(request); setSaving(true); setError(""); setNotice("");
    try {
      const data = await consultationApi.book(request);
      if (token !== getSessionToken()) return;
      bookingStorage.clearRequest(profile.id); bookingStorage.clearDraft();
      setPending(null);
      setResult({ serviceName: service?.name, price: service?.price, durationMinutes: service?.durationMinutes, status: "Pending",
        startAt: `${request.date}T${request.start}:00`, endAt: endTime ? `${request.date}T${endTime}:00` : undefined,
        contactName: request.contactName, phone: request.phone, ...data });
      requestAnimationFrame(() => { resultRef.current?.focus({ preventScroll: true }); window.scrollTo?.({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" }); });
    } catch (err) {
      if (token !== getSessionToken() || isCanceled(err)) return;
      const status = err.response?.status, code = err.response?.data?.code;
      if (status === 409 && code === "request_busy") {
        setError(apiError(err, "Yêu cầu trước đang được xử lý. Vui lòng thử lại sau giây lát."));
      } else if (status === 409 && (code === "slot_full" || code === "slot_unavailable")) {
        // The slot was taken (or closed) meanwhile: reload times, keep service and date.
        bookingStorage.clearRequest(profile.id); setPending(null);
        setNotice(apiError(err, "Khung giờ bạn chọn vừa hết chỗ. Vui lòng chọn giờ khác."));
        setView(viewOf(request.date)); setReload(value => value + 1); setStep(2);
      } else if (status >= 400 && status < 500) {
        // Definitive rejection (limit_reached, overlap, request_mismatch, validation…): the next try gets a new requestId.
        bookingStorage.clearRequest(profile.id); setPending(null);
        const field = { invalid_contact_name: "contactName", invalid_phone: "phone" }[code];
        if (field) setFieldErrors(previous => ({ ...previous, [field]: apiError(err, "Thông tin chưa hợp lệ.") }));
        if (code === "service_unavailable" || code === "service_not_found") { setServicesAttempt(value => value + 1); setStep(1); }
        setError(apiError(err, "Không đặt được lịch hẹn. Vui lòng kiểm tra lại thông tin."));
      } else {
        setError("Chưa xác nhận được kết quả đặt lịch. Nhấn “Thử lại cùng yêu cầu” — hệ thống sẽ không tạo lịch trùng — hoặc kiểm tra mục Lịch hẹn của tôi.");
      }
    } finally { submitting.current = false; setSaving(false); }
  }

  function discardPending() {
    if (!profile || saving) return;
    bookingStorage.clearRequest(profile.id); setPending(null); setError("");
  }

  if (result) return <BookingSuccess appointment={result} headingRef={resultRef} />;

  const stepDone = { 1: Boolean(service), 2: Boolean(service && date && selectedStart), 3: false };
  const stepEnabled = { 1: true, 2: Boolean(service), 3: Boolean(service && date && selectedStart) };
  // A restored step whose prerequisites vanished (e.g. the saved time was taken) falls back to the last usable one.
  const openStep = stepEnabled[step] ? step : stepEnabled[2] ? 2 : 1;
  const dateLabel = date ? formatDate(date) : "";
  const shortDate = date ? `${WEEKDAYS_SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()]} ${date.slice(8, 10)}/${date.slice(5, 7)}` : "";

  // Plain render helper (not a component) so header buttons keep focus across re-renders.
  const stepHeader = (number, title, summary) => {
    const enabled = stepEnabled[number], open = openStep === number, done = stepDone[number];
    return <h2 className="booking-step__heading">
      <button type="button" ref={node => { stepRefs.current[number] = node; }} aria-expanded={open} aria-controls={`${formId}-step-${number}`}
        disabled={!enabled} onClick={() => setStep(number)}>
        <span className={`booking-step__number${done ? " is-done" : ""}`} aria-hidden="true">{done && !open ? <CheckIcon /> : number}</span>
        <span className="booking-step__title"><span className="visually-hidden">Bước {number}: </span>{title}</span>
        {!open && summary && <span className="booking-step__summary">{summary}<span className="booking-step__change"> · Thay đổi</span></span>}
      </button>
    </h2>;
  };

  const primary = (() => {
    if (!service) return { hint: "Chọn dịch vụ để bắt đầu.", button: <button type="button" className="booking-primary" disabled>Xác nhận đặt lịch</button> };
    if (!ready) return { hint: "Chọn ngày và giờ phù hợp.", button: <button type="button" className="booking-primary" disabled>Xác nhận đặt lịch</button> };
    if (!token) return { hint: "Đăng nhập để hoàn tất. Lựa chọn của bạn được giữ lại.", button: <Link className="booking-primary" to={loginPath}>Đăng nhập để xác nhận</Link> };
    if (openStep !== 3) return { button: <button type="button" className="booking-primary" onClick={() => { setStep(3); requestAnimationFrame(() => nameRef.current?.focus()); }}>Tiếp tục</button> };
    return { button: <button type="submit" form={formId} className="booking-primary" disabled={saving || !profile}>
      {saving ? "Đang gửi yêu cầu…" : pending ? "Thử lại cùng yêu cầu" : "Xác nhận đặt lịch"}</button> };
  })();

  return <div className="store-container booking-page">
    <nav className="catalog-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Đặt lịch tư vấn</span></nav>
    <header className="booking-intro">
      <h1>Đặt lịch tư vấn</h1>
      <p>Gặp chuyên viên Gem Aurelia tại showroom: chọn dịch vụ, thời gian phù hợp và để lại thông tin liên hệ. Lịch hẹn sẽ được xác nhận sớm nhất có thể.</p>
    </header>
    <div className="booking-layout">
      <div className="booking-steps">
        <section className={`booking-step${openStep === 1 ? " is-open" : ""}`} aria-label="Bước 1: Chọn dịch vụ">
          {stepHeader(1, "Chọn dịch vụ", service && `${service.name} · ${formatPriceOrFree(service.price, formatPrice)}`)}
          {openStep === 1 && <div className="booking-step__body" id={`${formId}-step-1`}>
            {servicesError ? <p className="notice notice-error" role="alert">{servicesError} <button type="button" className="link-button" onClick={() => { setServicesError(""); setServicesAttempt(value => value + 1); }}>Thử lại</button></p>
              : !services ? <div className="service-grid" aria-busy="true"><p role="status" className="visually-hidden">Đang tải dịch vụ…</p>{[1, 2, 3].map(key => <div key={key} className="service-card service-card--skeleton" aria-hidden="true" />)}</div>
              : services.length === 0 ? <p className="booking-empty">Hiện chưa có dịch vụ tư vấn nào mở đặt lịch. Vui lòng quay lại sau.</p>
              : <fieldset className="service-grid" disabled={locked}><legend className="visually-hidden">Dịch vụ tư vấn</legend>
                {services.map(item => <label key={item.id} className={`service-card${item.id === serviceId ? " is-selected" : ""}`} onPointerDown={() => { pointer.current = true; }}>
                  <input type="radio" className="visually-hidden" name={`${formId}-service`} value={item.id} checked={item.id === serviceId}
                    onChange={() => chooseService(item.id, false)} onClick={() => { const viaPointer = pointer.current; pointer.current = false; if (viaPointer) chooseService(item.id, true); }} />
                  <span className="service-card__icon" aria-hidden="true"><ServiceIcon name={item.name} /></span>
                  <span className="service-card__check" aria-hidden="true"><CheckIcon /></span>
                  <span className="service-card__name">{item.name}</span>
                  {item.description && <span className="service-card__description">{item.description}</span>}
                  <span className="service-card__meta"><span><ClockIcon /> {formatDuration(item.durationMinutes)}</span>
                    <strong className={item.price > 0 ? "" : "is-free"}>{formatPriceOrFree(item.price, formatPrice)}</strong></span>
                </label>)}
              </fieldset>}
            {service && <div className="booking-step__actions"><button type="button" className="booking-secondary" onClick={() => goTo(2)}>Tiếp tục chọn ngày & giờ</button></div>}
          </div>}
        </section>

        <section className={`booking-step${openStep === 2 ? " is-open" : ""}`} aria-label="Bước 2: Chọn ngày và giờ">
          {stepHeader(2, "Chọn ngày & giờ", date && selectedStart && `${dateLabel} · ${selectedStart}`)}
          {openStep === 2 && <div className="booking-step__body" id={`${formId}-step-2`}>
            {notice && <p className="notice notice-error" role="alert">{notice}</p>}
            {viewEntry?.error && <p className="notice notice-error" role="alert">{viewEntry.error} <button type="button" className="link-button" onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
            <div className="booking-datetime">
              <MonthCalendar view={view} onViewChange={next => { autoAdvance.current = false; setView(next); }} minDate={today} maxDate={maxDate} today={today}
                days={viewEntry?.days || {}} loading={calendarLoading} selected={date} onSelect={chooseDate} disabled={locked} />
              <div className="booking-times">
                {startGone && !notice && <p className="notice" role="status">Khung giờ {start} không còn trống. Vui lòng chọn giờ khác.</p>}
                <TimeSlots date={date} day={day} loading={dayLoading} selected={selectedStart} disabled={locked}
                  error={dateEntry?.error && !day ? dateEntry.error : ""} onRetry={() => setReload(value => value + 1)}
                  onSelect={chooseStart} pointer={pointer} />
                <p className="time-slots__footnote">Giờ theo múi giờ Việt Nam (GMT+7). Mỗi lịch hẹn kéo dài {formatDuration(service.durationMinutes)}.</p>
              </div>
            </div>
            {ready && <div className="booking-step__actions"><button type="button" className="booking-secondary" onClick={() => goTo(3)}>Tiếp tục nhập thông tin</button></div>}
          </div>}
        </section>

        <section className={`booking-step${openStep === 3 ? " is-open" : ""}`} aria-label="Bước 3: Thông tin liên hệ">
          {stepHeader(3, "Thông tin liên hệ")}
          {openStep === 3 && <div className="booking-step__body" id={`${formId}-step-3`}>
            {!token ? <div className="booking-login-gate">
              <h3>Đăng nhập để hoàn tất đặt lịch</h3>
              <p>Bạn cần tài khoản Gem Aurelia để chúng tôi xác nhận và nhắc lịch. Dịch vụ và thời gian đã chọn sẽ được giữ nguyên sau khi đăng nhập.</p>
              <div className="booking-login-gate__actions"><Link className="booking-primary" to={loginPath}>Đăng nhập</Link><Link className="booking-secondary" to={registerPath}>Tạo tài khoản</Link></div>
            </div> : <form id={formId} className="booking-contact" noValidate onSubmit={submit}>
              {profileError && <p className="notice notice-error" role="alert">{profileError}</p>}
              <fieldset disabled={locked || !profile}>
                <legend className="visually-hidden">Thông tin liên hệ</legend>
                <div className="booking-field-row">
                  <div className="booking-field"><label htmlFor={`${formId}-contactName`}>Họ và tên</label>
                    <input ref={nameRef} id={`${formId}-contactName`} required maxLength={100} autoComplete="name"
                      value={form.contactName} aria-invalid={Boolean(fieldErrors.contactName)} aria-describedby={fieldErrors.contactName ? `${formId}-contactName-error` : undefined}
                      onChange={e => { setForm({ ...form, contactName: e.target.value }); setFieldErrors({ ...fieldErrors, contactName: "" }); }} />
                    {fieldErrors.contactName && <small className="field-error" id={`${formId}-contactName-error`}>{fieldErrors.contactName}</small>}</div>
                  <div className="booking-field"><label htmlFor={`${formId}-phone`}>Số điện thoại</label>
                    <input id={`${formId}-phone`} type="tel" required maxLength={20} autoComplete="tel" inputMode="tel"
                      value={form.phone} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? `${formId}-phone-error` : undefined}
                      onChange={e => { setForm({ ...form, phone: e.target.value }); setFieldErrors({ ...fieldErrors, phone: "" }); }} />
                    {fieldErrors.phone && <small className="field-error" id={`${formId}-phone-error`}>{fieldErrors.phone}</small>}</div>
                </div>
                <div className="booking-field"><label htmlFor={`${formId}-note`}>Ghi chú <span className="booking-optional">(không bắt buộc)</span></label>
                  <textarea id={`${formId}-note`} maxLength={500} rows={3} value={form.note} placeholder="Ví dụ: loại đá hoặc mẫu trang sức bạn quan tâm"
                    onChange={e => setForm({ ...form, note: e.target.value })} /></div>
                <p className="booking-hint">Thông tin chỉ dùng cho lịch hẹn này và không thay đổi hồ sơ tài khoản của bạn.</p>
              </fieldset>
              {pending && <div className="notice booking-pending">
                <p>Yêu cầu đặt lịch đang chờ xác nhận kết quả. Thử lại sẽ dùng cùng mã yêu cầu nên không tạo lịch trùng.</p>
                <p><Link to="/appointments">Kiểm tra Lịch hẹn của tôi</Link> · <button type="button" className="link-button" disabled={saving} onClick={discardPending}>Bỏ yêu cầu này và chọn lại</button></p>
              </div>}
            </form>}
          </div>}
        </section>
      </div>

      <aside className="booking-summary" aria-labelledby={`${formId}-summary`}>
        <h2 id={`${formId}-summary`}><CalendarIcon /> Lịch hẹn của bạn</h2>
        <dl className="booking-summary__list">
          <div><dt>Dịch vụ</dt><dd>{service?.name || <span className="is-empty">Chưa chọn</span>}</dd></div>
          <div><dt>Chi phí</dt><dd>{service ? formatPriceOrFree(service.price, formatPrice) : <span className="is-empty">—</span>}</dd></div>
          <div><dt>Ngày</dt><dd>{dateLabel || <span className="is-empty">Chưa chọn</span>}</dd></div>
          <div><dt>Giờ</dt><dd>{selectedStart ? `${selectedStart}${endTime ? ` – ${endTime}` : ""}` : <span className="is-empty">Chưa chọn</span>}</dd></div>
          <div><dt>Thời lượng</dt><dd>{service ? formatDuration(service.durationMinutes) : <span className="is-empty">—</span>}</dd></div>
        </dl>
        <p className="booking-summary__compact"><strong>{service?.name || "Chưa chọn dịch vụ"}</strong>
          <span>{selectedStart ? `${shortDate} · ${selectedStart}` : date ? `${shortDate} · chưa chọn giờ` : "Chưa chọn thời gian"}</span></p>
        {error && <p className="notice notice-error booking-summary__error" role="alert">{error}</p>}
        {primary.button}
        {primary.hint && <p className="booking-summary__hint" role="status">{primary.hint}</p>}
        <p className="booking-summary__note">Lịch hẹn ở trạng thái “Chờ xác nhận” cho đến khi tư vấn viên xác nhận. Bạn có thể hủy trước giờ hẹn ít nhất 2 giờ.</p>
      </aside>
    </div>
  </div>;
}

function BookingSuccess({ appointment, headingRef }) {
  const start = wallClockParts(appointment.startAt), end = wallClockParts(appointment.endAt);
  return <div className="store-container booking-page">
    <section className="booking-success" aria-labelledby="booking-success-title">
      <span className="booking-success__icon" aria-hidden="true"><CheckIcon size={28} /></span>
      <h1 id="booking-success-title" ref={headingRef} tabIndex={-1}>Đã gửi yêu cầu đặt lịch</h1>
      <p>Cảm ơn bạn đã chọn Gem Aurelia. Tư vấn viên sẽ xác nhận lịch hẹn và bạn có thể theo dõi trạng thái trong mục Lịch hẹn của tôi.</p>
      {appointment.replayed && <p className="notice" role="status">Yêu cầu này đã được ghi nhận từ lần gửi trước, không có lịch hẹn trùng.</p>}
      <dl className="booking-success__details">
        <div><dt>Mã lịch hẹn</dt><dd>#{appointment.id}</dd></div>
        <div><dt>Trạng thái</dt><dd><AppointmentStatusBadge status={appointment.status || "Pending"} /></dd></div>
        <div><dt>Dịch vụ</dt><dd>{appointment.serviceName}</dd></div>
        {start && <div><dt>Thời gian</dt><dd>{formatDate(start.date)} · {start.time}{end ? ` – ${end.time}` : ""}</dd></div>}
        {appointment.price != null && <div><dt>Chi phí</dt><dd>{formatPriceOrFree(appointment.price, formatPrice)}</dd></div>}
      </dl>
      <div className="booking-success__actions">
        <button type="button" className="booking-secondary" onClick={() => downloadIcs(appointment)}><CalendarIcon /> Thêm vào lịch</button>
        <Link className="booking-primary" to="/appointments">Xem lịch hẹn của tôi</Link>
      </div>
    </section>
  </div>;
}
