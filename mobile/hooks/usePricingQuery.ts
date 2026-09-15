/** Print price calculator + STL uploads. */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/context/AuthContext';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { api } from '@/services/api';
import type { Quote, StlUpload } from '@/types/commerce';

export function mapQuote(r: any): Quote {
    return {
        weightGrams: parseFloat(r.weight_grams),
        printMinutes: r.print_minutes,
        materialCost: parseFloat(r.material_cost),
        electricityCost: parseFloat(r.electricity_cost),
        laborCost: parseFloat(r.labor_cost),
        margin: parseFloat(r.margin),
        unitPrice: parseFloat(r.unit_price),
        quantity: r.quantity,
        totalPrice: parseFloat(r.total_price),
    };
}

export function mapUpload(r: any): StlUpload {
    return {
        id: r.id,
        userId: r.user_id,
        fileName: r.file_name,
        fileUrl: r.file_url ?? undefined,
        fileUnit: r.file_unit,
        volumeCm3: r.volume_cm3 != null ? parseFloat(r.volume_cm3) : undefined,
        estWeightGrams: r.est_weight_grams != null ? parseFloat(r.est_weight_grams) : undefined,
        estPrintMinutes: r.est_print_minutes ?? undefined,
        quotedPrice: r.quoted_price != null ? parseFloat(r.quoted_price) : undefined,
        status: r.status,
    };
}

export interface QuoteInput {
    weightGrams?: number;
    volumeCm3?: number;
    printMinutes?: number;
    quantity?: number;
}

export function useQuoteMutation() {
    return useMutation({
        mutationFn: async (input: QuoteInput) =>
            mapQuote(
                await api.post<any>('/v1/pricing/quote', {
                    weight_grams: input.weightGrams,
                    volume_cm3: input.volumeCm3,
                    print_minutes: input.printMinutes,
                    quantity: input.quantity ?? 1,
                }),
            ),
    });
}

export function useUploadsQuery() {
    const { user } = useAuthContext();
    const userId = user?.id ?? '';
    return useQuery({
        queryKey: queryKeys.uploads(userId),
        queryFn: async () => {
            const data = await api.get<{ items: any[] }>('/v1/uploads?limit=50');
            return data.items.map(mapUpload);
        },
        enabled: !!userId,
    });
}

export interface CreateUploadInput {
    fileName: string;
    fileUrl?: string;
    fileUnit?: 'mm' | 'inch';
    volumeCm3?: number;
}

export function useCreateUploadMutation() {
    const { user } = useAuthContext();
    const key = queryKeys.uploads(user?.id ?? '');
    return useMutation({
        mutationFn: async (input: CreateUploadInput) =>
            mapUpload(
                await api.post<any>('/v1/uploads', {
                    file_name: input.fileName,
                    file_url: input.fileUrl,
                    file_unit: input.fileUnit ?? 'mm',
                    volume_cm3: input.volumeCm3,
                }),
            ),
        onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    });
}
