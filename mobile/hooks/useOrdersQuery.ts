/** Orders (per-user): list, detail, checkout, cancel. */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/context/AuthContext';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { api } from '@/services/api';
import type { Order, OrderItem } from '@/types/commerce';

function mapOrderItem(r: any): OrderItem {
    return {
        id: r.id,
        orderId: r.order_id,
        productId: r.product_id ?? undefined,
        nameSnapshot: r.name_snapshot,
        quantity: r.quantity,
        unitPrice: parseFloat(r.unit_price),
        selectedColorIds: r.selected_color_ids ?? [],
    };
}

export function mapOrder(r: any): Order {
    return {
        id: r.id,
        userId: r.user_id,
        addressId: r.address_id ?? undefined,
        status: r.status,
        subtotal: parseFloat(r.subtotal),
        shippingFee: parseFloat(r.shipping_fee),
        total: parseFloat(r.total),
        expectedDeliveryDate: r.expected_delivery_date ?? undefined,
        placedAt: r.placed_at,
        items: (r.items ?? []).map(mapOrderItem),
    };
}

export function useOrdersQuery() {
    const { user } = useAuthContext();
    const userId = user?.id ?? '';
    return useQuery({
        queryKey: queryKeys.orders(userId),
        queryFn: async () => {
            const data = await api.get<{ items: any[] }>('/v1/orders?limit=50');
            return data.items.map(mapOrder);
        },
        enabled: !!userId,
    });
}

export function useCreateOrderMutation() {
    const { user } = useAuthContext();
    const userId = user?.id ?? '';
    return useMutation({
        mutationFn: async (addressId: string) =>
            mapOrder(await api.post<any>('/v1/orders', { address_id: addressId })),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders(userId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) });
        },
    });
}

export function useCancelOrderMutation() {
    const { user } = useAuthContext();
    const userId = user?.id ?? '';
    return useMutation({
        mutationFn: async (orderId: string) =>
            mapOrder(await api.patch<any>(`/v1/orders/${orderId}/status`, { status: 'cancelled' })),
        onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders(userId) }),
    });
}
