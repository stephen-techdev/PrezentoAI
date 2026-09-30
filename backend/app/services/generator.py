"""Presentation generation service — Ollama with local fallback."""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from app.ai.client import ollama_client
from app.ai.prompts import (
    SYSTEM_PROMPT,
    build_generation_prompt,
    build_rewrite_prompt,
    build_score_prompt,
    build_viva_prompt,
    detect_content,
)
from app.models.schemas import (
    Presentation,
    PresentationSettings,
    Slide,
    SlideBullet,
    CardItem,
    StatItem,
    TimelineItem,
    ProcessStep,
    ComparisonRow,
    ComparisonData,
    QuoteData,
)
from app.services.local_generator import (
    generate_local,
    generate_viva_local,
    rewrite_local,
    score_local,
)

logger = logging.getLogger("prezento.generator")


async def generate_presentation(settings: PresentationSettings) -> Presentation:
    """Generate a presentation — ARRANGE-ONLY.

    The user's prompt IS the content. No AI search, no Ollama research.
    We only arrange the prompt's slide instructions verbatim via
    generate_local (which parses Slide N blocks, bullets, and style
    directives). Ollama is never called for generation.
    """
    return generate_local(settings)


async def _generate_with_ollama(settings: PresentationSettings) -> Presentation:
    """Call Ollama, validate the structured slide plan, and build slides.

    The LLM returns a content-first plan (slideNumber, title, content[], layout).
    The application — not the LLM — controls slide order, ids, indexes, count,
    and layout validation.
    """
    from app.ai.prompts import SYSTEM_PROMPT, map_layout
    from app.services.local_generator import _enforce_slide_count

    prompt = build_generation_prompt(settings)
    data = await ollama_client.generate_json(prompt, system=SYSTEM_PROMPT)

    if not isinstance(data, dict):
        raise ValueError("Ollama returned no valid JSON object")

    raw_slides = data.get("slides", [])
    if not isinstance(raw_slides, list) or not raw_slides:
        raise ValueError("Ollama returned no slides")

    target_count = settings.slide_count

    # ── Parse and validate each slide plan entry ──
    parsed: list[dict[str, Any]] = []
    for entry in raw_slides:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title", "")).strip()
        if not title:
            continue
        content = entry.get("content", [])
        if not isinstance(content, list):
            content = [str(content)] if content else []
        else:
            content = [str(c).strip() for c in content if str(c).strip()]
        layout_suggestion = entry.get("layout")
        mapped_layout = map_layout(
            str(layout_suggestion) if layout_suggestion else None,
            len(content),
        )
        slide_number = entry.get("slideNumber")
        try:
            slide_number = int(slide_number) if slide_number is not None else None
        except (TypeError, ValueError):
            slide_number = None
        notes = str(entry.get("notes", "")).strip() or None
        parsed.append({
            "slide_number": slide_number,
            "title": title,
            "content": content,
            "layout": mapped_layout,
            "notes": notes,
        })

    if not parsed:
        raise ValueError("No valid slides parsed from Ollama response")

    # ── Reassemble in correct order by slideNumber (stable sort) ──
    # If slideNumber is present, sort by it; otherwise preserve arrival order.
    indexed = list(enumerate(parsed))
    indexed.sort(key=lambda pair: pair[1]["slide_number"] if pair[1]["slide_number"] is not None else pair[0])
    ordered = [p for _, p in indexed]

    # ── Enforce exact slide count ──
    if len(ordered) > target_count:
        ordered = ordered[:target_count]
    # If fewer than requested, pad with section-divider slides before the end
    while len(ordered) < target_count:
        ordered.append({
            "slide_number": len(ordered) + 1,
            "title": f"Additional Insights {len(ordered) + 1}",
            "content": [],
            "layout": "section-divider",
            "notes": None,
        })

    # ── Build Slide objects from the validated plan ──
    slides: list[Slide] = []
    for i, plan in enumerate(ordered, start=1):
        content_items = plan["content"][:5]
        slide = _build_slide_from_plan(i, plan["layout"], plan["title"], content_items, plan["notes"])
        slides.append(slide)

    now = datetime.now(timezone.utc).isoformat()
    pres = Presentation(
        id=f"pres_{uuid.uuid4().hex[:8]}",
        settings=settings,
        slides=slides,
        createdAt=now,
        updatedAt=now,
    )

    return _enforce_slide_count(pres, target_count)


