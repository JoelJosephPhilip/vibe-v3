import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { api } from '@/lib/api';

export interface Notification {
  _id: string;
  type: 'ejection' | 'reinstatement' | 'policy_created' | 'policy_updated' | 'inactivity_warning' | string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  courseId?: string;
  courseVersionId?: string;
  cohortId?: string;
  policyId?: string;
}

export interface NotificationsPage {
  notifications: Notification[];
  unreadCount: number;
}

export const notificationKeys = {
  all: ['notifications'] as const,
};

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: async () =>
      unwrap(await api.GET('/api/notifications/user/', { params: { query: { limit: 20 } } })) as unknown as NotificationsPage,
    // Polling instead of a push channel - simple and good enough for ejection/policy alerts,
    // which aren't latency-sensitive.
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.POST('/api/notifications/user/{notificationId}/read', { params: { path: { notificationId } } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.POST('/api/notifications/user/read-all', {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
