import { useEffect, useRef, useState } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { API_ORIGIN } from "../api/api";
import { getSessionToken } from "../auth/session";
import { APPOINTMENT_EVENT, APPOINTMENT_HUB_PATH } from "./api";

// Live appointment updates (server sends only { appointmentId }; callers re-fetch).
// Same lifecycle rules as CommerceProvider: session token per connection, reconnect, stop on session change.
export default function useAppointmentEvents(token, onChange) {
  const [state, setState] = useState(token ? "Đang kết nối" : "Chưa đăng nhập");
  const handler = useRef(onChange);
  useEffect(() => { handler.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!token) return;
    let active = true, retryTimer;
    const valid = () => active && token === getSessionToken();
    const connection = new HubConnectionBuilder().withUrl(`${API_ORIGIN}${APPOINTMENT_HUB_PATH}`, {
      accessTokenFactory: () => token === getSessionToken() ? token : "",
    }).withAutomaticReconnect([0, 2000, 5000, 10000]).configureLogging(LogLevel.None).build();
    connection.on(APPOINTMENT_EVENT, payload => { if (valid()) handler.current?.(payload?.appointmentId ?? payload); });
    connection.onreconnecting(() => { if (valid()) setState("Đang kết nối lại"); });
    connection.onreconnected(() => { if (valid()) { setState("Đã kết nối"); handler.current?.(null); } });
    const start = async () => {
      try {
        await connection.start();
        if (!valid()) { await connection.stop(); return; }
        setState("Đã kết nối");
      } catch {
        if (!valid()) return;
        setState("Mất kết nối — đang thử lại");
        retryTimer = setTimeout(start, 5000);
      }
    };
    connection.onclose(() => { if (valid()) { setState("Mất kết nối — đang thử lại"); retryTimer = setTimeout(start, 5000); } });
    void start();
    return () => { active = false; clearTimeout(retryTimer); void connection.stop(); };
  }, [token]);
  return state;
}
