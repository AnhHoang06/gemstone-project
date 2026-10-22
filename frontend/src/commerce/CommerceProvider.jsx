import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import api, { API_ORIGIN } from "../api/api";
import { apiError, getSessionToken, logout, subscribeSession } from "../auth/session";
import { CommerceContext } from "./context";

export default function CommerceProvider({ children }) {
  const token = useSyncExternalStore(subscribeSession, getSessionToken, () => "");
  // Remount user-scoped views/state immediately on logout or account change.
  return <CommerceSession key={token} token={token}>{children}</CommerceSession>;
}

function CommerceSession({ token, children }) {
  const [cart, setCart] = useState(null);
  const [cartError, setCartError] = useState("");
  const [cartLoading, setCartLoading] = useState(Boolean(token));
  const [cartBusy, setCartBusy] = useState(false);
  const [connectionState, setConnectionState] = useState(token ? "Đang kết nối" : "Chưa đăng nhập");
  const [revision, setRevision] = useState(0);
  const requestNumber = useRef(0);
  const mutating = useRef(false);

  const refreshCart = useCallback(() => {
    if (!token) return;
    const number = ++requestNumber.current;
    return api.get("/cart").then(({ data }) => {
      if (number === requestNumber.current && token === getSessionToken()) {
        setCart(data); setCartError("");
      }
    }).catch(error => {
      if (number === requestNumber.current && token === getSessionToken())
        setCartError(apiError(error, "Không tải được giỏ hàng. Vui lòng thử lại."));
    }).finally(() => {
      if (number === requestNumber.current && token === getSessionToken()) setCartLoading(false);
    });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const sequence = requestNumber;
    let retryTimer;
    const connection = new HubConnectionBuilder().withUrl(`${API_ORIGIN}/hubs/orders`, {
      accessTokenFactory: () => token === getSessionToken() ? token : "",
    }).withAutomaticReconnect([0, 2000, 5000, 10000]).configureLogging(LogLevel.None).build();
    const sync = () => {
      if (active && token === getSessionToken()) { setRevision(value => value + 1); void refreshCart(); }
    };
    connection.on("NewOrder", sync);
    connection.on("OrderStatusChanged", sync);
    connection.onreconnecting(() => { if (active) setConnectionState("Đang kết nối lại"); });
    connection.onreconnected(() => { if (active) { setConnectionState("Đã kết nối"); sync(); } });
    const start = async () => {
      try {
        await connection.start();
        if (!active || token !== getSessionToken()) { await connection.stop(); return; }
        setConnectionState("Đã kết nối"); sync();
      } catch {
        if (!active || token !== getSessionToken()) return;
        setConnectionState("Mất kết nối — đang thử lại");
        // Recheck account/expiry via the existing 401 interceptor.
        void api.get("/users/me").catch(() => {});
        retryTimer = setTimeout(start, 5000);
      }
    };
    connection.onclose(() => {
      if (active && token === getSessionToken()) {
        setConnectionState("Mất kết nối — đang thử lại");
        retryTimer = setTimeout(start, 5000);
      }
    });
    void refreshCart();
    void start();
    const expiryCheck = setInterval(() => {
      // HTTP validation also catches locked accounts even while the hub is idle.
      if (active && token === getSessionToken()) void api.get("/users/me").catch(() => {});
    }, 60000);
    return () => {
      active = false; ++sequence.current;
      clearTimeout(retryTimer); clearInterval(expiryCheck);
      void connection.stop();
    };
  }, [token, refreshCart]);

  async function mutateCart(method, path, body) {
    if (!token) { logout(); return false; }
    if (mutating.current) return false;
    mutating.current = true;
    setCartBusy(true); setCartError("");
    const number = ++requestNumber.current;
    try {
      const { data } = await api.request({ method, url: path, data: body });
      if (token !== getSessionToken()) return false;
      // The mutation supplied authoritative data, even if an older GET is still pending.
      setCartLoading(false);
      if (number === requestNumber.current) setCart(data);
      else void refreshCart();
      return true;
    } catch (error) {
      if (token === getSessionToken()) setCartError(apiError(error, "Không cập nhật được giỏ hàng. Kiểm tra giỏ trước khi thử lại."));
      return false;
    } finally { mutating.current = false; setCartBusy(false); }
  }

  return <CommerceContext.Provider value={{ token, cart, cartError, cartLoading, cartBusy, refreshCart,
    mutateCart, revision, connectionState }}>{children}</CommerceContext.Provider>;
}