def _build_slide_from_plan(
    slide_num: int,
    layout: str,
    title: str,
    content_items: list[str],
    notes: str | None,
) -> Slide:
    """Build a Slide with layout-appropriate content structures from the content array."""
    slide_id = f"sl_{slide_num}"

    if layout == "cards" and len(content_items) >= 2:
        cards = []
        for j, item in enumerate(content_items[:6]):
            if ":" in item:
                card_title, card_desc = item.split(":", 1)
            else:
                card_title, card_desc = f"Point {j+1}", item
            cards.append(CardItem(
                id=f"cd_{slide_num}_{j+1}",
                title=card_title.strip()[:50],
                description=card_desc.strip(),
            ))
        return Slide(id=slide_id, layout="cards", title=title, cards=cards, notes=notes, accent_icon="LayoutGrid")

    if layout == "statistics" and len(content_items) >= 2:
        stats = []
        for j, item in enumerate(content_items[:4]):
            m = re.match(r"^([\d$€£₹]+[\d.,]*\s*[%TBMK]?|\d+)", item)
            value = m.group(1).strip() if m else f"{j+1}"
            label = item[len(m.group(0)):].strip() if m else item
            label = label.lstrip(": -– ").strip() or f"Metric {j+1}"
            stats.append(StatItem(id=f"st_{slide_num}_{j+1}", value=value, label=label[:40]))
        return Slide(id=slide_id, layout="statistics", title=title, stats=stats, notes=notes, accent_icon="BarChart3")

    if layout == "timeline" and len(content_items) >= 2:
        timeline = []
        for j, item in enumerate(content_items[:5]):
            m = re.match(r"^(\d{4}s?|\w+)\s*[:\-–]\s*(.*)", item)
            year = m.group(1) if m else f"Phase {j+1}"
            rest = m.group(2).strip() if m else item
            parts = rest.split(":", 1)
            t_title = parts[0].strip()[:50] if parts else rest[:50]
            t_desc = parts[1].strip() if len(parts) > 1 else rest
            timeline.append(TimelineItem(id=f"tl_{slide_num}_{j+1}", year=year, title=t_title, description=t_desc[:120]))
        return Slide(id=slide_id, layout="timeline", title=title, timeline=timeline, notes=notes, accent_icon="GitCommitHorizontal")

    if layout == "process" and len(content_items) >= 2:
        steps = [
            ProcessStep(
                id=f"ps_{slide_num}_{j+1}",
                step=j+1,
                title=item.split(":")[0].strip()[:50] if ":" in item else f"Step {j+1}",
                description=item.split(":", 1)[1].strip() if ":" in item else item,
            )
            for j, item in enumerate(content_items[:6])
        ]
        return Slide(id=slide_id, layout="process", title=title, steps=steps, notes=notes, accent_icon="Workflow")

    if layout == "comparison" and len(content_items) >= 2:
        # Split content into two sides
        mid = len(content_items) // 2
        left_items = content_items[:mid] if mid > 0 else [content_items[0]]
        right_items = content_items[mid:] if mid < len(content_items) else [content_items[-1]]
        rows = []
        max_rows = max(len(left_items), len(right_items))
        for j in range(max_rows):
            left = left_items[j] if j < len(left_items) else ""
            right = right_items[j] if j < len(right_items) else ""
            feature = f"Point {j+1}"
            rows.append(ComparisonRow(id=f"cr_{slide_num}_{j+1}", feature=feature, option_a=left, option_b=right))
        comparison = ComparisonData(left_title="Option A", right_title="Option B", rows=rows)
        return Slide(id=slide_id, layout="comparison", title=title, comparison=comparison, notes=notes, accent_icon="Columns2")

    if layout == "quote" and content_items:
        text = content_items[0]
        author = content_items[1] if len(content_items) > 1 else "Unknown"
        quote = QuoteData(text=text, author=author)
        return Slide(id=slide_id, layout="quote", title=title, quote=quote, notes=notes, accent_icon="Quote")

    if layout == "hero":
        subtitle = content_items[0] if content_items else ""
        return Slide(id=slide_id, layout="hero", title=title, subtitle=subtitle, notes=notes, accent_icon="Sparkles")

    if layout == "agenda" and content_items:
        bullets = [SlideBullet(id=f"bl_{slide_num}_{j+1}", text=t) for j, t in enumerate(content_items[:6])]
        return Slide(id=slide_id, layout="agenda", title=title, bullets=bullets, notes=notes, accent_icon="ListOrdered")

    if layout == "thank-you":
        subtitle = content_items[0] if content_items else "Questions and discussion welcome."
        return Slide(id=slide_id, layout="thank-you", title=title, subtitle=subtitle, notes=notes, accent_icon="Heart")

    if layout == "section-divider":
        return Slide(id=slide_id, layout="section-divider", title=title, notes=notes, accent_icon="Minus")

    # Default: two-column with bullets
    bullets = [SlideBullet(id=f"bl_{slide_num}_{j+1}", text=t) for j, t in enumerate(content_items)]
    body = content_items[0] if content_items else ""
    return Slide(id=slide_id, layout="two-column", title=title, body=body, bullets=bullets if bullets else None, notes=notes, accent_icon="BookOpen")


