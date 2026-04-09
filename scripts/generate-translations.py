#!/usr/bin/env python3
"""
Generate locale translation files from messages/en.json using Google Translate (free).

Usage (from repo root):
  pip install deep-translator
  python3 scripts/generate-translations.py                   # all locales
  python3 scripts/generate-translations.py --locale de       # one locale

Output:
  apps/web/messages/{de,ja,fr,es}.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    from deep_translator import GoogleTranslator
except ImportError:
    sys.exit("Error: Install deep-translator first:\n  pip install deep-translator")

MESSAGES_DIR = Path(__file__).parent.parent / "apps" / "web" / "messages"
SOURCE_FILE = MESSAGES_DIR / "en.json"

TARGET_LOCALES: dict[str, str] = {
    "de": "german",
    "ja": "japanese",
    "fr": "french",
    "es": "spanish",
}

# Regex to find {placeholder} patterns (next-intl ICU format)
PLACEHOLDER_RE = re.compile(r"\{[^}]+\}")


def swap_placeholders(text: str) -> tuple[str, list[str]]:
    """Replace {placeholders} with __PLACEHOLDER_0__ etc. so the translator ignores them."""
    placeholders: list[str] = []

    def replace(m: re.Match) -> str:  # type: ignore[type-arg]
        placeholders.append(m.group(0))
        return f"__PLACEHOLDER_{len(placeholders) - 1}__"

    return PLACEHOLDER_RE.sub(replace, text), placeholders


def restore_placeholders(text: str, placeholders: list[str]) -> str:
    for i, ph in enumerate(placeholders):
        text = text.replace(f"__PLACEHOLDER_{i}__", ph)
    return text


def translate_value(value: Any, translator: GoogleTranslator) -> Any:
    """Recursively translate all string leaves in a JSON value."""
    if isinstance(value, dict):
        return {k: translate_value(v, translator) for k, v in value.items()}
    if isinstance(value, list):
        return [translate_value(item, translator) for item in value]
    if isinstance(value, str) and value.strip():
        swapped, placeholders = swap_placeholders(value)
        try:
            translated = translator.translate(swapped)
        except (ConnectionError, TimeoutError, ValueError, RuntimeError) as exc:
            print(f"    Warning: translation failed ({exc}), keeping original")
            return value
        return restore_placeholders(translated or value, placeholders)
    return value


def generate_locale(locale_code: str, target_lang: str) -> None:
    source = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    translator = GoogleTranslator(source="en", target=target_lang)
    result: dict[str, Any] = {}

    print(f"\nTranslating to {target_lang} ({locale_code})...")
    for namespace, value in source.items():
        print(f"  [{namespace}]...", end=" ", flush=True)
        result[namespace] = translate_value(value, translator)
        print("done")

    out_file = MESSAGES_DIR / f"{locale_code}.json"
    out_file.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"  Written: {out_file}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--locale",
        choices=list(TARGET_LOCALES.keys()),
        default=None,
        help="Generate a single locale (default: all)",
    )
    args = parser.parse_args()

    targets = {args.locale: TARGET_LOCALES[args.locale]} if args.locale else TARGET_LOCALES
    for code, lang in targets.items():
        generate_locale(code, lang)

    print("\nDone.")


if __name__ == "__main__":
    main()
