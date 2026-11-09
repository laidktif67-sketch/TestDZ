import sys
import unittest
from pathlib import Path

ICON_DIR = Path(__file__).resolve().parents[1] / "icon"
sys.path.insert(0, str(ICON_DIR))

from svg_safety import validate_svg


class SvgSafetyTests(unittest.TestCase):
    def test_accepts_basic_svg(self):
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1h2"/></svg>'
        self.assertEqual(validate_svg(svg), svg)

    def test_rejects_script_element(self):
        with self.assertRaisesRegex(ValueError, "Unsafe SVG element"):
            validate_svg("<svg><script>alert(1)</script></svg>")

    def test_rejects_event_handler(self):
        with self.assertRaisesRegex(ValueError, "Event handler"):
            validate_svg('<svg><path onload="alert(1)"/></svg>')

    def test_rejects_external_reference(self):
        with self.assertRaisesRegex(ValueError, "External or embedded"):
            validate_svg('<svg><image href="https://example.com/image.png"/></svg>')

    def test_rejects_javascript_url(self):
        with self.assertRaisesRegex(ValueError, "Active or imported"):
            validate_svg('<svg><path fill="url(javascript:alert(1))"/></svg>')

    def test_rejects_external_css_url(self):
        svg = '<svg><style>.icon { fill: url(https://example.com/paint.svg#x); }</style></svg>'
        with self.assertRaisesRegex(ValueError, "External CSS URLs"):
            validate_svg(svg)

    def test_rejects_non_svg_root(self):
        with self.assertRaisesRegex(ValueError, "root element"):
            validate_svg("<html></html>")

    def test_rejects_malformed_xml(self):
        with self.assertRaisesRegex(ValueError, "not valid XML"):
            validate_svg("<svg>")


if __name__ == "__main__":
    unittest.main()
