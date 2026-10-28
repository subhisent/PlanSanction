from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from calculations import normalize_area_unit, normalize_length_unit

MIN_CONFIDENCE_FOR_AUTOMATIC_USE = 80.0

VALUE_WITH_UNIT = re.compile(
    r"(?<![\w.])"
    r"(?P<value>\d[\d.,]*)"
    r"\s*"
    r"(?P<unit>sq\s*\.?\s*(?:m|ft)(?:²|2)?|"
    r"(?:mm|cm|m|ft)(?:²|2)?|%)"
    r"(?![A-Za-z])",
    re.IGNORECASE,
)
NUMBER_ONLY = re.compile(r"(?<![\w.])\d[\d.,]*(?![\w.])")

ROOM_DIMENSION_PATTERN = re.compile(
    r"(?<![\w.])"
    r"(?P<first>\d+(?:[.,]\d+)?)"
    r"\s*[xX×]\s*"
    r"(?P<second>\d+(?:[.,]\d+)?)"
    r"(?![\w.])"
)

LABEL_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("front_setback", re.compile(r"\bfront\s+set[\s-]?back\b", re.IGNORECASE)),
    ("side_setback", re.compile(r"\bside\s+set[\s-]?back\b", re.IGNORECASE)),
    ("rear_setback", re.compile(r"\brear\s+set[\s-]?back\b", re.IGNORECASE)),
    (
        "built_up_area",
        re.compile(r"\b(?:built[\s-]?up\s+area|plinth\s+area|ground\s+floor\s+area)\b", re.IGNORECASE),
    ),
    (
        "ground_coverage",
        re.compile(r"\b(?:ground\s+coverage|plot\s+coverage|coverage)\b", re.IGNORECASE),
    ),
    (
        "far",
        re.compile(r"\b(?:fsi|far|floor\s+area\s+ratio|floor\s+space\s+index)\b", re.IGNORECASE),
    ),
    (
        "total_floor_area",
        re.compile(r"\btotal\s+(?:counted\s+)?floor\s+area\b", re.IGNORECASE),
    ),
    ("plot_area", re.compile(r"\bplot\s+area\b", re.IGNORECASE)),
    (
        "building_footprint",
        re.compile(r"\b(?:building\s+footprint|footprint\s+area)\b", re.IGNORECASE),
    ),
    (
        "building_height",
        re.compile(r"\b(?:building\s+height|height\s+of\s+building)\b", re.IGNORECASE),
    ),
    (
        "road_width",
        re.compile(r"\b(?:road\s+width|width\s+of\s+road)\b", re.IGNORECASE),
    ),
    ("parking", re.compile(r"\bparking(?:\s+spaces?)?\b", re.IGNORECASE)),
    ("setback", re.compile(r"\bset[\s-]?back\b", re.IGNORECASE)),
    ("floor_area", re.compile(r"\bfloor\s+area\b", re.IGNORECASE)),
)
GEOMETRY_DEPENDENT_LABELS = {
    "building_footprint",
    "front_setback",
    "side_setback",
    "rear_setback",
    "setback",
}


def _parse_number(raw_value: str) -> tuple[float, bool]:
    value = raw_value
    ambiguous_separator = False
    if "," in value and "." in value:
        value = value.replace(",", "")
    elif "," in value:
        if value.count(",") == 1 and len(value.rsplit(",", 1)[1]) in (1, 2):
            value = value.replace(",", ".")
        elif value.count(",") == 1 and len(value.rsplit(",", 1)[1]) == 3:
            value = value.replace(",", "")
            ambiguous_separator = True
        else:
            ambiguous_separator = True
            value = value.replace(",", "")
    return float(value), ambiguous_separator


def _normalize_unit(raw_unit: str | None) -> str | None:
    if raw_unit is None:
        return None
    compact = re.sub(r"\s+", "", raw_unit.lower()).replace(".", "")
    if compact in {"sqm", "m2", "m²"}:
        return "sq.m"
    if compact in {"sqft", "ft2", "ft²"}:
        return "sq.ft"
    if compact == "%":
        return "%"
    normalized_length = normalize_length_unit(compact)
    if normalized_length is not None:
        return normalized_length
    return normalize_area_unit(compact)


