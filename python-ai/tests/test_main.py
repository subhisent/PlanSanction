import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, UploadFile

from main import analyze, health, root

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class MainApiTests(unittest.TestCase):
    def test_health_endpoints(self) -> None:
        self.assertEqual(root()["status"], "healthy")
        self.assertEqual(health(), {"status": "healthy"})

    def test_analyze_returns_report_and_cleans_temporary_upload(self) -> None:
        temporary_paths: list[Path] = []

        def fake_process_document(path: str) -> list[dict[str, object]]:
            temp_path = Path(path)
            self.assertTrue(temp_path.exists())
            temporary_paths.append(temp_path)
            return [{"page_number": 1, "text": "", "words": []}]

        with (
            patch("main.process_document", side_effect=fake_process_document),
            patch(
                "main.load_rule_config",
                return_value={"context": {}, "rules": {}},
            ),
        ):
            result = analyze(
                UploadFile(filename="plan.png", file=BytesIO(PNG_SIGNATURE))
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["page_count"], 1)
        self.assertIn("manual_review_items", result)
        self.assertTrue(result["manual_review_required"])
        self.assertEqual(len(temporary_paths), 1)
        self.assertFalse(temporary_paths[0].exists())

    def test_unsupported_file_type_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            analyze(UploadFile(filename="plan.txt", file=BytesIO(b"text")))
        self.assertEqual(raised.exception.status_code, 415)
        self.assertIn("Unsupported file type", raised.exception.detail)

    def test_evaluate_compliance_endpoint(self) -> None:
        from main import EvaluateComplianceRequest, evaluate_compliance_endpoint

        request = EvaluateComplianceRequest(
            measurements={
                "front_setback": {
                    "value": 3.5,
                    "unit": "m",
                    "confirmed_by": "OFFICER_1",
                    "confirmed_at": "2026-10-28T09:00:00Z",
                    "verification_status": "OFFICER_CONFIRMED",
                }
            }
        )
        with patch("main.load_rule_config", return_value={"context": {}, "rules": {}}):
            response = evaluate_compliance_endpoint(request)

        self.assertTrue(response["success"])
        self.assertIn("results", response)
        self.assertIn("errors", response)
        self.assertEqual(response["errors"], {})


if __name__ == "__main__":
    unittest.main()
