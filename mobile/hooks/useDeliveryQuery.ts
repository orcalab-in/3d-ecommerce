/** Delivery serviceability + production queue status (both public). */
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { api } from '@/services/api';
import type { DeliveryCheck, QueueStatus } from '@/types/commerce';

export function useCheckDeliveryMutation() {
    return useMutation({
        mutationFn: async (pincode: string): Promise<DeliveryCheck> => {
            const r = await api.get<any>(`/v1/delivery/check?pincode=${encodeURIComponent(pincode)}`);
            return {
                pincode: r.pincode,
                serviceable: r.serviceable,
                etaDays: r.eta_days ?? undefined,
                expectedDeliveryDate: r.expected_delivery_date ?? undefined,
                city: r.city ?? undefined,
                state: r.state ?? undefined,
            };
        },
    });
}

export function usePrintQueueQuery() {
    return useQuery({
        queryKey: queryKeys.printQueue(),
        queryFn: async (): Promise<QueueStatus> => {
            const r = await api.get<any>('/v1/print-jobs/queue');
            return { queued: r.queued, printing: r.printing, estWaitMinutes: r.est_wait_minutes };
        },
        staleTime: 60 * 1000,
    });
}
