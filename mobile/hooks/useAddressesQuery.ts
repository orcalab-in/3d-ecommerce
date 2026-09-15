/** Address book (per-user) with optimistic mutations. */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/context/AuthContext';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { api } from '@/services/api';
import type { Address } from '@/types/commerce';

export function mapAddress(r: any): Address {
    return {
        id: r.id,
        userId: r.user_id,
        label: r.label,
        recipientName: r.recipient_name,
        phone: r.phone,
        line1: r.line1,
        line2: r.line2 ?? undefined,
        city: r.city,
        state: r.state,
        pincode: r.pincode,
        isDefault: !!r.is_default,
    };
}

export interface AddressInput {
    label?: string;
    recipientName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    isDefault?: boolean;
}

function toBody(a: Partial<AddressInput>) {
    const b: any = {};
    if (a.label !== undefined) b.label = a.label;
    if (a.recipientName !== undefined) b.recipient_name = a.recipientName;
    if (a.phone !== undefined) b.phone = a.phone;
    if (a.line1 !== undefined) b.line1 = a.line1;
    if (a.line2 !== undefined) b.line2 = a.line2;
    if (a.city !== undefined) b.city = a.city;
    if (a.state !== undefined) b.state = a.state;
    if (a.pincode !== undefined) b.pincode = a.pincode;
    if (a.isDefault !== undefined) b.is_default = a.isDefault;
    return b;
}

export function useAddressesQuery() {
    const { user } = useAuthContext();
    const userId = user?.id ?? '';
    return useQuery({
        queryKey: queryKeys.addresses(userId),
        queryFn: async () => {
            const data = await api.get<{ items: any[] }>('/v1/addresses?limit=100');
            return data.items.map(mapAddress);
        },
        enabled: !!userId,
    });
}

export function useAddAddressMutation() {
    const { user } = useAuthContext();
    const key = queryKeys.addresses(user?.id ?? '');
    return useMutation({
        mutationFn: async (input: AddressInput) => mapAddress(await api.post<any>('/v1/addresses', toBody(input))),
        onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    });
}

export function useUpdateAddressMutation() {
    const { user } = useAuthContext();
    const key = queryKeys.addresses(user?.id ?? '');
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<AddressInput> }) =>
            mapAddress(await api.patch<any>(`/v1/addresses/${id}`, toBody(updates))),
        onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    });
}

export function useDeleteAddressMutation() {
    const { user } = useAuthContext();
    const key = queryKeys.addresses(user?.id ?? '');
    return useMutation({
        mutationFn: (id: string) => api.delete<void>(`/v1/addresses/${id}`),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<Address[]>(key);
            queryClient.setQueryData<Address[]>(key, (old = []) => old.filter((a) => a.id !== id));
            return { previous };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    });
}
