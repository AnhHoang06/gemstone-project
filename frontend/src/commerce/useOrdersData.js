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
    api.get(path).then(({ data }) => { if (active) setResult({ key, path, data }); })
      .catch(error => { if (active) setResult(previous => ({ key, path,
        data: previous?.path === path ? previous.data : null,
        error: apiError(error, "Không tải được đơn hàng. Vui lòng thử lại.") })); });
    return () => { active = false; };
  }, [path, key]);
  const data = result?.path === path ? result.data : null;
  return { data, error: result?.key === key ? result.error : "",
    loading: result?.key !== key && !data, refreshing: result?.key !== key && Boolean(data),
    refresh: () => setAttempt(value => value + 1) };
}
