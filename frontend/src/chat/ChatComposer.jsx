import { useLayoutEffect, useRef, useState } from "react";
import { MAX_BODY } from "./chatModel";
import { CloseIcon, GemIcon, SendIcon } from "./ChatIcons";

const COUNTER_FROM = 1800;
const MAX_LINES = 4;

/**
 * Auto-growing textarea (max 4 lines). Enter sends, Shift+Enter adds a line; IME composition
 * (Vietnamese Telex/VNI) is never interrupted.
 */
export default function ChatComposer({ id, inputRef, onSend, onTyping, disabled = false, placeholder = "Nhập tin nhắn…",
  attachment = null, onRemoveAttachment, defaultBodyWithAttachment = "", label = "Tin nhắn", children }) {
  const [text, setText] = useState("");
  const localRef = useRef(null);
  const textarea = inputRef ?? localRef;
  const canSend = !disabled && (text.trim().length > 0 || (attachment && defaultBodyWithAttachment));

  useLayoutEffect(() => {
    const element = textarea.current;
    if (!element || typeof window.getComputedStyle !== "function") return;
    const style = window.getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    element.style.height = "auto";
    const max = lineHeight * MAX_LINES + padding;
    const height = Math.min(element.scrollHeight || 0, max);
    if (height > 0) element.style.height = `${height}px`;
    element.style.overflowY = element.scrollHeight > max ? "auto" : "hidden";
  }, [text, textarea]);

  function submit() {
    if (!canSend) return;
    const body = text.trim() || defaultBodyWithAttachment;
    if (onSend(body) !== false) setText("");
    textarea.current?.focus();
  }

  return <form className="chat-composer" onSubmit={event => { event.preventDefault(); submit(); }}>
    {children}
    {attachment && <div className="chat-attachment">
      <span className="chat-attachment-icon"><GemIcon size={16} /></span>
      <span className="chat-attachment-text"><span className="chat-attachment-label">Đính kèm sản phẩm</span>
        <span className="chat-attachment-name">{attachment.name || `Sản phẩm #${attachment.id}`}</span></span>
      {onRemoveAttachment && <button type="button" className="chat-icon-button" aria-label="Bỏ đính kèm sản phẩm" onClick={onRemoveAttachment}><CloseIcon size={16} /></button>}
    </div>}
    <div className="chat-input-row">
      <label className="visually-hidden" htmlFor={id}>{label}</label>
      <textarea id={id} ref={textarea} rows={1} value={text} maxLength={MAX_BODY} placeholder={placeholder} disabled={disabled}
        aria-describedby={text.length >= COUNTER_FROM ? `${id}-count` : undefined} enterKeyHint="send"
        onChange={event => { setText(event.target.value); if (event.target.value.trim()) onTyping?.(); }}
        onKeyDown={event => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault(); submit();
        }} />
      <button type="submit" className="chat-send" aria-label="Gửi tin nhắn" disabled={!canSend}><SendIcon /></button>
    </div>
    {text.length >= COUNTER_FROM && <p id={`${id}-count`} className={`chat-counter${text.length >= MAX_BODY ? " chat-counter--max" : ""}`} aria-live="polite">
      {text.length.toLocaleString("vi-VN")}/{MAX_BODY.toLocaleString("vi-VN")} ký tự</p>}
  </form>;
}
