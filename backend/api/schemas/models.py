"""Pydantic v2 request / response models for every endpoint.

Per resource:
  * <Resource>Create   — POST body, required fields only, validated with Field(...)
  * <Resource>Update   — PATCH body, every field Optional[...] = None
  * <Resource>Response — extends OrmBase (from_attributes=True), full row
  * <Resource>PageResponse — paginated list endpoints

Conventions:
  * Decimal for money: Field(ge=0, decimal_places=2, max_digits=12)
  * UUID for all foreign keys / ids
  * Literal[...] for closed enums (status, type)
"""

from __future__ import annotations

from datetime import date as _date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from api.config import MAX_COLORS


class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Auth + users
# ---------------------------------------------------------------------------
class GoogleTokenRequest(BaseModel):
    access_token: str
    mode: Literal["login", "signup"] = "login"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    role: str = "customer"


UserRole = Literal["customer", "admin"]


class UserResponse(OrmBase):
    id: UUID
    name: str
    email: str
    picture_url: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=20)


# ---------------------------------------------------------------------------
# Categories (global / admin)
# ---------------------------------------------------------------------------
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    slug: Optional[str] = Field(default=None, min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = None


class CategoryResponse(OrmBase):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class CategoryPageResponse(BaseModel):
    items: list[CategoryResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Colors (global palette / admin)
# ---------------------------------------------------------------------------
class ColorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    hex_code: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    in_stock: bool = True


class ColorUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    hex_code: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    in_stock: Optional[bool] = None


class ColorResponse(OrmBase):
    id: UUID
    name: str
    hex_code: str
    in_stock: bool
    created_at: datetime
    updated_at: datetime


class ColorPageResponse(BaseModel):
    items: list[ColorResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Products (3D print models — global / admin-owned)
# ---------------------------------------------------------------------------
ProductStatus = Literal["draft", "active", "out_of_stock", "archived"]


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: Optional[str] = None
    weight_grams: Decimal = Field(gt=0, decimal_places=2, max_digits=10)
    base_price: Decimal = Field(ge=0, decimal_places=2, max_digits=12)
    currency: str = "INR"
    status: ProductStatus = "draft"
    preview_image_url: Optional[str] = None
    model_file_url: Optional[str] = None
    est_print_minutes: int = Field(default=0, ge=0)
    width_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    depth_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    height_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    max_colors: int = Field(default=1, ge=1, le=MAX_COLORS)
    featured: bool = False
    category_ids: list[UUID] = Field(default_factory=list)
    color_ids: list[UUID] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    slug: Optional[str] = Field(default=None, min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: Optional[str] = None
    weight_grams: Optional[Decimal] = Field(default=None, gt=0, decimal_places=2, max_digits=10)
    base_price: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2, max_digits=12)
    currency: Optional[str] = None
    status: Optional[ProductStatus] = None
    preview_image_url: Optional[str] = None
    model_file_url: Optional[str] = None
    est_print_minutes: Optional[int] = Field(default=None, ge=0)
    width_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    depth_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    height_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    max_colors: Optional[int] = Field(default=None, ge=1, le=MAX_COLORS)
    featured: Optional[bool] = None
    category_ids: Optional[list[UUID]] = None
    color_ids: Optional[list[UUID]] = None


class ProductResponse(OrmBase):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    weight_grams: Decimal
    base_price: Decimal
    currency: str
    status: ProductStatus
    preview_image_url: Optional[str] = None
    model_file_url: Optional[str] = None
    est_print_minutes: int
    width_mm: Optional[Decimal] = None
    depth_mm: Optional[Decimal] = None
    height_mm: Optional[Decimal] = None
    max_colors: int
    featured: bool
    created_at: datetime
    updated_at: datetime


class ProductDetailResponse(ProductResponse):
    categories: list[CategoryResponse] = Field(default_factory=list)
    colors: list[ColorResponse] = Field(default_factory=list)


class ProductPageResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Addresses (per-user)
# ---------------------------------------------------------------------------
class AddressCreate(BaseModel):
    label: str = Field(default="Home", max_length=60)
    recipient_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=5, max_length=20)
    line1: str = Field(min_length=1, max_length=200)
    line2: Optional[str] = None
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    pincode: str = Field(min_length=3, max_length=12)
    is_default: bool = False


class AddressUpdate(BaseModel):
    label: Optional[str] = Field(default=None, max_length=60)
    recipient_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, min_length=5, max_length=20)
    line1: Optional[str] = Field(default=None, min_length=1, max_length=200)
    line2: Optional[str] = None
    city: Optional[str] = Field(default=None, min_length=1, max_length=120)
    state: Optional[str] = Field(default=None, min_length=1, max_length=120)
    pincode: Optional[str] = Field(default=None, min_length=3, max_length=12)
    is_default: Optional[bool] = None


class AddressResponse(OrmBase):
    id: UUID
    user_id: UUID
    label: str
    recipient_name: str
    phone: str
    line1: str
    line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    is_default: bool
    created_at: datetime
    updated_at: datetime


class AddressPageResponse(BaseModel):
    items: list[AddressResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Cart (per-user)
# ---------------------------------------------------------------------------
class CartItemCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(default=1, gt=0)
    selected_color_ids: list[UUID] = Field(default_factory=list, max_length=MAX_COLORS)
    scale: Decimal = Field(default=Decimal("1.0"), gt=0, max_digits=6, decimal_places=3)
    width_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    depth_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    height_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)


class CartItemUpdate(BaseModel):
    quantity: Optional[int] = Field(default=None, gt=0)
    selected_color_ids: Optional[list[UUID]] = Field(default=None, max_length=MAX_COLORS)
    scale: Optional[Decimal] = Field(default=None, gt=0, max_digits=6, decimal_places=3)
    width_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    depth_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    height_mm: Optional[Decimal] = Field(default=None, gt=0, max_digits=8, decimal_places=2)


class CartItemResponse(OrmBase):
    id: UUID
    user_id: UUID
    product_id: UUID
    quantity: int
    selected_color_ids: list[UUID]
    scale: Decimal
    width_mm: Optional[Decimal] = None
    depth_mm: Optional[Decimal] = None
    height_mm: Optional[Decimal] = None
    unit_price: Decimal
    created_at: datetime
    updated_at: datetime


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    subtotal: Decimal
    count: int


# ---------------------------------------------------------------------------
# Orders (per-user)
# ---------------------------------------------------------------------------
OrderStatus = Literal["pending", "confirmed", "printing", "shipped", "delivered", "cancelled"]


class OrderCreate(BaseModel):
    address_id: UUID


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderItemResponse(OrmBase):
    id: UUID
    order_id: UUID
    product_id: Optional[UUID] = None
    stl_upload_id: Optional[UUID] = None
    name_snapshot: str
    quantity: int
    unit_price: Decimal
    selected_color_ids: list[UUID]
    width_mm: Optional[Decimal] = None
    depth_mm: Optional[Decimal] = None
    height_mm: Optional[Decimal] = None
    created_at: datetime


class OrderResponse(OrmBase):
    id: UUID
    user_id: UUID
    address_id: Optional[UUID] = None
    status: OrderStatus
    subtotal: Decimal
    shipping_fee: Decimal
    total: Decimal
    expected_delivery_date: Optional[_date] = None
    placed_at: datetime
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse] = Field(default_factory=list)


