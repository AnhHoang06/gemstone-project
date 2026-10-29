import { useSyncExternalStore } from 'react';
import { subscribeSession, getSessionToken } from '../auth/session';
export function useEngagementSession() { return useSyncExternalStore(subscribeSession, getSessionToken, () => ''); }
