import { useEffect, useState } from "react";
import api from "../api/api";
import { apiError } from "../auth/session";
import { useCommerce } from "./context";

export default function useOrdersData(path) {
  const { revision } = useCommerce();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const key = `${path}:${revision}:${attempt}`;
  useEffect(() => {
    let active = true;
    api.get(path).then(({ data }) => { if (active) setResult({ key, data }); })
      .catch(error => { if (active) setResult({ key, error: apiError(error, "Không tải được đơn hàng. Vui lòng thử lại.") }); });
    return () => { active = false; };
  }, [path, key]);
  return { data: result?.key === key ? result.data : null, error: result?.key === key ? result.error : "",
    loading: result?.key !== key, refresh: () => setAttempt(value => value + 1) };
}
