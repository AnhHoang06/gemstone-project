import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { apiError } from '../auth/session';
import { useCommerce } from '../commerce/context';

// Reuse the session-scoped order connection, including its reconnect invalidation.
export default function useDashboardAnalytics(path) {
  const revision = useCommerce()?.revision ?? 0;
  const previousPath = useRef(null);
  const [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    const delay = previousPath.current === path ? 200 : 0;
    previousPath.current = path;
    const load = () => {
      api.get(path).then(({ data }) => {
        if (active) setResult({ path, data, error: '' });
      }).catch(error => {
        if (active) setResult(previous => ({ path,
          data: previous?.path === path ? previous.data : null,
          error: apiError(error, 'Không cập nhật được báo cáo. Vui lòng thử lại.') }));
      });
    };
    const timer = delay ? setTimeout(load, delay) : null;
    if (!delay) load();
    // Discard superseded responses and cancel queued work on filter/session/unmount changes.
    return () => { active = false; clearTimeout(timer); };
  }, [path, revision]);
  return result?.path === path ? { ...result, loading: false } : { data: null, error: '', loading: true };
}
