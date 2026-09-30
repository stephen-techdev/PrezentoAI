"""AI-powered natural language intent parser for presentation editing.

Sends the user's chat message + a compact serialization of the current
presentation context to Ollama and asks for a JSON array of structured edit
actions. Falls back gracefully if Ollama is unavailable.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.ai.client import ollama_client

logger = logging.getLogger("prezento.ai_edit")

SYSTEM_PROMPT = """\
You are an AI presentation editing assistant. You receive a user's natural-language editing request and the current presentation context. You must respond with a JSON object containing an "actions" array and a "message" string.

Each action is a structured edit command. The application validates and executes these actions — you do NOT execute code. Only produce safe, validated edit actions.

Supported action types (use ONLY these):

1. {"type": "change_background", "target": "current|all|<slide_number>", "color": "#hex"} — solid background
2. {"type": "change_background", "target": "...", "gradientFrom": "#hex", "gradientTo": "#hex"} — gradient background
3. {"type": "change_text", "target": "...", "field": "title|subtitle|body|notes", "value": "new text"} — replace text
4. {"type": "change_text_color", "target": "...", "field": "title|subtitle|body|bullets", "color": "#hex"}
5. {"type": "change_font_size", "target": "...", "field": "title|subtitle|body|bullets", "delta": <int>} — positive=bigger, negative=smaller
6. {"type": "change_font_family", "target": "...", "fontFamily": "inter|poppins|roboto|montserrat|lato|opensans|nunito|merriweather|playfair|mono"}
7. {"type": "toggle_bold", "target": "...", "field": "title|subtitle|body|bullets"}
8. {"type": "toggle_italic", "target": "...", "field": "title|subtitle|body|bullets"}
9. {"type": "change_alignment", "target": "...", "align": "left|center|right"}
10. {"type": "change_layout", "target": "...", "layout": "hero|agenda|two-column|comparison|timeline|process|diagram|grid|cards|quote|statistics|image-left|image-right|full-image|section-divider|table|chart|thank-you"}
11. {"type": "add_slide", "afterIndex": <0-based index or omit for current>}
12. {"type": "delete_slide", "index": <0-based>}
13. {"type": "duplicate_slide", "index": <0-based>}
14. {"type": "reorder_slide", "fromIndex": <0-based>, "toIndex": <0-based>}
15. {"type": "apply_theme", "themeId": "modern|minimal|corporate|business|education|dark|creative|gradient|elegant|classic"}
16. {"type": "change_settings", "patch": {"primaryColor": "#hex", "secondaryColor": "#hex", "fontFamily": "...", "background": "white|black|blue|green|purple|gradient|abstract|geometric|glassmorphism|custom"}}
17. {"type": "add_image", "target": "...", "query": "search query for the image"}
18. {"type": "remove_image", "target": "..."}
19. {"type": "change_image_position", "target": "...", "x": <0-1>, "y": <0-1>}
20. {"type": "change_image_size", "target": "...", "w": <0-1>, "h": <0-1>}
21. {"type": "shorten_text", "target": "...", "field": "body|bullets"}
22. {"type": "rewrite_text", "target": "...", "field": "title|subtitle|body|notes", "tone": "rewrite|shorten|expand|simplify|professional|academic|business|friendly", "value": "rewritten text"}
23. {"type": "add_bullet", "target": "...", "text": "bullet text", "position": <0-based index or omit for end>}
24. {"type": "remove_bullet", "target": "...", "index": <0-based>}
25. {"type": "change_bullet", "target": "...", "index": <0-based>, "text": "new text"}
26. {"type": "improve_design", "target": "..."}
27. {"type": "copy_style", "fromIndex": <0-based>, "toIndex": <0-based>}
28. {"type": "change_slide_title", "target": "<slide_number>", "title": "new title"}
29. {"type": "convert_layout", "target": "current|all|<slide_number>", "layout": "table|cards|process|timeline|statistics|comparison|quote|two-column"} — rebuild the slide's bullets/body into a real visual structure (e.g. bullets become table rows, cards, or steps). Prefer this over change_layout when the user says "make/convert/show as a table/cards/timeline".

Target values:
- "current" = the slide the user is currently editing
- "all" = every slide in the presentation
- A number (1-based, e.g. "3" means slide 3) = a specific slide

CRITICAL RULES:
- The user may write in ANY language (Spanish, French, German, Hindi, Tamil, Arabic, etc.). ALWAYS understand the intent regardless of language — never ask them to rewrite in English.
- Do EXACTLY what the user asks. Do NOT make additional changes.
- If the user asks to change ONE thing, produce only ONE action.
- If the user asks for multiple changes, produce multiple actions.
- Preserve everything the user did NOT ask to change.
- If the request is ambiguous and could affect multiple targets, set "message" to a short clarification question and return empty actions array.
- For destructive operations (deleting multiple slides, removing all images), set "needsConfirmation" to true and describe what will happen.
- If you cannot perform the request with the available actions, return empty actions and explain in "message".
- Color names should be converted to hex codes (e.g. "pink" -> "#ec4899", "dark blue" -> "#1e40af", "light blue" -> "#dbeafe").

Respond with ONLY a JSON object, no markdown:
{"actions": [...], "message": "brief confirmation or question", "needsConfirmation": false}
"""


def serialize_context(presentation: dict, current_slide_index: int, selected_element_id: str | None) -> str:
    """Build a compact context string for the AI."""
    slides = presentation.get("slides", [])
    settings = presentation.get("settings", {})

    context = {
        "currentSlideIndex": current_slide_index,
        "totalSlides": len(slides),
        "selectedElementId": selected_element_id,
        "theme": settings.get("theme", "modern"),
        "primaryColor": settings.get("primaryColor", "#06b6d4"),
        "secondaryColor": settings.get("secondaryColor", "#6366f1"),
        "fontFamily": settings.get("fontFamily", "inter"),
        "background": settings.get("background", "white"),
        "slides": [],
    }

    for i, slide in enumerate(slides):
        slide_info = {
            "index": i + 1,
            "layout": slide.get("layout"),
            "title": slide.get("title", ""),
            "subtitle": slide.get("subtitle", ""),
            "body": (slide.get("body", "") or "")[:200],
            "bulletCount": len(slide.get("bullets", []) or []),
            "bullets": [b.get("text", "") for b in (slide.get("bullets", []) or [])][:5],
            "hasImage": bool(slide.get("image") or any(e.get("kind") == "image" for e in (slide.get("elements", []) or []))),
            "hasElements": len(slide.get("elements", []) or []),
            "background": slide.get("background"),
        }
        context["slides"].append(slide_info)

    return json.dumps(context, indent=2)


async def parse_edit_intent(
    message: str,
    presentation: dict,
    current_slide_index: int,
    selected_element_id: str | None,
) -> dict[str, Any]:
    """Parse a natural-language edit request into structured actions.

    Returns: {"actions": [...], "message": "...", "needsConfirmation": bool}
    """
    context_str = serialize_context(presentation, current_slide_index, selected_element_id)

    prompt = f"""User request: {message}

Current presentation context:
{context_str}

Respond with a JSON object containing the edit actions to perform."""

    try:
        result = await ollama_client.generate_json(prompt, system=SYSTEM_PROMPT)
        if isinstance(result, dict) and "actions" in result:
            return {
                "actions": result.get("actions", []),
                "message": result.get("message", "Done."),
                "needsConfirmation": bool(result.get("needsConfirmation", False)),
            }
    except Exception as exc:
        logger.warning("AI intent parsing failed: %s", exc)

    return {"actions": [], "message": "", "needsConfirmation": False}