class OrderPageResponse(BaseModel):
    items: list[OrderResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# STL uploads + price calculator (per-user)
# ---------------------------------------------------------------------------
StlStatus = Literal["uploaded", "quoted", "ordered"]
FileUnit = Literal["mm", "inch"]


class StlUploadCreate(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    file_url: Optional[str] = None
    file_unit: FileUnit = "mm"
    volume_cm3: Optional[Decimal] = Field(default=None, ge=0, max_digits=12, decimal_places=3)


class StlUploadResponse(OrmBase):
    id: UUID
    user_id: UUID
    file_name: str
    file_url: Optional[str] = None
    file_unit: FileUnit
    volume_cm3: Optional[Decimal] = None
    est_weight_grams: Optional[Decimal] = None
    est_print_minutes: Optional[int] = None
    quoted_price: Optional[Decimal] = None
    status: StlStatus
    created_at: datetime
    updated_at: datetime


class StlUploadPageResponse(BaseModel):
    items: list[StlUploadResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Pricing config + quote (global / admin)
# ---------------------------------------------------------------------------
class PricingConfigResponse(OrmBase):
    id: UUID
    filament_price_per_gram: Decimal
    electricity_rate_per_kwh: Decimal
    printer_power_watts: Decimal
    labor_rate_per_hour: Decimal
    margin_pct: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PricingConfigUpdate(BaseModel):
    filament_price_per_gram: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=4)
    electricity_rate_per_kwh: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=4)
    printer_power_watts: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    labor_rate_per_hour: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    margin_pct: Optional[Decimal] = Field(default=None, ge=0, max_digits=6, decimal_places=2)


class QuoteRequest(BaseModel):
    """Estimate a print price. Provide weight OR volume; print time optional."""

    weight_grams: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    volume_cm3: Optional[Decimal] = Field(default=None, gt=0, max_digits=12, decimal_places=3)
    print_minutes: Optional[int] = Field(default=None, ge=0)
    quantity: int = Field(default=1, gt=0)

    @model_validator(mode="after")
    def _need_weight_or_volume(self) -> "QuoteRequest":
        if self.weight_grams is None and self.volume_cm3 is None:
            raise ValueError("Provide either weight_grams or volume_cm3")
        return self


class QuoteResponse(BaseModel):
    weight_grams: Decimal
    print_minutes: int
    material_cost: Decimal
    electricity_cost: Decimal
    labor_cost: Decimal
    margin: Decimal
    unit_price: Decimal
    quantity: int
    total_price: Decimal


# ---------------------------------------------------------------------------
# Delivery serviceability (global / admin)
# ---------------------------------------------------------------------------
class ServiceablePincodeCreate(BaseModel):
    pincode: str = Field(min_length=3, max_length=12)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    eta_days: int = Field(default=5, ge=0)
    is_active: bool = True


class ServiceablePincodeResponse(OrmBase):
    id: UUID
    pincode: str
    city: str
    state: str
    eta_days: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class DeliveryCheckResponse(BaseModel):
    pincode: str
    serviceable: bool
    eta_days: Optional[int] = None
    expected_delivery_date: Optional[_date] = None
    city: Optional[str] = None
    state: Optional[str] = None


# ---------------------------------------------------------------------------
# Print jobs / queue (global / admin)
# ---------------------------------------------------------------------------
PrintJobStatus = Literal["queued", "printing", "completed", "failed"]


class PrintJobUpdate(BaseModel):
    status: Optional[PrintJobStatus] = None
    printer_name: Optional[str] = Field(default=None, max_length=120)
    queue_position: Optional[int] = Field(default=None, ge=0)
    est_minutes: Optional[int] = Field(default=None, ge=0)


class PrintJobResponse(OrmBase):
    id: UUID
    order_item_id: UUID
    printer_name: str
    status: PrintJobStatus
    queue_position: int
    est_minutes: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PrintJobPageResponse(BaseModel):
    items: list[PrintJobResponse]
    total: int
    limit: int
    offset: int


class QueueStatusResponse(BaseModel):
    queued: int
    printing: int
    est_wait_minutes: int


# ---------------------------------------------------------------------------
# Generic
# ---------------------------------------------------------------------------
class MessageResponse(BaseModel):
    message: str
