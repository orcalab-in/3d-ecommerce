"""3D-print price calculator.

    price = (material + electricity + labor) * (1 + margin)

      material    = weight_g * filament_price_per_gram
      electricity = (printer_power_w / 1000) * print_hours * electricity_rate_per_kwh
      labor       = print_hours * labor_rate_per_hour

All rates come from the admin-managed `pricing_config` row.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from api.config import DEFAULT_FILAMENT_DENSITY_G_PER_CM3

_CENTS = Decimal("0.01")


def _round(value: Decimal) -> Decimal:
    return value.quantize(_CENTS, rounding=ROUND_HALF_UP)


def weight_from_volume(volume_cm3: Decimal, density: float = DEFAULT_FILAMENT_DENSITY_G_PER_CM3) -> Decimal:
    """Estimate filament weight (grams) from solid volume (cm^3)."""
    return _round(volume_cm3 * Decimal(str(density)))


def compute_quote(
    *,
    config: dict,
    weight_grams: Decimal,
    print_minutes: int,
    quantity: int = 1,
) -> dict:
    """Return a fully itemised quote dict (Decimals) using a pricing_config row."""
    filament_rate = Decimal(str(config["filament_price_per_gram"]))
    elec_rate = Decimal(str(config["electricity_rate_per_kwh"]))
    power_w = Decimal(str(config["printer_power_watts"]))
    labor_rate = Decimal(str(config["labor_rate_per_hour"]))
    margin_pct = Decimal(str(config["margin_pct"]))

    print_hours = Decimal(print_minutes) / Decimal(60)

    material = weight_grams * filament_rate
    electricity = (power_w / Decimal(1000)) * print_hours * elec_rate
    labor = print_hours * labor_rate

    base = material + electricity + labor
    margin = base * (margin_pct / Decimal(100))
    unit_price = base + margin
    total = unit_price * Decimal(quantity)

    return {
        "weight_grams": _round(weight_grams),
        "print_minutes": print_minutes,
        "material_cost": _round(material),
        "electricity_cost": _round(electricity),
        "labor_cost": _round(labor),
        "margin": _round(margin),
        "unit_price": _round(unit_price),
        "quantity": quantity,
        "total_price": _round(total),
    }
