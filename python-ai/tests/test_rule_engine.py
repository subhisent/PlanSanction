import unittest
from pathlib import Path

from rule_engine import (
    evaluate_compliance,
    evaluate_officer_confirmed_compliance,
    load_rule_config,
)


COMPLETE_CONTEXT = {
    "jurisdiction": "Test jurisdiction",
    "local_body": "Test local body",
    "building_use": "Residential",
    "plot_classification": "Test classification",
    "rule_version": "Test rule version",
    "verification_status": "VERIFIED",
}


class RuleEngineTests(unittest.TestCase):
    def test_new_configuration_loads_with_unverified_placeholders(self) -> None:
        config_path = (
            Path(__file__).parents[1]
            / "config"
            / "tamil_nadu_municipality_low_rise_residential.json"
        )
        config = load_rule_config(str(config_path))

        self.assertEqual(
            set(config["context"])
            & {
                "jurisdiction",
                "local_body",
                "building_use",
                "plot_classification",
                "rule_version",
            },
            {
                "jurisdiction",
                "local_body",
                "building_use",
                "plot_classification",
                "rule_version",
            },
        )
        self.assertEqual(len(config["rules"]), 9)
        self.assertTrue(
            all(rule["verification_status"] == "UNVERIFIED"
                for rule in config["rules"].values())
        )
        self.assertTrue(
            all(rule["value"] is None and rule["operator"] is None
                for rule in config["rules"].values())
        )

    def test_missing_required_context_needs_review(self) -> None:
        result = next(
            item
            for item in evaluate_compliance(
                measurements={},
                rules={
                    "fsi_far": {
                        "operator": "max",
                        "value": 1.0,
                        "unit": "ratio",
                        "source": "Test source",
                    }
                },
                context={"jurisdiction": "Test jurisdiction"},
            )
            if item["check"] == "fsi_far"
        )

        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertIn("local_body", result["reason"])

    def test_context_marked_unverified_needs_review(self) -> None:
        result = next(
            item
            for item in evaluate_compliance(
                measurements={"fsi_far": {"value": 1.2, "unit": "ratio"}},
                rules={
                    "fsi_far": {
                        "operator": "max",
                        "value": 1.5,
                        "unit": "ratio",
                        "source": "Test source",
                    }
                },
                context={**COMPLETE_CONTEXT, "verification_status": "UNVERIFIED"},
            )
            if item["check"] == "fsi_far"
        )

        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertIn("unverified", result["reason"])

    def test_unverified_rule_cannot_pass_or_fail(self) -> None:
        result = next(
            item
            for item in evaluate_compliance(
                measurements={"fsi_far": {"value": 3.0, "unit": "ratio"}},
                rules={
                    "fsi_far": {
                        "operator": "max",
                        "value": 1.0,
                        "unit": "ratio",
                        "source": "Unverified test source",
                        "verification_status": "UNVERIFIED",
                    }
                },
                context=COMPLETE_CONTEXT,
            )
            if item["check"] == "fsi_far"
        )

        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertIn("unverified", result["reason"])

    def test_valid_officer_confirmed_measurement_is_accepted(self) -> None:
        checks, errors = evaluate_officer_confirmed_compliance(
            measurements={
                "fsi_far": {
                    "value": 1.2,
                    "unit": "ratio",
                    "confirmed_by": "Municipal officer",
                    "confirmed_at": "2026-10-20T10:00:00Z",
                    "verification_status": "OFFICER_CONFIRMED",
                }
            },
            rules={
                "fsi_far": {
                    "operator": "max",
                    "value": 1.5,
                    "unit": "ratio",
                    "source": "Verified test rule",
                    "verification_status": "VERIFIED",
                }
            },
            context=COMPLETE_CONTEXT,
        )

        result = next(item for item in checks if item["check"] == "fsi_far")
        self.assertEqual(errors, {})
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["measured_value"], 1.2)

    def test_officer_measurement_incompatible_with_rule_unit_needs_review(self) -> None:
        checks, errors = evaluate_officer_confirmed_compliance(
            measurements={
                "fsi_far": {
                    "value": 1.2,
                    "unit": "ratio",
                    "confirmed_by": "Municipal officer",
                    "confirmed_at": "2026-10-20T10:00:00Z",
                    "verification_status": "OFFICER_CONFIRMED",
                }
            },
            rules={
                "fsi_far": {
                    "operator": "max",
                    "value": 1.5,
                    "unit": "m",
                    "source": "Verified test rule",
                    "verification_status": "VERIFIED",
                }
            },
            context=COMPLETE_CONTEXT,
        )

        result = next(item for item in checks if item["check"] == "fsi_far")
        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertIn("incompatible", result["reason"])
        self.assertEqual(errors, {})

    def test_missing_invalid_and_incompatible_officer_measurements_need_review(self) -> None:
        base_measurement = {
            "value": 1.2,
            "unit": "ratio",
            "confirmed_by": "Municipal officer",
            "confirmed_at": "2026-10-20T10:00:00Z",
            "verification_status": "OFFICER_CONFIRMED",
        }
        rules = {
            "fsi_far": {
                "operator": "max",
                "value": 1.5,
                "unit": "ratio",
                "source": "Verified test rule",
                "verification_status": "VERIFIED",
            }
        }

        cases = (
            {},
            {"fsi_far": {**base_measurement, "value": float("nan")}},
            {"fsi_far": {**base_measurement, "unit": "m"}},
            {
                "fsi_far": {
                    key: value
                    for key, value in base_measurement.items()
                    if key != "confirmed_by"
                }
            },
            {
                "fsi_far": {
                    **base_measurement,
                    "verification_status": "OCR_CANDIDATE",
                    "confidence": 99.0,
                }
            },
        )
        for measurements in cases:
            with self.subTest(measurements=measurements):
                checks, errors = evaluate_officer_confirmed_compliance(
                    measurements=measurements,
                    rules=rules,
                    context=COMPLETE_CONTEXT,
                )
                result = next(item for item in checks if item["check"] == "fsi_far")
                self.assertEqual(result["status"], "NEEDS_REVIEW")
                self.assertTrue(result["reason"])
                if measurements:
                    self.assertIn("fsi_far", errors)
                else:
                    self.assertEqual(errors, {})

    def test_configured_rule_passes(self) -> None:
        results = evaluate_compliance(
            measurements={"fsi_far": {"value": 1.2, "unit": "ratio"}},
            rules={
                "fsi_far": {
                    "operator": "max",
                    "value": 1.5,
                    "unit": "ratio",
                    "source": "Verified test rule",
                }
            },
            context=COMPLETE_CONTEXT,
        )
        result = next(item for item in results if item["check"] == "fsi_far")
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["measured_value"], 1.2)
        self.assertEqual(result["rule_source"], "Verified test rule")

    def test_configured_rule_fails(self) -> None:
        results = evaluate_compliance(
            measurements={"fsi_far": {"value": 1.8, "unit": "ratio"}},
            rules={
                "fsi_far": {
                    "operator": "max",
                    "value": 1.5,
                    "unit": "ratio",
                    "source": "Verified test rule",
                }
            },
            context=COMPLETE_CONTEXT,
        )
        result = next(item for item in results if item["check"] == "fsi_far")
        self.assertEqual(result["status"], "FAIL")

    def test_missing_context_measurement_or_rule_needs_review(self) -> None:
        results = evaluate_compliance(
            measurements={},
            rules={
                "fsi_far": {
                    "operator": "max",
                    "value": 1.5,
                    "unit": "ratio",
                    "source": "Verified test rule",
                }
            },
            context={},
        )
        fsi = next(item for item in results if item["check"] == "fsi_far")
        coverage = next(item for item in results if item["check"] == "plot_coverage")
        self.assertEqual(fsi["status"], "NEEDS_REVIEW")
        self.assertIn("jurisdiction", fsi["reason"])
        self.assertEqual(coverage["status"], "NEEDS_REVIEW")

    def test_manual_measurement_needs_review(self) -> None:
        results = evaluate_compliance(
            measurements={
                "fsi_far": {
                    "value": 1.2,
                    "unit": "ratio",
                    "requires_manual_review": True,
                }
            },
            rules={
                "fsi_far": {
                    "operator": "max",
                    "value": 1.5,
                    "unit": "ratio",
                    "source": "Verified test rule",
                }
            },
            context=COMPLETE_CONTEXT,
        )
        result = next(item for item in results if item["check"] == "fsi_far")
        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertEqual(result["measured_value"], 1.2)
        self.assertEqual(result["measured_unit"], "ratio")

    def test_estimated_measurement_needs_review(self) -> None:
        results = evaluate_compliance(
            measurements={
                "fsi_far": {
                    "value": 1.2,
                    "unit": "ratio",
                    "is_estimate": True,
                    "uncertainty": "Verify OCR-reported areas.",
                }
            },
            rules={
                "fsi_far": {
                    "operator": "max",
                    "value": 1.5,
                    "unit": "ratio",
                    "source": "Verified test rule",
                }
            },
            context=COMPLETE_CONTEXT,
        )
        result = next(item for item in results if item["check"] == "fsi_far")
        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertEqual(result["measured_value"], 1.2)
        self.assertEqual(result["uncertainty"], "Verify OCR-reported areas.")


if __name__ == "__main__":
    unittest.main()
