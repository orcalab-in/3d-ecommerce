/**
 * Catalog data hooks. Catalog is global (admin-owned) so these are not
 * namespaced by userId. snake_case API rows are mapped to camelCase here.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { api } from '@/services/api';
import type { Category, Color, Product, ProductDetail } from '@/types/catalog';

export function mapProduct(r: any): Product {
    return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description ?? undefined,
        weightGrams: parseFloat(r.weight_grams),
        basePrice: parseFloat(r.base_price),
        currency: r.currency,
        status: r.status,
        previewImageUrl: r.preview_image_url ?? undefined,
        modelFileUrl: r.model_file_url ?? undefined,
        estPrintMinutes: r.est_print_minutes ?? 0,
        widthMm: r.width_mm != null ? parseFloat(r.width_mm) : undefined,
        depthMm: r.depth_mm != null ? parseFloat(r.depth_mm) : undefined,
        heightMm: r.height_mm != null ? parseFloat(r.height_mm) : undefined,
        maxColors: r.max_colors ?? 1,
        featured: !!r.featured,
    };
}

export function mapCategory(r: any): Category {
    return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description ?? undefined,
        parentId: r.parent_id ?? undefined,
        sortOrder: r.sort_order ?? 0,
    };
}

export function mapColor(r: any): Color {
    return {
        id: r.id,
        name: r.name,
        hexCode: r.hex_code,
        inStock: !!r.in_stock,
    };
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'name' | 'featured';

export interface ProductFilters {
    q?: string;
    category?: string;
    sort?: ProductSort;
}

export function useProductsQuery(filters: ProductFilters = {}) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.category) params.set('category', filters.category);
    params.set('sort', filters.sort ?? 'newest');
    params.set('limit', '50');
    const qs = params.toString();

    return useQuery({
        queryKey: queryKeys.products(qs),
        queryFn: async () => {
            const data = await api.get<{ items: any[]; total: number }>(`/v1/products?${qs}`);
            return data.items.map(mapProduct);
        },
    });
}

export function useProductQuery(id: string) {
    return useQuery({
        queryKey: queryKeys.product(id),
        queryFn: async (): Promise<ProductDetail> => {
            const r = await api.get<any>(`/v1/products/${id}`);
            return {
                ...mapProduct(r),
                categories: (r.categories ?? []).map(mapCategory),
                colors: (r.colors ?? []).map(mapColor),
            };
        },
        enabled: !!id,
    });
}

export function useCategoriesQuery() {
    return useQuery({
        queryKey: queryKeys.categories(),
        queryFn: async () => {
            const data = await api.get<{ items: any[] }>('/v1/categories?limit=200');
            return data.items.map(mapCategory);
        },
    });
}

export function useColorsQuery() {
    return useQuery({
        queryKey: queryKeys.colors(),
        queryFn: async () => {
            const data = await api.get<{ items: any[] }>('/v1/colors?limit=200');
            return data.items.map(mapColor);
        },
    });
}
