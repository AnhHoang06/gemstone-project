import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { resolveImageUrl } from "../api/api";
import { formatPrice } from "../utils/formatPrice";
import { groupMessages, initials, timeLabel } from "./chatModel";
import { ArrowDownIcon, BrandMark, RetryIcon } from "./ChatIcons";
import ProductPlaceholder from "../components/ProductPlaceholder";

const NEAR_BOTTOM_PX = 96;

export function ProductCard({ product, external = false }) {
  if (!product?.id) return null;
  const image = resolveImageUrl(product.imageUrl);
  const name = product.name || `Sản phẩm #${product.id}`;
  const available = product.isAvailable !== false;
  const content = <>
    <span className="chat-product-media">{image ? <img src={image} alt="" loading="lazy" /> : <ProductPlaceholder label={false} />}</span>
    <span className="chat-product-text"><span className="chat-product-name">{name}</span>
      {available && product.price != null && <span className="chat-product-price">{formatPrice(product.price)}</span>}
      <span className="chat-product-cta">{available ? "Xem sản phẩm" : "Sản phẩm không còn kinh doanh"}</span></span>
  </>;
  // isAvailable:false = no longer sold: keep the name for context, but no link.
  if (!available) return <div className="chat-product chat-product--unavailable">{content}</div>;
  return external
    ? <a className="chat-product" href={`/product/${product.id}`} target="_blank" rel="noreferrer" aria-label={`${name} (mở tab mới)`}>{content}</a>
    : <Link className="chat-product" to={`/product/${product.id}`}>{content}</Link>;
}

export function Avatar({ role, name }) {
  return role === "Staff"
    ? <span className="chat-avatar chat-avatar--staff" aria-hidden="true"><BrandMark size={18} /></span>
    : <span className="chat-avatar chat-avatar--customer" aria-hidden="true">{initials(name)}</span>;
}

/** Message list shared by the customer panel and the admin inbox. Bodies are always rendered as text. */
export default function MessageThread({ thread, mySide, otherName, otherAvatarName, label, intro, empty, onRetry, onDiscard, externalProducts = false }) {
  const { messages, loaded, hasMore, loadingOlder, otherLastReadId, typing, loadOlder } = thread;
  const scroller = useRef(null);
  const previous = useRef({ first: null, last: null, height: 0, top: 0 });
  const [newBelow, setNewBelow] = useState(false);
  const days = groupMessages(messages);
  const otherSide = mySide === "Staff" ? "Customer" : "Staff";
  const lastMine = [...messages].reverse().find(message => message.senderRole === mySide && message.id != null);
  const seenId = lastMine && otherLastReadId >= lastMine.id ? lastMine.id : null;

  // Keep the viewport stable: stick to the bottom for new messages, keep position when older ones are prepended.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const first = messages[0]?.clientMessageId ?? messages[0]?.id ?? null;
    const lastMessage = messages.at(-1);
    const last = lastMessage ? `${lastMessage.id ?? ""}:${lastMessage.clientMessageId ?? ""}` : null;
    const before = previous.current;
    const wasNearBottom = before.height - before.top - element.clientHeight < NEAR_BOTTOM_PX;
    if (before.first !== null && first !== before.first && last === before.last) {
      element.scrollTop = element.scrollHeight - before.height + before.top;
    } else if (last !== before.last || typing) {
      if (before.last === null || wasNearBottom || lastMessage?.senderRole === mySide) {
        element.scrollTop = element.scrollHeight;
        setNewBelow(false);
      } else setNewBelow(true);
    }
    previous.current = { first, last, height: element.scrollHeight, top: element.scrollTop };
  }, [messages, typing, mySide, loaded]);

  function onScroll() {
    const element = scroller.current;
    previous.current = { ...previous.current, height: element.scrollHeight, top: element.scrollTop };
    if (element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX) setNewBelow(false);
    if (element.scrollTop < 48 && hasMore && !loadingOlder) void loadOlder();
  }
  function jumpToBottom() {
    const element = scroller.current;
    element.scrollTop = element.scrollHeight;
    setNewBelow(false);
  }

  return <div className="chat-thread">
    <div className="chat-scroller" ref={scroller} onScroll={onScroll}>
      <div className="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label={label} aria-busy={!loaded || loadingOlder}>
        {hasMore && <div className="chat-older"><button type="button" onClick={() => void loadOlder()} disabled={loadingOlder}>
          {loadingOlder ? "Đang tải tin cũ…" : "Xem tin nhắn cũ hơn"}</button></div>}
        {!hasMore && intro}
        {loaded && messages.length === 0 && empty}
        {days.map(day => <section className="chat-day" key={day.key} aria-label={day.label}>
          <p className="chat-day-label"><span>{day.label}</span></p>
          {day.groups.map(group => {
            const mine = group.senderRole === mySide;
            return <div key={group.key} className={`chat-group ${mine ? "chat-group--mine" : "chat-group--other"}`}>
              {!mine && <Avatar role={group.senderRole} name={otherAvatarName} />}
              <div className="chat-group-body">
                {!mine && <p className="chat-sender">{otherName}</p>}
                {group.messages.map((message, index) => {
                  const lastInGroup = index === group.messages.length - 1;
                  return <div key={message.clientMessageId ?? message.id} className={`chat-msg chat-msg--${message.status}`}>
                    {message.product && <ProductCard product={message.product} external={externalProducts} />}
                    <p className="chat-bubble"><span className="visually-hidden">{mine ? "Bạn" : otherName}{message.date ? `, ${timeLabel(message.date)}` : ""}: </span>{message.body}</p>
                    {message.status === "sending" && <p className="chat-meta" aria-hidden="true">Đang gửi…</p>}
                    {message.status === "failed" && <p className="chat-meta chat-meta--error" role="alert">
                      <span>{message.error || "Không gửi được tin nhắn."}</span>
                      <button type="button" onClick={() => onRetry(message.clientMessageId)}><RetryIcon /> Thử lại</button>
                      {onDiscard && <button type="button" onClick={() => onDiscard(message.clientMessageId)}>Xóa</button>}
                    </p>}
                    {message.status === "sent" && (lastInGroup || message.id === seenId) && <p className="chat-meta" aria-hidden={message.id !== seenId}>
                      {lastInGroup && <time dateTime={message.date?.toISOString()}>{timeLabel(message.date)}</time>}
                      {message.id === seenId && <span className="chat-seen">Đã xem</span>}
                    </p>}
                  </div>;
                })}
              </div>
            </div>;
          })}
        </section>)}
        {typing && <div className="chat-group chat-group--other chat-typing">
          <Avatar role={otherSide} name={otherAvatarName} />
          <div className="chat-group-body"><p className="chat-bubble"><span className="chat-dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="visually-hidden">{otherName} đang soạn tin…</span></p></div>
        </div>}
      </div>
    </div>
    {newBelow && <button type="button" className="chat-new-below" onClick={jumpToBottom}><ArrowDownIcon /> Tin nhắn mới</button>}
  </div>;
}
