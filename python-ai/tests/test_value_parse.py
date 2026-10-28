import unittest

from value_parse import extract_candidate_measurements


class ValueParseTests(unittest.TestCase):
    @staticmethod
    def _word(text: str, x: int, confidence: float = 95.0) -> dict[str, object]:
        return {
            "text": text,
            "confidence": confidence,
            "bbox": {"x": x, "y": 10, "width": len(text) * 8, "height": 12},
            "block_num": 1,
            "par_num": 1,
            "line_num": 1,
        }

    def test_explicit_area_label_and_bbox_are_preserved(self) -> None:
        page = {
            "page_number": 2,
            "words": [
                self._word("Plot", 0),
                self._word("Area:", 35),
                self._word("240", 80),
                self._word("sq.m", 110),
            ],
        }
        candidates = extract_candidate_measurements([page])
        self.assertEqual(len(candidates), 1)
        candidate = candidates[0]
        self.assertEqual(candidate["label"], "plot_area")
        self.assertEqual(candidate["value"], 240.0)
        self.assertEqual(candidate["unit"], "sq.m")
        self.assertEqual(candidate["source_page"], 2)
        self.assertEqual(candidate["bbox"]["x"], 80)
        self.assertTrue(candidate["is_estimate"])
        self.assertIn("not been independently verified", candidate["uncertainty"])
        self.assertFalse(candidate["requires_manual_review"])

    def test_multiple_values_are_not_assigned_to_a_single_label(self) -> None:
        page = {
            "page_number": 1,
            "words": [
                self._word("Plot", 0),
                self._word("Area", 35),
                self._word("240", 70),
                self._word("sq.m", 95),
                self._word("Floor", 140),
                self._word("Area", 180),
                self._word("120", 220),
                self._word("sq.m", 250),
            ],
        }
        candidates = extract_candidate_measurements([page])
        self.assertEqual(len(candidates), 2)
        self.assertTrue(all(candidate["label"] is None for candidate in candidates))
        self.assertTrue(
            all(candidate["requires_manual_review"] for candidate in candidates)
        )

    def test_label_after_measurement_is_not_associated(self) -> None:
        page = {
            "page_number": 1,
            "words": [
                self._word("240", 0),
                self._word("sq.m", 25),
                self._word("Plot", 70),
                self._word("Area", 105),
            ],
        }
        candidate = extract_candidate_measurements([page])[0]
        self.assertIsNone(candidate["label"])
        self.assertTrue(candidate["requires_manual_review"])

    def test_missing_unit_and_ambiguous_label_are_flagged(self) -> None:
        page = {
            "page_number": 1,
            "words": [
                self._word("Plot", 0),
                self._word("Area", 35),
                self._word("approximately", 80),
                self._word("240", 170),
            ],
        }
        candidate = extract_candidate_measurements([page])[0]
        self.assertIsNone(candidate["label"])
        self.assertIsNone(candidate["unit"])
        self.assertTrue(candidate["requires_manual_review"])
        self.assertTrue(
            any("association is ambiguous" in reason for reason in candidate["review_reasons"])
        )

    def test_low_confidence_and_geometry_labels_need_review(self) -> None:
        page = {
            "page_number": 1,
            "words": [
                self._word("Front", 0, 92),
                self._word("setback:", 42, 92),
                self._word("3", 105, 55),
                self._word("m", 120, 90),
            ],
        }
        candidate = extract_candidate_measurements([page])[0]
        self.assertEqual(candidate["label"], "front_setback")
        self.assertTrue(candidate["requires_manual_review"])
        self.assertGreaterEqual(len(candidate["review_reasons"]), 2)


if __name__ == "__main__":
    unittest.main()