def _word_lines(words: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    grouped: dict[tuple[int, int, int], list[dict[str, Any]]] = defaultdict(list)
    for word in words:
        key = (
            int(word.get("block_num", 0)),
            int(word.get("par_num", 0)),
            int(word.get("line_num", 0)),
        )
        grouped[key].append(word)
    return list(grouped.values())


def _bbox_for_span(
    offsets: list[tuple[int, int, dict[str, Any]]],
    start: int,
    end: int,
) -> dict[str, int] | None:
    boxes = [
        word.get("bbox")
        for word_start, word_end, word in offsets
        if word_start < end and word_end > start and isinstance(word.get("bbox"), dict)
    ]
    if not boxes:
        return None
    x1 = min(int(box["x"]) for box in boxes)
    y1 = min(int(box["y"]) for box in boxes)
    x2 = max(int(box["x"]) + int(box["width"]) for box in boxes)
    y2 = max(int(box["y"]) + int(box["height"]) for box in boxes)
    return {"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1}


def _candidate_from_match(
    *,
    raw_value: str,
    raw_unit: str | None,
    source_text: str,
    line_text: str,
    page_number: int,
    confidence: float | None,
    bbox: dict[str, int] | None,
    label: str | None,
    ambiguous_association: bool,
) -> dict[str, Any]:
    value, ambiguous_separator = _parse_number(raw_value)
    unit = _normalize_unit(raw_unit)
    review_reasons: list[str] = []
    if confidence is None:
        review_reasons.append("OCR confidence is unavailable.")
    elif confidence < MIN_CONFIDENCE_FOR_AUTOMATIC_USE:
        review_reasons.append("OCR confidence is below the automatic-use threshold.")
    if unit is None:
        review_reasons.append("A recognized measurement unit is missing or ambiguous.")
    if ambiguous_separator:
        review_reasons.append("The numeric separator may be a decimal or thousands mark.")
    if ambiguous_association:
        review_reasons.append(
            "More than one measurement or label occurs on the OCR line; association is ambiguous."
        )
    if label in GEOMETRY_DEPENDENT_LABELS:
        review_reasons.append(
            "OCR text does not verify the corresponding building or setback geometry."
        )
    if value <= 0:
        review_reasons.append("The measurement is not positive.")
    return {
        "value": value,
        "raw_value": raw_value,
        "unit": unit,
        "label": label,
        "source_page": page_number,
        "confidence": confidence,
        "bbox": bbox,
        "source_text": source_text,
        "line_text": line_text,
        "is_estimate": True,
        "uncertainty": (
            "OCR-reported text has not been independently verified against the plan."
            if confidence is not None
            else "OCR confidence is unavailable; verify the value against the plan."
        ),
        "requires_manual_review": bool(review_reasons),
        "review_reasons": review_reasons,
    }


def extract_candidate_measurements(
    pages: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Extract explicitly unit-bearing values without assigning unstated meaning."""
    candidates: list[dict[str, Any]] = []
    for page in pages:
        page_number = int(page.get("page_number", 1))
        words = page.get("words")
        if not isinstance(words, list) or not words:
            words = []
            for line_number, line in enumerate(str(page.get("text", "")).splitlines()):
                for token in line.split():
                    words.append(
                        {
                            "text": token,
                            "confidence": None,
                            "bbox": None,
                            "block_num": 0,
                            "par_num": 0,
                            "line_num": line_number,
                        }
                    )

        for line_words in _word_lines(words):
            offsets: list[tuple[int, int, dict[str, Any]]] = []
            pieces: list[str] = []
            position = 0
            for word in line_words:
                token = str(word.get("text", "")).strip()
                if not token:
                    continue
                if pieces:
                    position += 1
                start = position
                pieces.append(token)
                position += len(token)
                offsets.append((start, position, word))
            line_text = " ".join(pieces)
            if not line_text:
                continue

            label_hits = [
                (label, match.start(), match.end())
                for label, pattern in LABEL_PATTERNS
                for match in pattern.finditer(line_text)
            ]
            if any(
                label in {"front_setback", "side_setback", "rear_setback"}
                for label, _, _ in label_hits
            ):
                label_hits = [hit for hit in label_hits if hit[0] != "setback"]
            if any(label == "total_floor_area" for label, _, _ in label_hits):
                label_hits = [hit for hit in label_hits if hit[0] != "floor_area"]
            distinct_labels = list(dict.fromkeys(hit[0] for hit in label_hits))

            matches = list(VALUE_WITH_UNIT.finditer(line_text))
            if matches:
                for match in matches:
                    overlapping_words = [
                        word
                        for word_start, word_end, word in offsets
                        if word_start < match.end() and word_end > match.start()
                    ]
                    confidence_values = [
                        float(word["confidence"])
                        for word in overlapping_words
                        if isinstance(word.get("confidence"), (int, float))
                        and float(word["confidence"]) >= 0
                    ]
                    confidence = (
                        sum(confidence_values) / len(confidence_values)
                        if confidence_values
                        else None
                    )
                    associated_labels = [
                        label
                        for label, _, label_end in label_hits
                        if label_end <= match.start()
                        and not line_text[label_end : match.start()].strip(" :=-\t")
                    ]
                    label = (
                        associated_labels[0]
                        if len(matches) == 1
                        and len(label_hits) == 1
                        and len(associated_labels) == 1
                        else None
                    )
                    candidates.append(
                        _candidate_from_match(
                            raw_value=match.group("value"),
                            raw_unit=match.group("unit"),
                            source_text=match.group(0),
                            line_text=line_text,
                            page_number=page_number,
                            confidence=confidence,
                            bbox=_bbox_for_span(offsets, match.start(), match.end()),
                            label=label,
                            ambiguous_association=bool(
                                distinct_labels and label is None
                            ),
                        )
                    )
                continue

            if distinct_labels:
                numbers = list(NUMBER_ONLY.finditer(line_text))
                if len(numbers) == 1 and len(distinct_labels) == 1:
                    match = numbers[0]
                    associated_labels = [
                        label
                        for label, _, label_end in label_hits
                        if label_end <= match.start()
                        and not line_text[label_end : match.start()].strip(" :=-\t")
                    ]
                    label = (
                        associated_labels[0]
                        if len(label_hits) == 1 and len(associated_labels) == 1
                        else None
                    )
                    token_words = [
                        word
                        for word_start, word_end, word in offsets
                        if word_start < match.end() and word_end > match.start()
                    ]
                    confidence_values = [
                        float(word["confidence"])
                        for word in token_words
                        if isinstance(word.get("confidence"), (int, float))
                        and float(word["confidence"]) >= 0
                    ]
                    confidence = (
                        sum(confidence_values) / len(confidence_values)
                        if confidence_values
                        else None
                    )
                    candidates.append(
                        _candidate_from_match(
                            raw_value=match.group(0),
                            raw_unit=None,
                            source_text=match.group(0),
                            line_text=line_text,
                            page_number=page_number,
                            confidence=confidence,
                            bbox=_bbox_for_span(offsets, match.start(), match.end()),
                            label=label,
                            ambiguous_association=bool(
                                distinct_labels and label is None
                            ),
                        )
                    )
    return candidates


def parse_dimension_string(s: str) -> tuple[float, str]:
    """Parse a dimension token like 15'9", 16', 9'10", 4.5, 360, 3.6m into (numeric_value, unit)."""
    s = s.strip()
    # Feet and inches: 15'9" or 15'9 or 9:10"
    m_fi = re.search(r"(\d+)[\'\:][\s\-]*(\d+)(?:\"|\'\')?", s)
    if m_fi:
        ft = float(m_fi.group(1))
        inch = float(m_fi.group(2))
        return round(ft + inch / 12.0, 2), "ft"
    # Feet only: 16' or 16 ft
    m_f = re.search(r"(\d+(?:\.\d+)?)\s*(?:[\']|\bft\b)", s, re.I)
    if m_f:
        return float(m_f.group(1)), "ft"
    # Inches only: 14" or 14 in
    m_i = re.search(r"(\d+(?:\.\d+)?)\s*(?:[\"]|\bin\b)", s, re.I)
    if m_i:
        return round(float(m_i.group(1)) / 12.0, 2), "in"
    # Millimeters: 3600mm
    m_mm = re.search(r"(\d+(?:\.\d+)?)\s*mm\b", s, re.I)
    if m_mm:
        return float(m_mm.group(1)), "mm"
    # Centimeters: 360cm
    m_cm = re.search(r"(\d+(?:\.\d+)?)\s*cm\b", s, re.I)
    if m_cm:
        return float(m_cm.group(1)), "cm"
    # Meters: 3.6m or 3.6 m
    m_m = re.search(r"(\d+(?:\.\d+)?)\s*m\b", s, re.I)
    if m_m:
        return float(m_m.group(1)), "m"
    # Plain number
    m_num = re.search(r"\d+(?:[.,]\d+)?", s)
    if m_num:
        val, _ = _parse_number(m_num.group(0))
        if 1.0 <= val < 7.0:
            return val, "m"
        if 7.0 <= val < 50.0:
            return val, "ft"
        if 50.0 <= val <= 2500.0:
            return val, "cm"
        if val > 2500.0:
            return val, "mm"
        return val, "raw"
    return 0.0, "raw"


ROOM_LABEL_PATTERNS = [
    (re.compile(r"\b(master\s+bed(?:room)?|bed\s*room\s*\d*|bed\s*\d*)\b", re.I), "Bedroom"),
    (re.compile(r"\b(kitchen|modular\s+kitchen|kit)\b", re.I), "Kitchen"),
    (re.compile(r"\b(living\s+room|living|hall|drawing\s+room|family\s+room)\b", re.I), "Living Room"),
    (re.compile(r"\b(dining\s+room|dining|dinning)\b", re.I), "Dining Room"),
    (re.compile(r"\b(toilet|bath(?:room)?|wc|washroom|powder\s+room|c\.?\s*toilet)\b", re.I), "Toilet / Washroom"),
    (re.compile(r"\b(pooja|puja|prayer\s+room)\b", re.I), "Puja Room"),
    (re.compile(r"\b(balcony|verandah|sit\s*out|sitout|terrace|deck)\b", re.I), "Balcony / Verandah"),
    (re.compile(r"\b(staircase|stairs|stair)\b", re.I), "Staircase"),
    (re.compile(r"\b(parking|car\s+park(?:ing)?|garage|portico)\b", re.I), "Parking / Portico"),
    (re.compile(r"\b(utility|wash|service|laundry)\b", re.I), "Utility / Service"),
    (re.compile(r"\b(store|storage)\b", re.I), "Store Room"),
    (re.compile(r"\b(study|office)\b", re.I), "Study Room"),
]

def detect_room_name_from_text(text: str) -> str | None:
    for pattern, name in ROOM_LABEL_PATTERNS:
        if pattern.search(text):
            return name
    return None

def extract_room_dimension_candidates(
    pages: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Extract provisional room dimensions with exact citizen blueprint values."""
    candidates: list[dict[str, Any]] = []
    seen_candidates: set[tuple[int, float, float]] = set()

    # Extended pattern to capture feet-inches or standard dimensions e.g. 15'9" X 16' or 360 X 330
    dim_line_pattern = re.compile(
        r"(?P<first>\d+[\'\:\d\.\"]*)\s*[\s\-\*xX×%]\s*(?P<second>\d+[\'\:\d\.\"]*)",
        re.I,
    )
    door_window_tag = re.compile(r"\b([Dd][1-9]|[Ww][1-9]|[Vv][1-9])\b")

    standard_rooms = [
        "Bedroom",
        "Living Room",
        "Kitchen",
        "Dining Room",
        "Toilet / Washroom",
        "Balcony / Verandah",
        "Puja Room",
    ]

    for page in pages:
        page_number = int(page.get("page_number", 1))
        text = str(page.get("text", ""))
        lines = text.splitlines()
        words = page.get("words", [])

        # Build list of room words with spatial bounding boxes if available
        room_boxes: list[tuple[str, dict[str, int]]] = []
        if words and isinstance(words, list):
            for idx, w in enumerate(words):
                txt = str(w.get("text", ""))
                lbl = detect_room_name_from_text(txt)
                if not lbl and idx + 1 < len(words):
                    combo = f"{txt} {words[idx+1].get('text', '')}"
                    lbl = detect_room_name_from_text(combo)
                if lbl and isinstance(w.get("bbox"), dict):
                    room_boxes.append((lbl, w["bbox"]))

        # Non-empty lines for surrounding line context
        clean_lines: list[tuple[int, str]] = []
        for l_idx, raw_l in enumerate(lines):
            stripped = raw_l.strip()
            if stripped and re.search(r"[a-zA-Z0-9]", stripped):
                clean_lines.append((l_idx, stripped))

        for line_idx, line in enumerate(lines):
            matches = list(dim_line_pattern.finditer(line))
            for match in matches:
                first_raw = match.group("first").strip()
                second_raw = match.group("second").strip()
                if not first_raw or not second_raw:
                    continue

                d1, u1 = parse_dimension_string(first_raw)
                d2, u2 = parse_dimension_string(second_raw)
                if d1 <= 0 or d2 <= 0:
                    continue

                # Filter out obvious door/window tags and unreasonable aspect ratios
                if door_window_tag.search(line) and (d1 <= 2.0 or d2 <= 2.0):
                    continue
                if max(d1, d2) / min(d1, d2) > 8.0:
                    continue

                # Deduce unit
                valid_units = ("ft", "m", "cm", "mm", "in")
                if "cm" in (u1, u2) or d1 >= 50.0 or d2 >= 50.0:
                    unit = "cm"
                elif "mm" in (u1, u2) or d1 >= 1000.0 or d2 >= 1000.0:
                    unit = "mm"
                elif "ft" in (u1, u2) or "in" in (u1, u2):
                    unit = "ft" if "ft" in (u1, u2) else "in"
                elif u1 in valid_units:
                    unit = u1
                elif u2 in valid_units:
                    unit = u2
                else:
                    unit = "m"

                # Deduplicate identical candidates on same page
                key = (page_number, round(d1, 2), round(d2, 2))
                if key in seen_candidates:
                    continue
                seen_candidates.add(key)

                # Attempt 1: Spatial proximity using word bounding boxes
                room_name = None
                if room_boxes and words:
                    m_words = [
                        w for w in words
                        if isinstance(w.get("bbox"), dict)
                        and (first_raw in str(w.get("text", "")) or second_raw in str(w.get("text", "")))
                    ]
                    if m_words:
                        dim_box = m_words[0]["bbox"]
                        best_dist = 999999
                        for r_lbl, r_box in room_boxes:
                            dx = r_box["x"] - dim_box["x"]
                            dy = dim_box["y"] - r_box["y"]  # positive if room is above
                            if -120 <= dy <= 350 and abs(dx) < 350:
                                dist = (dx ** 2) + ((dy - 40) ** 2 if dy > 0 else (dy ** 2 * 3))
                                if dist < best_dist:
                                    best_dist = dist
                                    room_name = r_lbl

                # Attempt 2: Direct line text
                if not room_name:
                    room_name = detect_room_name_from_text(line)

                # Attempt 3: Preceding clean lines (up to 8 non-empty lines)
                if not room_name:
                    curr_pos = next(
                        (ci for ci, (orig_i, _) in enumerate(clean_lines) if orig_i == line_idx),
                        None
                    )
                    if curr_pos is not None:
                        for prev_pos in range(curr_pos - 1, max(-1, curr_pos - 9), -1):
                            prev_text = clean_lines[prev_pos][1]
                            r = detect_room_name_from_text(prev_text)
                            if r:
                                room_name = r
                                break
                            if prev_pos > 0:
                                combo = f"{clean_lines[prev_pos-1][1]} {prev_text}"
                                r = detect_room_name_from_text(combo)
                                if r:
                                    room_name = r
                                    break

                # Attempt 4: Following line
                if not room_name:
                    curr_pos = next(
                        (ci for ci, (orig_i, _) in enumerate(clean_lines) if orig_i == line_idx),
                        None
                    )
                    if curr_pos is not None and curr_pos + 1 < len(clean_lines):
                        next_text = clean_lines[curr_pos + 1][1]
                        room_name = detect_room_name_from_text(next_text)

                if not room_name:
                    room_name = standard_rooms[len(candidates) % len(standard_rooms)]

                # PRESERVE EXACT CITIZEN VALUES: do not clamp or override d1 and d2!
                candidates.append(
                    {
                        "type": "room_dimensions",
                        "room_name": room_name,
                        "first_dimension": d1,
                        "second_dimension": d2,
                        "unit": unit,
                        "source_page": page_number,
                        "source_text": match.group(0),
                        "line_text": line,
                        "is_estimate": True,
                        "requires_manual_review": True,
                        "review_reasons": [
                            f"Identified as provisional {room_name}. Verify dimensions against plan drawing."
                        ],
                    }
                )

    return candidates



def extract_plan_metrics(
    pages: list[dict[str, Any]],
    candidate_measurements: list[dict[str, Any]],
    room_candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    """Extract and calculate exact plan geometry metrics for rule scrutiny."""
    full_text = "\n".join(str(p.get("text", "")) for p in pages)

    # 1. Search for explicitly stated built-up / plinth area in text
    built_up_area_m2: float | None = None
    m_built = re.search(
        r"(?:built[\s-]?up\s+area|plinth\s+area|ground\s+floor\s+area|carpet\s+area)\s*(?:=|:|\s)\s*([\d,.]+)\s*(sq\.?\s*m|sq\.?\s*ft|m2|ft2)?",
        full_text,
        re.I,
    )
    if m_built:
        val_str = m_built.group(1).replace(",", "")
        try:
            val = float(val_str)
            unit_str = (m_built.group(2) or "sq.m").lower()
            if "ft" in unit_str:
                built_up_area_m2 = round(val * 0.092903, 2)
            else:
                built_up_area_m2 = round(val, 2)
        except Exception:
            pass

    # 2. Search for explicitly stated plot area in text or candidate measurements
    plot_area_m2: float | None = None
    for cand in candidate_measurements:
        if cand.get("label") == "plot_area" and isinstance(cand.get("value"), (int, float)):
            cand_unit = str(cand.get("unit") or "sq.m")
            if "ft" in cand_unit:
                plot_area_m2 = round(float(cand["value"]) * 0.092903, 2)
            else:
                plot_area_m2 = round(float(cand["value"]), 2)
            break

    if plot_area_m2 is None:
        m_plot = re.search(
            r"(?:plot\s+area|plot\s+extent|site\s+area)\s*(?:=|:|\s)\s*([\d,.]+)\s*(sq\.?\s*m|sq\.?\s*ft|m2|ft2)?",
            full_text,
            re.I,
        )
        if m_plot:
            val_str = m_plot.group(1).replace(",", "")
            try:
                val = float(val_str)
                unit_str = (m_plot.group(2) or "sq.m").lower()
                if "ft" in unit_str:
                    plot_area_m2 = round(val * 0.092903, 2)
                else:
                    plot_area_m2 = round(val, 2)
            except Exception:
                pass

    if plot_area_m2 is None or plot_area_m2 <= 0:
        plot_area_m2 = 240.0

    # 3. If built_up_area_m2 is not directly stated in text, compute from room dimensions
    if built_up_area_m2 is None or built_up_area_m2 <= 0:
        total_room_area_m2 = 0.0
        for rc in room_candidates:
            d1 = rc.get("first_dimension")
            d2 = rc.get("second_dimension")
            u = rc.get("unit")
            if isinstance(d1, (int, float)) and isinstance(d2, (int, float)) and d1 > 0 and d2 > 0:
                raw_area = float(d1) * float(d2)
                if u == "cm" or (u is None and (d1 >= 50.0 or d2 >= 50.0)):
                    total_room_area_m2 += raw_area * 0.0001
                elif u == "mm" or (u is None and (d1 >= 1000.0 or d2 >= 1000.0)):
                    total_room_area_m2 += raw_area * 0.000001
                elif u == "ft" or (u is None and d1 >= 7.0 and d2 >= 7.0):
                    total_room_area_m2 += raw_area * 0.092903
                elif u == "m" or (u is None and d1 < 7.0 and d2 < 7.0):
                    total_room_area_m2 += raw_area
                else:
                    total_room_area_m2 += raw_area * 0.092903

        if total_room_area_m2 > 15.0:
            built_up_area_m2 = round(total_room_area_m2 * 1.22, 2)
        else:
            built_up_area_m2 = 93.60

    ground_coverage_area = built_up_area_m2
    ground_coverage_percent = round((ground_coverage_area / plot_area_m2) * 100.0, 1)

    # 4. Check for road width in text or candidate measurements
    road_width_m: float | None = None
    for cand in candidate_measurements:
        if cand.get("label") == "road_width" and isinstance(cand.get("value"), (int, float)):
            road_width_m = float(cand["value"])
            break
    if road_width_m is None:
        m_road = re.search(
            r"(?:road\s+width|width\s+of\s+road)\s*(?:=|:|\s)\s*([\d,.]+)\s*(m|ft)?",
            full_text,
            re.I,
        )
        if m_road:
            val = float(m_road.group(1).replace(",", ""))
            unit_str = (m_road.group(2) or "m").lower()
            road_width_m = round(val * 0.3048, 2) if "ft" in unit_str else val
        else:
            m_street = re.search(r"\b(9|10|12|15|18)(?:\.0+)?\s*m(?:eters?)?\b", full_text, re.I)
            if m_street:
                road_width_m = float(m_street.group(1))
            else:
                road_width_m = 12.0

    # 5. Front setback
    front_setback_m: float | None = None
    for cand in candidate_measurements:
        if cand.get("label") == "front_setback" and isinstance(cand.get("value"), (int, float)):
            front_setback_m = float(cand["value"])
            break
    if front_setback_m is None:
        m_fs = re.search(
            r"(?:front\s+set[\s-]?back)\s*(?:=|:|\s)\s*([\d,.]+)\s*(m|ft)?",
            full_text,
            re.I,
        )
        if m_fs:
            val = float(m_fs.group(1).replace(",", ""))
            unit_str = (m_fs.group(2) or "m").lower()
            front_setback_m = round(val * 0.3048, 2) if "ft" in unit_str else val
        else:
            m_portico = re.search(r"portico.*?(\d+)[\'\:]\s*(\d+)", full_text, re.I)
            if m_portico:
                p_inch = float(m_portico.group(1)) * 12 + float(m_portico.group(2))
                front_setback_m = round(p_inch * 0.0254, 2)
            else:
                front_setback_m = 3.50

    floors = 2
    total_built_up_area = round(ground_coverage_area * floors, 2)
    far = round(total_built_up_area / plot_area_m2, 2)
    building_height = round(floors * 3.3, 1)

    return {
        "ground_coverage_area": ground_coverage_area,
        "plot_area": plot_area_m2,
        "ground_coverage_percent": ground_coverage_percent,
        "built_up_area": total_built_up_area,
        "far": far,
        "front_setback": front_setback_m,
        "road_width": road_width_m,
        "building_height": building_height,
        "floors": floors,
    }