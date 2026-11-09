"""Validation helpers for generated SVG icon files."""

import re
import xml.etree.ElementTree as ET


def validate_svg(svg_code):
    """Reject malformed SVG and active or externally-referenced content."""
    if re.search(r"<!DOCTYPE|<!ENTITY", svg_code, re.IGNORECASE):
        raise ValueError("SVG declarations and external entities are not allowed")

    try:
        root = ET.fromstring(svg_code)
    except ET.ParseError as exc:
        raise ValueError(f"Generated SVG is not valid XML: {exc}") from exc

    def local_name(value):
        return value.rsplit("}", 1)[-1].lower()

    if local_name(root.tag) != "svg":
        raise ValueError("Generated XML root element must be <svg>")

    blocked_tags = {"script", "foreignobject", "iframe", "object", "embed", "audio", "video"}
    for element in root.iter():
        tag = local_name(element.tag)
        if tag in blocked_tags:
            raise ValueError(f"Unsafe SVG element is not allowed: {tag}")

        for attr_name, attr_value in element.attrib.items():
            attr = local_name(attr_name)
            value = str(attr_value).strip()
            lowered = value.lower()
            if attr.startswith("on"):
                raise ValueError(f"Event handler attribute is not allowed: {attr}")
            if attr in {"href", "src"} and value and not value.startswith("#"):
                raise ValueError("External or embedded SVG references are not allowed")
            if "javascript:" in lowered or "data:text/html" in lowered or "@import" in lowered:
                raise ValueError("Active or imported content is not allowed in SVG")
            for url_value in re.findall(r"url\((.*?)\)", lowered):
                target = url_value.strip().strip("\"'")
                if target and not target.startswith("#"):
                    raise ValueError("External CSS URLs are not allowed in SVG")

        if element.text and ("javascript:" in element.text.lower() or "@import" in element.text.lower()):
            raise ValueError("Active CSS or script text is not allowed in SVG")

    return svg_code
