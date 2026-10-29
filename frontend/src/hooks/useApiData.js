import { useEffect, useState } from "react";
import api from "../api/api";
import { apiError } from "../auth/session";

// Pass a null path to skip the request (returns an idle, non-loading result).
export default function useApiData(path) {
  const [result, setResult] = useState({ path: undefined, data: null, error: "", loading: true });
  useEffect(() => {
    if (!path) return;
    let active = true;
    api.get(path).then(({ data }) => {
      if (active) setResult({ path, data, error: "", loading: false });
    }).catch((error) => {
      if (active) setResult({ path, data: null, loading: false,
        error: error.response?.status === 404 ? "Không tìm thấy dữ liệu." : apiError(error, "Không thể tải dữ liệu. Vui lòng tải lại trang để thử lại.") });
    });
    return () => { active = false; };
  }, [path]);
  if (!path) return { data: null, error: "", loading: false };
  return result.path === path ? result : { data: null, error: "", loading: true };
}
