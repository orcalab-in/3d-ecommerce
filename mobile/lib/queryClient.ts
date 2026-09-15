import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 1,
        },
    },
});

// Centralised, typed query keys. Per-user data is namespaced by userId so
// caches don't bleed across accounts. Catalog data is global.
export const queryKeys = {
    // Catalog (global)
    products: (params?: string) => ['products', params ?? ''] as const,
    product: (id: string) => ['product', id] as const,
    categories: () => ['categories'] as const,
    colors: () => ['colors'] as const,
    pricingConfig: () => ['pricing-config'] as const,
    printQueue: () => ['print-queue'] as const,
    // Per-user
    cart: (userId: string) => ['cart', userId] as const,
    orders: (userId: string) => ['orders', userId] as const,
    addresses: (userId: string) => ['addresses', userId] as const,
    uploads: (userId: string) => ['uploads', userId] as const,
};
