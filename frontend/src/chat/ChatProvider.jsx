import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import api, { API_ORIGIN } from "../api/api";
import { getSessionToken, subscribeSession } from "../auth/session";
import { ChatContext } from "./context";
import { PAGE_SIZE, normalizePage } from "./chatModel";
import useChatThread from "./useChatThread";
import { usePageVisible } from "./hooks";

const TYPING_THROTTLE_MS = 2500;

function pagePath(base, before) {
  return `${base}?take=${PAGE_SIZE}${before != null ? `&before=${encodeURIComponent(before)}` : ""}`;
}

// Session-scoped like CommerceProvider: logout/account change remounts everything and stops the hub.
export default function ChatProvider({ children }) {
  const token = useSyncExternalStore(subscribeSession, getSessionToken, () => "");
  return <ChatSession key={token} token={token}>{children}</ChatSession>;
}

function ChatSession({ token, children }) {
  const role = token ? localStorage.getItem("role") || "" : "";
  const isAdmin = role === "Admin";
  const isCustomer = Boolean(token) && !isAdmin;
  const [connectionState, setConnectionState] = useState(token ? "connecting" : "offline");
  const [unread, setUnread] = useState(0);
  const [viewers, setViewers] = useState(0);
  const [wanted, setWanted] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [productContext, setProductContext] = useState(null);
  const pageVisible = usePageVisible();
  const watching = isCustomer && viewers > 0 && pageVisible;
  const listeners = useRef(new Set());
  const connectionRef = useRef(null);
  const connected = useRef(false);
  const unreadSequence = useRef(0);
  const typingSent = useRef(new Map());
  const live = useRef({});

  const thread = useChatThread({
    enabled: isCustomer && wanted,
    mySide: "Customer",
    autoRead: watching,
    loadPage: async before => {
      const { data } = await api.get(pagePath("/chat/me", before));
      const page = normalizePage(data);
      return { ...page, otherLastReadId: page.conversation?.staffLastReadId ?? 0, myLastReadId: page.conversation?.customerLastReadId ?? 0 };
    },
    postMessage: async payload => (await api.post("/chat/me/messages", payload)).data,
    markRead: async lastMessageId => {
      await api.post("/chat/me/read", { lastMessageId });
      if (token === getSessionToken()) setUnread(0);
    },
  });

  const refreshUnread = useCallback(() => {
    if (!token) return Promise.resolve();
    const number = ++unreadSequence.current;
    return api.get("/chat/unread").then(({ data }) => {
      if (number === unreadSequence.current && token === getSessionToken())
        setUnread(Math.max(0, Number(typeof data === "number" ? data : data?.count) || 0));
    }).catch(() => {});
  }, [token]);

  // Handlers read the latest render's values without re-subscribing the hub.
  useLayoutEffect(() => { live.current = { thread, watching, isCustomer, isAdmin, refreshUnread }; });

  const emit = useCallback(event => { for (const listener of [...listeners.current]) listener(event); }, []);

  useEffect(() => {
    if (!token) return;
    let active = true, retryTimer;
    const current = () => active && token === getSessionToken();
    const connection = new HubConnectionBuilder().withUrl(`${API_ORIGIN}/hubs/chat`, {
      accessTokenFactory: () => token === getSessionToken() ? token : "",
    }).withAutomaticReconnect([0, 2000, 5000, 10000]).configureLogging(LogLevel.None).build();
    connectionRef.current = connection;

    connection.on("ChatMessage", payload => {
      if (!current()) return;
      const { thread: customerThread, watching: onScreen, isCustomer: customer, refreshUnread: refresh } = live.current;
      const message = payload?.message ?? payload;
      const conversationId = payload?.conversationId ?? message?.conversationId;
      if (customer) {
        customerThread.receive({ ...message, conversationId: message?.conversationId ?? conversationId });
        if (String(message?.senderRole).toLowerCase() === "staff" && !onScreen) setUnread(count => count + 1);
      } else void refresh();
      emit({ type: "message", conversationId, message });
    });
    connection.on("ChatRead", payload => {
      if (!current()) return;
      const { thread: customerThread, isCustomer: customer, refreshUnread: refresh } = live.current;
      const side = String(payload?.side ?? "").toLowerCase();
      if (customer && side === "staff") customerThread.setOtherRead(payload?.lastReadId);
      if (!customer || side === "customer") void refresh();
      emit({ type: "read", conversationId: payload?.conversationId, side: payload?.side, lastReadId: payload?.lastReadId });
    });
    connection.on("ChatConversation", payload => {
      if (!current()) return;
      if (live.current.isCustomer) live.current.thread.setConversation({ id: payload?.conversationId, status: payload?.status });
      emit({ type: "conversation", conversationId: payload?.conversationId, status: payload?.status });
    });
    // Also pushed on /hubs/orders; re-emitted so booking views may reuse this connection (refetch trigger only).
    connection.on("AppointmentChanged", payload => { if (current()) emit({ type: "appointment", appointmentId: payload?.appointmentId }); });
    connection.on("Typing", payload => {
      if (!current()) return;
      const conversationId = typeof payload === "object" && payload ? payload.conversationId : payload;
      const side = typeof payload === "object" && payload ? String(payload.side ?? "").toLowerCase() : "";
      const { thread: customerThread, isCustomer: customer } = live.current;
      if (customer && side !== "customer") customerThread.showTyping();
      emit({ type: "typing", conversationId, side: payload?.side });
    });

    const synced = () => {
      if (!current()) return;
      connected.current = true;
      setConnectionState("connected");
      void live.current.refreshUnread();
      // Recover anything missed while disconnected.
      if (live.current.isCustomer && live.current.thread.loaded) void live.current.thread.reload();
      emit({ type: "connected" });
    };
    connection.onreconnecting(() => { connected.current = false; if (current()) setConnectionState("reconnecting"); });
    connection.onreconnected(synced);
    const start = async () => {
      try {
        await connection.start();
        if (!current()) { await connection.stop(); return; }
        synced();
      } catch {
        if (!current()) return;
        setConnectionState("disconnected");
        // Badge still works over HTTP while the hub is unreachable; this also re-checks the session (401 → logout).
        void live.current.refreshUnread();
        retryTimer = setTimeout(start, 5000);
      }
    };
    connection.onclose(() => {
      connected.current = false;
      if (current()) { setConnectionState("disconnected"); retryTimer = setTimeout(start, 5000); }
    });
    void start();
    return () => {
      active = false; connected.current = false; connectionRef.current = null;
      clearTimeout(retryTimer);
      void connection.stop();
    };
  }, [token, emit]);

  const subscribe = useCallback(listener => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const sendTyping = useCallback(conversationId => {
    const connection = connectionRef.current;
    if (!connection || !connected.current || conversationId == null) return;
    const now = Date.now();
    if (now - (typingSent.current.get(conversationId) ?? 0) < TYPING_THROTTLE_MS) return;
    typingSent.current.set(conversationId, now);
    Promise.resolve().then(() => connection.invoke("Typing", Number(conversationId))).catch(() => {});
  }, []);

  const registerViewer = useCallback(() => {
    setWanted(true);
    setViewers(count => count + 1);
    return () => setViewers(count => Math.max(0, count - 1));
  }, []);

  const openChat = useCallback(() => setWidgetOpen(true), []);

  const value = useMemo(() => ({
    token, role, isAdmin, isCustomer, connectionState, unread, refreshUnread, subscribe, sendTyping,
    thread: isCustomer ? thread : null, registerViewer, widgetOpen, setWidgetOpen, openChat, productContext, setProductContext,
  }), [token, role, isAdmin, isCustomer, connectionState, unread, refreshUnread, subscribe, sendTyping, thread,
    registerViewer, widgetOpen, openChat, productContext]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
