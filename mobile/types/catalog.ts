// UI-facing (camelCase) domain types. API rows are snake_case and mapped in hooks.

export type ProductStatus = 'draft' | 'active' | 'out_of_stock' | 'archived';

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    parentId?: string;
    sortOrder: number;
}

export interface Color {
    id: string;
    name: string;
    hexCode: string;
    inStock: boolean;
}

export interface Product {
    id: string;
    name: string;
    slug: string;
    description?: string;
    weightGrams: number;
    basePrice: number;
    currency: string;
    status: ProductStatus;
    previewImageUrl?: string;
    modelFileUrl?: string;
    estPrintMinutes: number;
    widthMm?: number;
    depthMm?: number;
    heightMm?: number;
    maxColors: number;
    featured: boolean;
}

export interface ProductDetail extends Product {
    categories: Category[];
    colors: Color[];
}

// Bambu Lab A1 build volume — customisation limits surfaced in the UI.
export const BUILD_LIMITS = {
    widthMm: 256,
    depthMm: 256,
    heightMm: 256,
    maxColors: 4,
};
