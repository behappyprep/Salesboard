"""Finance formulas shared by the API and unit tests. Decimal throughout."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

ZERO = Decimal('0')

def dec(value, *, default='0'):
    if value is None or value == '':
        return Decimal(default)
    try:
        d = Decimal(str(value))
    except (ValueError, InvalidOperation, TypeError) as exc:
        raise ValueError('Invalid money amount') from exc
    if not d.is_finite():
        raise ValueError('Money must be finite')
    return d

def cents(value):
    return dec(value).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)

def fmt(value):
    return str(cents(value))

def compute_line(quantity, item_revenue, shipping_revenue, item_refunds, shipping_refunds,
                 cogs_unit, marketplace_fees, shipping_cost, other_cost, fee_known, shipping_known,
                 cost_rate=Decimal('1'), revenue_rate=Decimal('1')):
    """Amounts in respective native currencies; rates convert each currency to report currency.
    Never claim complete profit if COGS or necessary costs are unknown.
    Revenue is net of refunds and excludes tax; cost snapshot is per unit.
    """
    q = dec(quantity)
    if q < 0:
        raise ValueError('Quantity cannot be negative')
    rate = dec(revenue_rate)
    cr = dec(cost_rate)
    if rate <= 0 or cr <= 0:
        raise ValueError('FX rate must be positive')
    revenue = (dec(item_revenue) + dec(shipping_revenue) - dec(item_refunds) - dec(shipping_refunds)) * rate
    cogs = q * dec(cogs_unit) * cr if cogs_unit is not None else None
    fees = dec(marketplace_fees) * rate if fee_known else None
    shipping = dec(shipping_cost) * rate if shipping_known else None
    other = dec(other_cost) * rate
    # Never silently replace an unknown fee/shipping cost with zero.
    complete = cogs is not None and fees is not None and shipping is not None
    known_contribution = revenue - (cogs or ZERO) - (fees or ZERO) - (shipping or ZERO) - other
    return {
        'revenue': cents(revenue), 'cogs': cents(cogs) if cogs is not None else None,
        'gross_profit': cents(revenue-cogs) if cogs is not None else None,
        'fees': cents(fees) if fees is not None else None,
        'shipping_cost': cents(shipping) if shipping is not None else None,
        'profit': cents(known_contribution) if complete else None,
        'complete': complete, 'known_contribution': cents(known_contribution),
    }
