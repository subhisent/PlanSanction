import unittest

from calculations import (
    calculate_fsi,
    calculate_plot_coverage_percent,
    convert_area,
    convert_length,
)


class CalculationTests(unittest.TestCase):
    def test_length_conversion(self) -> None:
        self.assertAlmostEqual(convert_length(1000, "mm", "m"), 1.0)
        self.assertAlmostEqual(convert_length(1, "m", "ft"), 3.280839895)

    def test_area_conversion(self) -> None:
        self.assertAlmostEqual(convert_area(1, "sq.m", "sq.ft"), 10.7639104)

    def test_fsi_far(self) -> None:
        self.assertAlmostEqual(calculate_fsi(120, "sq.m", 240, "sq.m"), 0.5)

    def test_plot_coverage(self) -> None:
        self.assertAlmostEqual(
            calculate_plot_coverage_percent(60, "sq.m", 240, "sq.m"), 25.0
        )

    def test_missing_or_invalid_inputs_raise(self) -> None:
        with self.assertRaisesRegex(ValueError, "required"):
            calculate_fsi(None, "sq.m", 240, "sq.m")
        with self.assertRaisesRegex(ValueError, "greater than zero"):
            calculate_fsi(120, "sq.m", 0, "sq.m")
        with self.assertRaisesRegex(ValueError, "compatible"):
            convert_length(1, "m", "sq.m")
        with self.assertRaisesRegex(ValueError, "cannot exceed"):
            calculate_plot_coverage_percent(241, "sq.m", 240, "sq.m")


if __name__ == "__main__":
    unittest.main()