async def rewrite_text(text: str, tone: str) -> str:
    """Rewrite text using Ollama, with local fallback."""
    if await ollama_client.is_available():
        try:
            prompt = build_rewrite_prompt(text, tone)
            data = await ollama_client.generate_json(prompt, system="You rewrite text concisely. Respond with JSON.")
            if isinstance(data, dict) and "text" in data:
                return str(data["text"]).strip()
        except Exception as exc:
            logger.warning("Ollama rewrite failed, using local: %s", exc)
    return rewrite_local(text, tone)


async def generate_viva_questions(presentation: Presentation) -> list[dict[str, Any]]:
    """Generate viva questions for a presentation."""
    topic = presentation.settings.prompt or presentation.settings.title
    if await ollama_client.is_available():
        try:
            prompt = build_viva_prompt(topic, presentation.settings.audience, presentation.settings.language)
            data = await ollama_client.generate_json(prompt, system="You generate viva questions. Respond with JSON.")
            if isinstance(data, dict) and "questions" in data:
                questions = data["questions"]
                for i, q in enumerate(questions, start=1):
                    q.setdefault("id", f"vq_{i}")
                return questions
        except Exception as exc:
            logger.warning("Ollama viva failed, using local: %s", exc)
    return generate_viva_local(topic, presentation.settings.audience, presentation.settings.language)


async def score_presentation(presentation: Presentation) -> dict[str, Any]:
    """Score a presentation using Ollama, with local fallback."""
    slides_count = len(presentation.slides)
    layout_variety = len({s.layout for s in presentation.slides})
    has_refs = presentation.settings.references
    has_notes = presentation.settings.speaker_notes
    has_images = presentation.settings.images

    if await ollama_client.is_available():
        try:
            pres_json = presentation.model_dump_json(by_alias=True)
            prompt = build_score_prompt(pres_json)
            data = await ollama_client.generate_json(prompt, system="You analyze presentations. Respond with JSON.")
            if isinstance(data, dict) and "overall" in data:
                return data
        except Exception as exc:
            logger.warning("Ollama scoring failed, using local: %s", exc)

    return score_local(slides_count, layout_variety, has_refs, has_notes, has_images)
