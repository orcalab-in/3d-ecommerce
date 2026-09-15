export type ProductStatus = 'draft' | 'active' | 'out_of_stock' | 'archived';

export interface Product {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    weight_grams: string;
    base_price: string;
    currency: string;
    status: ProductStatus;
    preview_image_url?: string | null;
    est_print_minutes: number;
    width_mm?: string | null;
    depth_mm?: string | null;
    height_mm?: string | null;
    max_colors: number;
    featured: boolean;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    sort_order: number;
}

export interface Color {
    id: string;
    name: string;
    hex_code: string;
    in_stock: boolean;
}

export interface PricingConfig {
    id: string;
    filament_price_per_gram: string;
    electricity_rate_per_kwh: string;
    printer_power_watts: string;
    labor_rate_per_hour: string;
    margin_pct: string;
    is_active: boolean;
}

export type OrderStatus = 'pending' | 'confirmed' | 'printing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
    id: string;
    user_id: string;
    status: OrderStatus;
    subtotal: string;
    shipping_fee: string;
    total: string;
    expected_delivery_date?: string | null;
    placed_at: string;
    items: { id: string; name_snapshot: string; quantity: number; unit_price: string }[];
}

export type PrintJobStatus = 'queued' | 'printing' | 'completed' | 'failed';

export interface PrintJob {
    id: string;
    order_item_id: string;
    printer_name: string;
    status: PrintJobStatus;
    queue_position: number;
    est_minutes: number;
}

export interface ServiceablePincode {
    id: string;
    pincode: string;
    city: string;
    state: string;
    eta_days: number;
    is_active: boolean;
}

export interface Page<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
}
