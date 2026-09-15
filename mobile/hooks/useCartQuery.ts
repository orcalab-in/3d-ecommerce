/** Cart data hook (per-user). Optimistic add/update/remove with rollback. */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/context/AuthContext';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { api } from '@/services/api';
import type { Cart, CartItem } from '@/types/commerce';

export function mapCartItem(r: any): CartItem {
    return {
        id: r.id,
        userId: r.user_id,
        productId: r.product_id,
        quantity: r.quantity,
        selectedColorIds: r.selected_color_ids ?? [],
        scale: parseFloat(r.scale ?? '1'),
        widthMm: r.width_mm != null ? parseFloat(r.width_mm) : undefined,
        depthMm: r.depth_mm != null ? parseFloat(r.depth_mm) : undefined,
        heightMm: r.height_mm != null ? parseFloat(r.height_mm) : undefined,
        unitPrice: parseFloat(r.unit_price),
    };
}

function mapCart(r: any): Cart {
    return {
        items: (r.items ?? []).map(mapCartItem),
        subtotal: parseFloat(r.subtotal ?? '0'),
        count: r.count ?? 0,
    };
}

export function useCartQuery() {
    const { user } = useAuthContext();
    const userId = user?.id ?? '';
    return useQuery({
        queryKey: queryKeys.cart(userId),
        queryFn: async () => mapCart(await api.get<any>('/v1/cart')),
        enabled: !!userId,
    });
}

export interface AddToCartPayload {
    productId: string;
    quantity?: number;
    selectedColorIds?: string[];
    scale?: number;
    widthMm?: number;
    depthMm?: number;
    heightMm?: number;
}

export function useAddToCartMutation() {
    const { user } = useAuthContext();
    const key = queryKeys.cart(user?.id ?? '');
    return useMutation({
        mutationFn: async (p: AddToCartPayload) => {
            const r = await api.post<any>('/v1/cart', {
                product_id: p.productId,
                quantity: p.quantity ?? 1,
                selected_color_ids: p.selectedColorIds ?? [],
                scale: p.scale ?? 1,
                width_mm: p.widthMm,
                depth_mm: p.depthMm,
                height_mm: p.heightMm,
            });
            return mapCartItem(r);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    });
}

export function useUpdateCartItemMutation() {
    const { user } = useAuthContext();
    const key = queryKeys.cart(user?.id ?? '');
    return useMutation({
        mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
            const r = await api.patch<any>(`/v1/cart/${id}`, { quantity });
            return mapCartItem(r);
        },
        onMutate: async ({ id, quantity }) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<Cart>(key);
            queryClient.setQueryData<Cart>(key, (old) =>
                old
                    ? {
                          ...old,
                          items: old.items.map((it) => (it.id === id ? { ...it, quantity } : it)),
                          subtotal: old.items.reduce(
                              (sum, it) => sum + (it.id === id ? quantity : it.quantity) * it.unitPrice,
                              0,
                          ),
                      }
                    : old,
            );
            return { previous };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    });
}

export function useRemoveCartItemMutation() {
    const { user } = useAuthContext();
    const key = queryKeys.cart(user?.id ?? '');
    return useMutation({
        mutationFn: (id: string) => api.delete<void>(`/v1/cart/${id}`),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<Cart>(key);
            queryClient.setQueryData<Cart>(key, (old) =>
                old
                    ? {
                          ...old,
                          items: old.items.filter((it) => it.id !== id),
                          count: Math.max(0, old.count - 1),
                      }
                    : old,
            );
            return { previous };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    });
}

export function useClearCartMutation() {
    const { user } = useAuthContext();
    const key = queryKeys.cart(user?.id ?? '');
    return useMutation({
        mutationFn: () => api.delete<void>('/v1/cart'),
        onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    });
}
