from __future__ import annotations

import math


LENGTH_TO_METRES = {
    "mm": 0.001,
    "cm": 0.01,
    "m": 1.0,
    "ft": 0.3048,
}
AREA_TO_SQUARE_METRES = {
    "sq.m": 1.0,
    "sq.ft": 0.09290304,
}


def _positive_finite(value: float | int | None, name: str) -> float:
    if value is None:
        raise ValueError(f"{name} is required.")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a number.")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"{name} must be finite.")
    if number <= 0:
        raise ValueError(f"{name} must be greater than zero.")
    return number


def normalize_length_unit(unit: str | None) -> str | None:
    if unit is None:
        return None
    normalized = unit.strip().lower().replace(" ", "")
    aliases = {
        "millimeter": "mm",
        "millimeters": "mm",
        "millimetre": "mm",
        "millimetres": "mm",
        "centimeter": "cm",
        "centimeters": "cm",
        "centimetre": "cm",
        "centimetres": "cm",
        "meter": "m",
        "meters": "m",
        "metre": "m",
        "metres": "m",
        "feet": "ft",
        "foot": "ft",
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in LENGTH_TO_METRES else None


def normalize_area_unit(unit: str | None) -> str | None:
    if unit is None:
        return None
    normalized = (
        unit.strip()
        .lower()
        .replace(" ", "")
        .replace(".", "")
        .replace("²", "2")
    )
    aliases = {
        "sqm": "sq.m",
        "m2": "sq.m",
        "squaremeter": "sq.m",
        "squaremeters": "sq.m",
        "squaremetre": "sq.m",
        "squaremetres": "sq.m",
        "sqft": "sq.ft",
        "ft2": "sq.ft",
        "squarefoot": "sq.ft",
        "squarefeet": "sq.ft",
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in AREA_TO_SQUARE_METRES else None


def convert_length(value: float, from_unit: str, to_unit: str) -> float:
    number = _positive_finite(value, "Length")
    source = normalize_length_unit(from_unit)
    target = normalize_length_unit(to_unit)
    if source is None or target is None:
        raise ValueError("Length conversion requires compatible supported units.")
    converted = number * LENGTH_TO_METRES[source] / LENGTH_TO_METRES[target]
    if not math.isfinite(converted):
        raise ValueError("Converted length must be finite.")
    return converted


def convert_area(value: float, from_unit: str, to_unit: str) -> float:
    number = _positive_finite(value, "Area")
    source = normalize_area_unit(from_unit)
    target = normalize_area_unit(to_unit)
    if source is None or target is None:
        raise ValueError("Area conversion requires compatible supported units.")
    converted = number * AREA_TO_SQUARE_METRES[source] / AREA_TO_SQUARE_METRES[target]
    if not math.isfinite(converted):
        raise ValueError("Converted area must be finite.")
    return converted


def _area_in_square_metres(
    value: float | int | None, unit: str, name: str
) -> float:
    number = _positive_finite(value, name)
    normalized_unit = normalize_area_unit(unit)
    if normalized_unit is None:
        raise ValueError(f"{name} must use a supported area unit.")
    converted = number * AREA_TO_SQUARE_METRES[normalized_unit]
    if not math.isfinite(converted):
        raise ValueError(f"{name} must be finite after unit conversion.")
    return converted


def calculate_fsi(
    total_floor_area: float | int | None,
    floor_area_unit: str,
    plot_area: float | int | None,
    plot_area_unit: str,
) -> float:
    floor_area_m2 = _area_in_square_metres(
        total_floor_area, floor_area_unit, "Total counted floor area"
    )
    plot_area_m2 = _area_in_square_metres(plot_area, plot_area_unit, "Plot area")
    return floor_area_m2 / plot_area_m2


def calculate_plot_coverage_percent(
    building_footprint: float | int | None,
    footprint_unit: str,
    plot_area: float | int | None,
    plot_area_unit: str,
) -> float:
    footprint_m2 = _area_in_square_metres(
        building_footprint, footprint_unit, "Building footprint"
    )
    plot_area_m2 = _area_in_square_metres(plot_area, plot_area_unit, "Plot area")
    if footprint_m2 > plot_area_m2:
        raise ValueError("Building footprint cannot exceed plot area.")
    return footprint_m2 / plot_area_m2 * 100.0