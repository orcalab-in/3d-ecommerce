export interface CartItem {
    id: string;
    userId: string;
    productId: string;
    quantity: number;
    selectedColorIds: string[];
    scale: number;
    widthMm?: number;
    depthMm?: number;
    heightMm?: number;
    unitPrice: number;
}

export interface Cart {
    items: CartItem[];
    subtotal: number;
    count: number;
}

export interface Address {
    id: string;
    userId: string;
    label: string;
    recipientName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
}

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'printing'
    | 'shipped'
    | 'delivered'
    | 'cancelled';

export interface OrderItem {
    id: string;
    orderId: string;
    productId?: string;
    nameSnapshot: string;
    quantity: number;
    unitPrice: number;
    selectedColorIds: string[];
}

export interface Order {
    id: string;
    userId: string;
    addressId?: string;
    status: OrderStatus;
    subtotal: number;
    shippingFee: number;
    total: number;
    expectedDeliveryDate?: string;
    placedAt: string;
    items: OrderItem[];
}

export interface StlUpload {
    id: string;
    userId: string;
    fileName: string;
    fileUrl?: string;
    fileUnit: 'mm' | 'inch';
    volumeCm3?: number;
    estWeightGrams?: number;
    estPrintMinutes?: number;
    quotedPrice?: number;
    status: 'uploaded' | 'quoted' | 'ordered';
}

export interface Quote {
    weightGrams: number;
    printMinutes: number;
    materialCost: number;
    electricityCost: number;
    laborCost: number;
    margin: number;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
}

export interface DeliveryCheck {
    pincode: string;
    serviceable: boolean;
    etaDays?: number;
    expectedDeliveryDate?: string;
    city?: string;
    state?: string;
}

export interface QueueStatus {
    queued: number;
    printing: number;
    estWaitMinutes: number;
}
