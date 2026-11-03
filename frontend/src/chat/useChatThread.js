import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiError } from "../auth/session";
import { MAX_BODY, firstId, lastIdFrom, mergeMessages, newClientMessageId, normalizeMessage } from "./chatModel";

const TYPING_VISIBLE_MS = 4000;
const EMPTY = { messages: [], loaded: false, error: "", hasMore: false, loadingOlder: false, conversation: null, otherLastReadId: 0 };

/**
 * One conversation thread with optimistic sending.
 * loadPage(before) -> { messages, hasMore, conversation, otherLastReadId, myLastReadId }
 * postMessage({ clientMessageId, body, productId }) -> raw server message
 * markRead(lastMessageId) -> Promise
 * The owner must remount (key) the hook when the session or conversation changes.
 */
export default function useChatThread({ enabled, mySide, autoRead, loadPage, postMessage, markRead }) {
  const [state, setState] = useState(EMPTY);
  const [typing, setTyping] = useState(false);
  const options = useRef({ loadPage, postMessage, markRead });
  const alive = useRef(true);
  const loadSequence = useRef(0);
  const localOrder = useRef(0);
  const readSent = useRef(0);
  const typingTimer = useRef(null);
  const stateRef = useRef(state);
  const otherSide = mySide === "Staff" ? "Customer" : "Staff";

  useLayoutEffect(() => { options.current = { loadPage, postMessage, markRead }; stateRef.current = state; });
  useEffect(() => {
    alive.current = true;
    const sequence = loadSequence;
    return () => { alive.current = false; ++sequence.current; clearTimeout(typingTimer.current); };
  }, []);

  // Latest page (initial load and after reconnect). Pending/failed local messages are kept.
  const reload = useCallback(async () => {
    const number = ++loadSequence.current;
    try {
      const page = await options.current.loadPage(null);
      if (!alive.current || number !== loadSequence.current) return;
      if (page.myLastReadId > readSent.current) readSent.current = page.myLastReadId;
      setState(current => ({ ...current, loaded: true, error: "",
        messages: mergeMessages(current.messages, page.messages),
        hasMore: current.loaded ? current.hasMore : page.hasMore,
        conversation: page.conversation ?? current.conversation,
        otherLastReadId: Math.max(current.otherLastReadId, page.otherLastReadId || 0) }));
    } catch (error) {
      if (alive.current && number === loadSequence.current && error?.name !== "CanceledError")
        setState(current => ({ ...current, error: apiError(error, "Không tải được tin nhắn. Vui lòng thử lại.") }));
    }
  }, []);

  useEffect(() => {
    if (enabled && !stateRef.current.loaded) void reload();
  }, [enabled, reload]);

  const loadOlder = useCallback(async () => {
    const current = stateRef.current;
    const before = firstId(current.messages);
    if (!current.loaded || !current.hasMore || current.loadingOlder || before == null) return;
    setState(value => ({ ...value, loadingOlder: true }));
    try {
      const page = await options.current.loadPage(before);
      if (!alive.current) return;
      setState(value => ({ ...value, loadingOlder: false, hasMore: page.hasMore, messages: mergeMessages(value.messages, page.messages) }));
    } catch (error) {
      if (alive.current) setState(value => ({ ...value, loadingOlder: false,
        error: apiError(error, "Không tải được tin nhắn cũ hơn.") }));
    }
  }, []);

  const deliver = useCallback(async message => {
    try {
      const { clientMessageId, body, productId } = message;
      const saved = normalizeMessage(await options.current.postMessage({ clientMessageId, body, ...(productId != null ? { productId } : {}) }));
      if (!alive.current) return true;
      setState(value => ({ ...value, conversation: value.conversation ?? (saved?.conversationId ? { id: saved.conversationId } : null),
        messages: mergeMessages(value.messages, [{ ...saved, clientMessageId: saved?.clientMessageId ?? clientMessageId }]) }));
      return true;
    } catch (error) {
      if (!alive.current) return false;
      const text = error?.response?.status === 429 ? apiError(error, "Bạn gửi quá nhanh. Vui lòng đợi một chút rồi thử lại.")
        : apiError(error, "Không gửi được tin nhắn.");
      setState(value => ({ ...value, messages: value.messages.map(item =>
        item.clientMessageId === message.clientMessageId && item.id == null ? { ...item, status: "failed", error: text } : item) }));
      return false;
    }
  }, []);

  const send = useCallback((text, { productId = null, product = null } = {}) => {
    const body = String(text ?? "").trim().slice(0, MAX_BODY);
    if (!body) return null;
    const message = { id: null, conversationId: stateRef.current.conversation?.id ?? null, senderRole: mySide, body,
      productId, product, clientMessageId: newClientMessageId(), createdAt: new Date().toISOString(),
      status: "sending", error: "", localOrder: ++localOrder.current };
    setState(value => ({ ...value, messages: [...value.messages, message] }));
    void deliver(message);
    return message.clientMessageId;
  }, [deliver, mySide]);

  // Retry keeps the original clientMessageId so the server can de-duplicate an ambiguous first attempt.
  const retry = useCallback(clientMessageId => {
    const message = stateRef.current.messages.find(item => item.clientMessageId === clientMessageId && item.status === "failed");
    if (!message) return;
    setState(value => ({ ...value, messages: value.messages.map(item =>
      item.clientMessageId === clientMessageId && item.id == null ? { ...item, status: "sending", error: "" } : item) }));
    void deliver(message);
  }, [deliver]);

  const discard = useCallback(clientMessageId => {
    setState(value => ({ ...value, messages: value.messages.filter(item => !(item.clientMessageId === clientMessageId && item.id == null)) }));
  }, []);

  const receive = useCallback(raw => {
    const message = normalizeMessage(raw);
    if (!message) return;
    if (message.senderRole === otherSide) { clearTimeout(typingTimer.current); setTyping(false); }
    setState(value => ({ ...value, conversation: value.conversation ?? (message.conversationId ? { id: message.conversationId } : null),
      // Before the first page arrives the page itself will contain the message.
      messages: value.loaded ? mergeMessages(value.messages, [message]) : value.messages }));
  }, [otherSide]);

  const setOtherRead = useCallback(lastReadId => {
    const id = Number(lastReadId) || 0;
    setState(value => id > value.otherLastReadId ? { ...value, otherLastReadId: id } : value);
  }, []);

  const showTyping = useCallback(() => {
    clearTimeout(typingTimer.current);
    setTyping(true);
    typingTimer.current = setTimeout(() => { if (alive.current) setTyping(false); }, TYPING_VISIBLE_MS);
  }, []);

  const setConversation = useCallback(patch => {
    setState(value => ({ ...value, conversation: { ...(value.conversation ?? {}), ...patch } }));
  }, []);

  // Read receipts: only while the thread is actually on screen.
  useEffect(() => {
    if (!autoRead || !state.loaded) return;
    const last = lastIdFrom(state.messages, otherSide);
    if (last <= readSent.current) return;
    const previous = readSent.current;
    readSent.current = last;
    Promise.resolve(options.current.markRead(last)).catch(() => { if (readSent.current === last) readSent.current = previous; });
  }, [autoRead, state.loaded, state.messages, otherSide]);

  return { ...state, typing, reload, loadOlder, send, retry, discard, receive, setOtherRead, showTyping, setConversation };
}
