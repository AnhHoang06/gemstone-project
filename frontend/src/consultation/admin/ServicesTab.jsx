import { useEffect, useRef, useState } from "react";
import { apiError } from "../../auth/session";
import { formatPrice } from "../../utils/formatPrice";
import { consultationApi } from "../api";
import { formatDuration, formatPriceOrFree } from "../time";

const EMPTY = { name: "", description: "", price: "0", durationMinutes: "60", isActive: true };

function validate(form, services, editingId) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Vui lòng nhập tên dịch vụ.";
  else if (name.length > 150) errors.name = "Tên dịch vụ tối đa 150 ký tự.";
  else if (services.some(item => item.id !== editingId && item.name.trim().toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) errors.name = "Tên dịch vụ đã tồn tại.";
  if (form.description.length > 500) errors.description = "Mô tả tối đa 500 ký tự.";
  const price = Number(form.price);
  if (form.price === "" || !Number.isFinite(price) || price < 0 || !Number.isInteger(price)) errors.price = "Giá là số nguyên không âm (0 = Miễn phí).";
  const duration = Number(form.durationMinutes);
  if (!Number.isInteger(duration) || duration < 15 || duration > 240) errors.durationMinutes = "Thời lượng từ 15 đến 240 phút.";
  return errors;
}

export default function ServicesTab() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ attempt: -1, data: null, error: "" });
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const lock = useRef(false);
  const formRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    let active = true;
    consultationApi.adminServices().then(data => { if (active) setState({ attempt, data, error: "" }); })
      .catch(err => { if (active) setState(previous => ({ attempt, data: previous.data, error: apiError(err, "Không tải được danh sách dịch vụ.") })); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!deleting || !dialog) return;
    const previous = document.activeElement;
    dialog.showModal?.();
    return () => { dialog.close?.(); if (previous?.isConnected) previous.focus(); };
  }, [deleting]);

  const services = state.data || [];

  async function run(action, success) {
    if (lock.current) return false;
    lock.current = true; setSaving(true); setError(""); setMessage("");
    try { const data = await action(); setMessage(typeof success === "function" ? success(data) : success); setAttempt(value => value + 1); return true; }
    catch (err) { setError(apiError(err, "Không lưu được thay đổi.")); setAttempt(value => value + 1); return false; }
    finally { lock.current = false; setSaving(false); }
  }

  function startEdit(item) {
    setEditingId(item.id); setErrors({}); setMessage("");
    setForm({ name: item.name, description: item.description || "", price: String(item.price), durationMinutes: String(item.durationMinutes), isActive: item.isActive });
    requestAnimationFrame(() => formRef.current?.querySelector("input")?.focus());
  }
  function resetForm() { setEditingId(null); setForm(EMPTY); setErrors({}); }

  async function submit(event) {
    event.preventDefault();
    const found = validate(form, services, editingId);
    setErrors(found);
    if (Object.keys(found).length) { formRef.current?.querySelector(`[name="${Object.keys(found)[0]}"]`)?.focus(); return; }
    const current = services.find(item => item.id === editingId);
    const body = { name: form.name.trim(), description: form.description.trim() || null, price: Number(form.price), durationMinutes: Number(form.durationMinutes),
      isActive: form.isActive, sortOrder: current ? current.sortOrder : Math.max(0, ...services.map(item => item.sortOrder)) + 1 };
    const ok = await run(() => editingId ? consultationApi.updateService(editingId, body) : consultationApi.createService(body),
      editingId ? `Đã cập nhật dịch vụ “${body.name}”.` : `Đã thêm dịch vụ “${body.name}”.`);
    if (ok) resetForm();
  }

  const bodyOf = (item, patch) => ({ name: item.name, description: item.description || null, price: item.price, durationMinutes: item.durationMinutes,
    isActive: item.isActive, sortOrder: item.sortOrder, ...patch });

  function move(index, delta) {
    const order = [...services];
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    const changed = order.map((item, position) => ({ item, sortOrder: position + 1 })).filter(({ item, sortOrder }) => item.sortOrder !== sortOrder);
    void run(async () => { for (const { item, sortOrder } of changed) await consultationApi.updateService(item.id, bodyOf(item, { sortOrder })); },
      `Đã đổi thứ tự “${services[index].name}”.`);
  }

  async function confirmDelete() {
    const item = deleting;
    const ok = await run(() => consultationApi.deleteService(item.id),
      data => data?.deleted === false ? `Dịch vụ “${item.name}” đã có lịch hẹn nên được ẩn thay vì xóa.` : `Đã xóa dịch vụ “${item.name}”.`);
    if (ok) { setDeleting(null); if (editingId === item.id) resetForm(); }
  }

  const field = (name, label, props = {}) => <div className="form-row">
    <label htmlFor={`service-${name}`}>{label}</label>
    {props.as === "textarea" ? <textarea id={`service-${name}`} name={name} rows={2} maxLength={500} value={form[name]} aria-invalid={Boolean(errors[name])}
      aria-describedby={errors[name] ? `service-${name}-error` : undefined} onChange={event => setForm({ ...form, [name]: event.target.value })} />
      : <input id={`service-${name}`} name={name} value={form[name]} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `service-${name}-error` : props.hint ? `service-${name}-hint` : undefined}
        onChange={event => setForm({ ...form, [name]: event.target.value })} {...props.input} />}
    {props.hint && !errors[name] && <small id={`service-${name}-hint`} className="consult-admin-hint">{props.hint}</small>}
    {errors[name] && <small className="field-error" id={`service-${name}-error`}>{errors[name]}</small>}
  </div>;

  return <div className="consult-admin-services">
    <form ref={formRef} className="admin-form consult-service-form" noValidate onSubmit={submit} aria-labelledby="service-form-title">
      <h2 id="service-form-title">{editingId ? "Sửa dịch vụ" : "Thêm dịch vụ"}</h2>
      <fieldset disabled={saving}>
        {field("name", "Tên dịch vụ", { input: { maxLength: 150, required: true } })}
        {field("description", "Mô tả ngắn", { as: "textarea" })}
        <div className="consult-form-pair">
          {field("price", "Giá (VNĐ)", { input: { type: "number", min: 0, step: 1000, inputMode: "numeric" }, hint: "Nhập 0 để hiển thị “Miễn phí”." })}
          {field("durationMinutes", "Thời lượng (phút)", { input: { type: "number", min: 15, max: 240, step: 5, inputMode: "numeric" } })}
        </div>
        <div className="form-row form-row-checkbox"><label><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} /> Hiển thị cho khách đặt lịch</label></div>
        <div className="consult-admin-actions">
          <button type="submit" className="btn btn-primary">{saving ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Thêm dịch vụ"}</button>
          {editingId && <button type="button" className="btn btn-outline" onClick={resetForm}>Hủy sửa</button>}
        </div>
      </fieldset>
    </form>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {message && <p className="notice notice-success" role="status">{message}</p>}
    {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
    <h2>Danh sách dịch vụ</h2>
    {!state.data && state.attempt !== attempt ? <p role="status">Đang tải…</p> : services.length === 0 ? <p className="empty-state">Chưa có dịch vụ nào.</p> :
      <div className="table-scroll"><table className="shop-table consult-services-table"><thead><tr>
        <th scope="col">Thứ tự</th><th scope="col">Dịch vụ</th><th scope="col">Thời lượng</th><th scope="col">Giá</th><th scope="col">Hiển thị</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{services.map((item, index) => <tr key={item.id} className={item.isActive ? "" : "is-hidden-service"}>
          <td><div className="consult-order">
            <button type="button" className="btn btn-outline" aria-label={`Đưa “${item.name}” lên`} disabled={saving || index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" className="btn btn-outline" aria-label={`Đưa “${item.name}” xuống`} disabled={saving || index === services.length - 1} onClick={() => move(index, 1)}>↓</button></div></td>
          <td><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</td>
          <td>{formatDuration(item.durationMinutes)}</td>
          <td className="order-money">{formatPriceOrFree(item.price, formatPrice)}</td>
          <td><span className={`badge ${item.isActive ? "badge-active" : "badge-inactive"}`}>{item.isActive ? "Đang hiện" : "Đã ẩn"}</span></td>
          <td><div className="admin-appt-actions">
            <button type="button" className="btn btn-outline" disabled={saving} onClick={() => startEdit(item)} aria-label={`Sửa “${item.name}”`}>Sửa</button>
            <button type="button" className="btn btn-outline" disabled={saving} aria-label={`${item.isActive ? "Ẩn" : "Hiện"} “${item.name}”`}
              onClick={() => run(() => consultationApi.updateService(item.id, bodyOf(item, { isActive: !item.isActive })), `${item.isActive ? "Đã ẩn" : "Đã hiện"} “${item.name}”.`)}>{item.isActive ? "Ẩn" : "Hiện"}</button>
            <button type="button" className="btn btn-danger" disabled={saving} onClick={() => { setError(""); setDeleting(item); }} aria-label={`Xóa “${item.name}”`}>Xóa</button>
          </div></td>
        </tr>)}</tbody></table></div>}
    {deleting && <dialog ref={dialogRef} className="admin-delete-dialog" aria-labelledby="delete-service-title" aria-describedby="delete-service-description"
      onCancel={event => { event.preventDefault(); if (!saving) setDeleting(null); }}>
      <p className="eyebrow">Gem Aurelia · Cấu hình tư vấn</p>
      <h2 id="delete-service-title">Xóa dịch vụ?</h2>
      <p><strong>{deleting.name}</strong></p>
      <p id="delete-service-description">Nếu dịch vụ đã có lịch hẹn, hệ thống sẽ ẩn dịch vụ thay vì xóa để giữ lịch sử.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-delete-actions">
        <button type="button" className="btn btn-outline" autoFocus disabled={saving} onClick={() => setDeleting(null)}>Giữ lại</button>
        <button type="button" className="btn btn-danger" disabled={saving} onClick={confirmDelete}>{saving ? "Đang xóa…" : "Xóa dịch vụ"}</button>
      </div>
    </dialog>}
  </div>;
}
