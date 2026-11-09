import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

CIP_DIR = Path(__file__).resolve().parents[1] / "cip"
sys.path.insert(0, str(CIP_DIR))
MODULE_SPEC = importlib.util.spec_from_file_location("cip_render_html", CIP_DIR / "render-html.py")
cip_render_html = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(cip_render_html)


class CipHtmlSecurityTests(unittest.TestCase):
    def test_escapes_untrusted_brand_text(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "business-card.png").write_bytes(b"mock image bytes")
            output = root / "presentation.html"

            cip_render_html.generate_html(
                brand_name="<script>alert(1)</script>",
                industry="technology",
                images_dir=root,
                output_path=output,
            )

            html = output.read_text(encoding="utf-8")
            self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", html)
            self.assertNotIn("<script>alert(1)</script>", html)

    def test_escapes_attribute_values(self):
        self.assertEqual(
            cip_render_html.html_escape('" onload="alert(1)', quote=True),
            "&quot; onload=&quot;alert(1)",
        )


if __name__ == "__main__":
    unittest.main()
