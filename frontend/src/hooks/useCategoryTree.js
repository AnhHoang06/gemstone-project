import { useEffect, useSyncExternalStore } from "react";
import axios from "axios";
import api from "../api/api";
import { apiError } from "../auth/session";

// One /categories/tree request per page load, shared by Header, Home, /shop and breadcrumbs.
// invalidateCategoryTree() drops the cache (admin edits) and refetches for mounted consumers.
const idle = { data: null, error: "", loading: true };
let state = idle;
let request = null;
let generation = 0;
const listeners = new Set();

function emit(next) {
  state = next;
  listeners.forEach(listener => listener());
}

export function loadCategoryTree() {
  if (request) return request;
  const current = ++generation;
  if (!state.data) emit({ data: null, error: "", loading: true });
  request = api.get("/categories/tree").then(({ data }) => {
    if (current === generation) emit({ data, error: "", loading: false });
  }).catch(error => {
    if (current !== generation) return;
    request = null;
    if (axios.isCancel(error)) {
      // Session changed mid-request: retry once consumers are still mounted.
      if (listeners.size) void loadCategoryTree();
      return;
    }
    emit({ data: state.data, loading: false, error: apiError(error, "Không thể tải danh mục. Vui lòng tải lại trang để thử lại.") });
  });
  return request;
}

export function invalidateCategoryTree() {
  generation++;
  request = null;
  if (listeners.size) void loadCategoryTree();
  else state = idle;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const snapshot = () => state;

export default function useCategoryTree() {
  const result = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { void loadCategoryTree(); }, []);
  return result;
}
