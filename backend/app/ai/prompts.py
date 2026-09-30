"""Prompt templates for Ollama generation."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from app.models.schemas import PresentationSettings


# ── Content detection ─────────────────────────────────────────────────────────

_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "of", "in", "on", "for", "to",
    "with", "is", "are", "was", "were", "be", "been", "by", "as", "at",
    "from", "this", "that", "these", "those", "it", "its", "about", "into",
}


@dataclass
class SlideInstruction:
    slide_number: int | None
    title: str
    content: str


@dataclass
class ContentDetection:
    mode: str  # "user-content" | "research" | "empty" | "multi-topic"
    topic: str
    title: str
    slide_instructions: list[SlideInstruction] = field(default_factory=list)
    content_points: list[str] = field(default_factory=list)
    multi_topics: list[str] = field(default_factory=list)
    requested_slide_count: int | None = None
    cleaned_prompt: str = ""


def _title_case(s: str) -> str:
    words = s.split()
    return " ".join(
        w.lower() if w.lower() in _STOPWORDS else w.capitalize()
        for w in words
    ).capitalize()


def _strip_boilerplate(prompt: str) -> str:
    prompt = re.sub(
        r"^(create|make|generate|build|design|prepare|write)\s+(a|an|the)?\s*(presentation|slides|deck|slideshow)?\s*(about|on|for|regarding)?\s*",
        "", prompt, flags=re.IGNORECASE
    )
    return prompt.rstrip(".?!").strip()


def _extract_slide_count(prompt: str) -> int | None:
    patterns = [
        r"(\d+)\s*[-–]?\s*slide\s*(presentation|deck|slideshow)?",
        r"(\d+)\s*slides\b",
        r"exactly\s*(\d+)\s*slides?",
    ]
    for p in patterns:
        m = re.search(p, prompt, re.IGNORECASE)
        if m and m.group(1):
            n = int(m.group(1))
            if 0 < n <= 50:
                return n
    return None


def _parse_slide_instructions(text: str) -> list[SlideInstruction]:
    results: list[SlideInstruction] = []
    for m in re.finditer(
        r"slide\s*(\d+)\s*[:\-–]\s*(.*?)(?=slide\s*\d+\s*[:\-–]|$)",
        text, re.IGNORECASE | re.DOTALL,
    ):
        slide_number = int(m.group(1))
        raw = m.group(2).strip()
        lines = [l.strip() for l in re.split(r"\n|\. (?=[A-Z])", raw) if l.strip()]
        title = lines[0].rstrip(".") if lines else raw
        content = ". ".join(lines[1:]).strip() if len(lines) > 1 else ""
        results.append(SlideInstruction(slide_number, title, content))
    return results


def _parse_content_points(text: str) -> list[str]:
    m = re.search(
        r"(?:include|cover|topics|sections|points)\s*[:：]\s*(.*)",
        text, re.IGNORECASE | re.DOTALL,
    )
    list_text = ""
    if m:
        list_text = m.group(1)
    else:
        lines = [l for l in text.split("\n") if l.strip()]
        if len(lines) >= 2:
            list_text = "\n".join(lines[1:])

    if not list_text:
        return []

    items = re.split(r"\n|,|;|\band\b", list_text)
    return [i.strip() for i in items if 1 < len(i.strip()) < 200]


def _count_content_signals(
    prompt: str,
    slide_instructions: list[SlideInstruction],
    content_points: list[str],
) -> int:
    signals = 0
    if len(slide_instructions) >= 2:
        signals += 3
    if len(content_points) >= 2:
        signals += 2
    elif len(content_points) == 1:
        signals += 1
    lines = [l for l in prompt.split("\n") if l.strip()]
    if len(lines) >= 3:
        signals += 2
    elif len(lines) == 2:
        signals += 1
    sentences = [s for s in re.split(r"[.!?]\s+", prompt) if len(s.strip()) > 15]
    if len(sentences) >= 3:
        signals += 2
    elif len(sentences) == 2:
        signals += 1
    if re.search(r"\b(include|cover|discuss|explain|describe|focus on|must have|should contain|need to|talk about|present on)\b", prompt, re.IGNORECASE):
        signals += 1
    colons = len(re.findall(r"[:：]", prompt))
    if colons >= 2:
        signals += 1
    if re.search(r"\b\d+[.):]\s+\w", prompt):
        signals += 1
    word_count = len(prompt.split())
    if word_count > 40:
        signals += 2
    elif word_count > 20:
        signals += 1
    return signals


def _extract_topic(
    cleaned: str,
    slide_instructions: list[SlideInstruction],
    content_points: list[str],
) -> str:
    if slide_instructions:
        idx = re.search(r"slide\s*\d+\s*[:\-–]", cleaned, re.IGNORECASE)
        if idx and idx.start() > 0:
            return cleaned[: idx.start()].rstrip(".,;").strip()
    if content_points:
        idx = re.search(r"(?:include|cover|topics|sections|points)\s*[:：]", cleaned, re.IGNORECASE)
        if idx and idx.start() > 0:
            return cleaned[: idx.start()].rstrip(".,;").strip()
        lines = [l for l in cleaned.split("\n") if l.strip()]
        if len(lines) > 1:
            return lines[0].rstrip(".,;").strip()
    return cleaned


def _detect_multi_topics(text: str) -> list[str]:
    """Detect a multi-topic prompt: a list of independent topics, one per line."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if len(lines) < 2:
        return []
    # Reject if any line looks like a slide instruction
    if any(re.match(r"slide\s*\d+\s*[:\-–]", l, re.IGNORECASE) for l in lines):
        return []
    # Reject if first line is an "Include:" directive
    if re.match(r"^(include|cover|topics|sections|points)\s*[:：]", lines[0], re.IGNORECASE):
        return []

    strip_re = re.compile(r"^\s*(\d+[.):]\s+|[*\-–•]\s+)")

    numbered_re = re.compile(r"^\s*\d+[.):]\s+\S")
    bullet_re = re.compile(r"^\s*[*\-–•]\s+\S")
    numbered_count = sum(1 for l in lines if numbered_re.match(l))
    bullet_count = sum(1 for l in lines if bullet_re.match(l))
    # Require ALL lines to have the same marker type — distinguishes multi-topic
    # (all numbered/bulleted) from main-topic + sub-list (first line unnumbered).
    has_numbered = numbered_count == len(lines)
    has_bullet = bullet_count == len(lines)

    if has_numbered or has_bullet:
        candidates = [strip_re.sub("", l).strip() for l in lines]
    else:
        # Reject if some lines have markers but not all — that's a subtopic pattern
        if numbered_count > 0 or bullet_count > 0:
            return []
        candidates = lines[:]

    verb_starters = re.compile(
        r"^(is|are|was|were|the|this|these|those|that|it|there|in|on|at|for|with|by|to|of|from|when|where|why|how|do|does|did|can|could|should|would|will|has|have|had|please|use|add|create|make|include|ensure|keep|maintain|discuss|explain|describe|focus|talk|present)\b",
        re.IGNORECASE,
    )
    valid = []
    for l in candidates:
        if len(l) < 2 or len(l) > 80:
            continue
        if re.search(r"\.\s*$", l) and len(l.split()) > 6:
            continue
        if verb_starters.match(l) and len(l.split()) > 4:
            continue
        if ":" in l and l.index(":") < 50:
            continue
        valid.append(l)

    if len(valid) < 2:
        return []
    if len(valid) < len(candidates) - 1:
        return []
    return candidates


def detect_content(prompt: str) -> ContentDetection:
    trimmed = prompt.strip()
    if not trimmed:
        return ContentDetection(
            mode="empty", topic="", title="Untitled Presentation",
        )

    cleaned = _strip_boilerplate(trimmed)
    slide_instructions = _parse_slide_instructions(cleaned)
    content_points = _parse_content_points(cleaned)
    requested = _extract_slide_count(trimmed)
    multi_topics = _detect_multi_topics(cleaned)
    topic = _extract_topic(cleaned, slide_instructions, content_points)
    title = _title_case(topic or cleaned)
    signals = _count_content_signals(cleaned, slide_instructions, content_points)

    # Multi-topic mode takes priority: each line is an independent topic = one slide.
    if len(multi_topics) >= 2 and not slide_instructions:
        return ContentDetection(
            mode="multi-topic", topic=topic, title=title,
            multi_topics=multi_topics,
            requested_slide_count=len(multi_topics),
            cleaned_prompt=cleaned,
        )

    mode = "user-content" if signals >= 2 else "research"
    return ContentDetection(
        mode=mode, topic=topic, title=title,
        slide_instructions=slide_instructions,
        content_points=content_points,
        requested_slide_count=requested,
        cleaned_prompt=cleaned,
    )


SYSTEM_PROMPT = (
    "You are PresentGen, an expert presentation designer and subject-matter expert. "
    "You generate well-structured, professional slide decks with REAL, ACCURATE, "
    "TOPIC-SPECIFIC content — never generic filler. You always respond with "
    "valid JSON matching the requested schema. Content is concise, "
    "audience-appropriate, and uses clear language. "
    "CRITICAL: You must generate ALL text content in the language specified "
    "by the user. Do not default to English unless English is the selected language. "
    "NEVER use placeholder text like 'Image placeholder', 'Add image here', "
    "'Insert image', or 'Visual goes here'. If no image is available, create "
    "a strong text-based slide instead."
)


# Structured slide plan schema sent to the LLM. The application controls
# slide order, ids, indexes, and final count — the LLM only proposes content.
_SLIDE_PLAN_SCHEMA: dict[str, Any] = {
    "presentationTitle": "Artificial Intelligence in Healthcare",
    "slides": [
        {
            "slideNumber": 1,
            "title": "Introduction to Artificial Intelligence",
            "content": [
                "Artificial Intelligence enables computers to perform tasks that normally require human intelligence.",
                "AI systems can analyze information, identify patterns, and support decision-making.",
                "AI is increasingly used across healthcare and other industries.",
            ],
            "layout": "title_and_bullets",
            "visualSuggestion": True,
        },
        {
            "slideNumber": 2,
            "title": "Applications in Healthcare",
            "content": [
                "AI can assist doctors in analyzing medical information.",
                "Machine learning can identify patterns in large datasets.",
                "AI can support patient monitoring and personalized care.",
            ],
            "layout": "cards",
            "visualSuggestion": True,
        },
    ],
}

# Map the LLM's free-form layout suggestions to the editor's supported layouts.
# Unsupported suggestions fall back to a safe default based on content shape.
_LAYOUT_MAP: dict[str, str] = {
    "title_and_bullets": "two-column",
    "title-bullets": "two-column",
    "bullets": "two-column",
    "definition": "two-column",
    "explanation": "two-column",
    "two-column": "two-column",
    "two_column": "two-column",
    "twocolumn": "two-column",
    "cards": "cards",
    "card": "cards",
    "grid": "grid",
    "comparison": "comparison",
    "compare": "comparison",
    "versus": "comparison",
    "vs": "comparison",
    "process": "process",
    "steps": "process",
    "workflow": "process",
    "timeline": "timeline",
    "history": "timeline",
    "chronology": "timeline",
    "statistics": "statistics",
    "stats": "statistics",
    "data": "statistics",
    "metrics": "statistics",
    "table": "table",
    "chart": "chart",
    "graph": "chart",
    "quote": "quote",
    "quotation": "quote",
    "summary": "two-column",
    "conclusion": "two-column",
    "hero": "hero",
    "title": "hero",
    "agenda": "agenda",
    "overview": "agenda",
    "thank-you": "thank-you",
    "thankyou": "thank-you",
    "closing": "thank-you",
    "section-divider": "section-divider",
    "divider": "section-divider",
    "image-left": "two-column",
    "image-right": "two-column",
    "full-image": "two-column",
    "image": "two-column",
    "diagram": "diagram",
}

_SAFE_DEFAULT_LAYOUT = "two-column"


def map_layout(suggested: str | None, content_count: int) -> str:
    """Map an LLM layout suggestion to a supported editor layout."""
    if not suggested:
        return _SAFE_DEFAULT_LAYOUT
    key = suggested.strip().lower().replace(" ", "-")
    if key in _LAYOUT_MAP:
        return _LAYOUT_MAP[key]
    # Fuzzy: check if any supported layout is a substring of the suggestion
    for supported in _LAYOUT_MAP.values():
        if supported in key or key in supported:
            return supported
    return _SAFE_DEFAULT_LAYOUT


def build_generation_prompt(settings: PresentationSettings) -> str:
    """Build the prompt that asks Ollama for a structured slide plan as JSON.

    The LLM returns a content-first plan (slideNumber, title, content array,
    layout suggestion). The application — not the LLM — controls slide order,
    ids, indexes, count, and layout validation.
    """
    layout_hint = (
        "title_and_bullets, cards, comparison, process, timeline, "
        "statistics, table, chart, quote, summary, hero, agenda, thank-you"
    )

    # ── Content detection ──
    detection = detect_content(settings.prompt)
    slide_count = detection.requested_slide_count or settings.slide_count

    if detection.mode == "empty":
        return f"""The user provided an empty prompt.

Create a minimal presentation with {slide_count} placeholder slides.
Each slide should have the title "Untitled Slide N" and an empty content array.

Respond with ONLY a JSON object in this exact shape:
{json.dumps(_SLIDE_PLAN_SCHEMA, indent=2)}

The "slides" array must contain exactly {slide_count} slide objects.
"""

    if detection.mode == "multi-topic":
        topics_list = "\n".join(
            f"  {i+1}. {t}" for i, t in enumerate(detection.multi_topics)
        )
        num = len(detection.multi_topics)
        return f"""The user has provided {num} independent topics. Each topic must become EXACTLY ONE slide.

Topics:
{topics_list}

CRITICAL RULES:
1. Generate EXACTLY {num} slides — one per topic. No more, no less.
2. Do NOT add Introduction, Agenda, or Thank You slides unless the user explicitly listed them.
3. Do NOT merge two topics into one slide.
4. Do NOT split one topic into multiple slides.
5. Each slide's slideNumber must match the topic order: topic 1 → slideNumber 1, topic 2 → slideNumber 2, etc.
6. Each slide's title must be the user's topic text (or a professional version of it).
7. Research each topic independently and generate topic-specific content.
8. Each slide must contain DIFFERENT information — no repetition across slides.
9. Content per slide: 3-5 concise bullet points with SPECIFIC FACTS, not generic filler.
10. NEVER use placeholder text like "Image placeholder" or "Add image here".
11. If no image is available, create a strong text-based slide.
12. NEVER use generic filler like "This section covers..." or "This topic is important..."
13. Do NOT repeat the slide title as the slide content.
14. Choose the best layout for each topic's content type from: {layout_hint}.

Settings:
- Audience: {settings.audience}
- Language: {settings.language}
- Style: {settings.presentation_style}
- Duration: {settings.duration} minutes

LANGUAGE REQUIREMENT (CRITICAL): Generate the ENTIRE presentation in {settings.language}.

Respond with ONLY a JSON object in this exact shape (no markdown, no commentary):
{json.dumps(_SLIDE_PLAN_SCHEMA, indent=2)}

The "slides" array must contain exactly {num} slide objects. Each slide must have a unique sequential "slideNumber" from 1 to {num}.
"""

    if detection.mode == "user-content":
        # ── Mode 1/3: user provided content — analyze, structure, and summarize ──
        content_guidance = ""
        if detection.slide_instructions:
            content_guidance = "\n\nThe user has provided explicit slide-by-slide instructions. Treat them as the content source, then reorganize the information into a polished narrative:\n"
            for inst in detection.slide_instructions:
                content_guidance += f"\n  Slide {inst.slide_number or '?'}: {inst.title}"
                if inst.content:
                    content_guidance += f" — {inst.content}"
            content_guidance += "\n\nCRITICAL: Do NOT copy the user's raw prompt text directly onto slides. Instead:\n"
            content_guidance += "- Extract the actual message and key claims\n"
            content_guidance += "- Convert long text into 3-5 sharp bullet points\n"
            content_guidance += "- Create clean slide titles that summarize the point\n"
            content_guidance += "- Keep full explanations in speaker notes\n"
            content_guidance += "- Preserve the user's meaning while improving clarity and flow\n"
        elif detection.content_points:
            content_guidance = f"\n\nThe user has provided specific content points to cover:\n"
            for pt in detection.content_points:
                content_guidance += f"  - {pt}\n"
            content_guidance += "\nTurn these points into a coherent presentation structure, not a pasted list:\n"
            content_guidance += "- Group related ideas into logical slide sections\n"
            content_guidance += "- Summarize each section into a descriptive title\n"
            content_guidance += "- Turn each concept into brief, usable bullets\n"
            content_guidance += "- Place detailed explanations in notes, not on slides\n"
        else:
            content_guidance = "\n\nThe user has provided detailed content. Transform it into a polished presentation with a clear flow:\n"
            content_guidance += "- Identify the main argument, evidence, examples, and conclusion\n"
            content_guidance += "- Organize the content into a logical story: context → key points → action/summary\n"
            content_guidance += "- Break paragraphs into 3-5 concise statements per slide\n"
            content_guidance += "- Use the right slide pattern for the content type\n"
            content_guidance += "- Keep the output well-structured and audience-friendly\n"

        return f"""Create a presentation about: "{detection.topic}"

The user has provided source content. Analyze it, then format it into a polished deck with a clear structure. Do not copy-paste the original wording onto slides.{content_guidance}

CORE DESIGN RULES:
1. First, analyze the prompt and identify the real story: problem, context, key points, examples, and takeaway.
2. Then create a logical slide sequence: opener, overview, core sections, comparison/process if needed, and closing.
3. Never dump raw paragraphs into slides. Convert them into concise, well-designed bullets and summaries.
4. Keep slide content compact and readable: 3-5 bullets max, each bullet short and specific.
5. Use a different layout when the content calls for it. Do not repeat the same layout on every slide.
6. Move detailed explanation, examples, and extra context into speaker notes.
7. Make the slide deck feel authored, not pasted.
8. Use professional, descriptive titles that summarize the meaning, not the raw prompt text.
9. Keep content distinct across slides; avoid repeated wording or redundant points.
10. Never use placeholder text like "Image placeholder", "Add image here", or "Insert image".

QUALITY STANDARDS:
- Each slide should teach one main idea.
- Each bullet should contain a concrete fact, concept, or example.
- Titles should be short, specific, and informative.
- The deck should flow naturally from one slide to the next.
- No generic filler such as "This topic is important" or "Overview of the topic".

SPEAKER NOTES:
Speaker notes should explain how to present the slide, what to emphasize, and how to transition to the next section.

Settings:
- Audience: {settings.audience}
- Number of slides: {slide_count}
- Language: {settings.language}
- Style: {settings.presentation_style}
- Duration: {settings.duration} minutes
- Include speaker notes: {settings.speaker_notes}
- Include references: {settings.references}
- Include images: {settings.images}
- Include charts: {settings.charts}

LANGUAGE REQUIREMENT (CRITICAL): Generate the ENTIRE presentation in {settings.language}.
ALL text — the presentation title, slide titles, subtitles, body text, bullet points,
card descriptions, timeline entries, table cells, chart labels, speaker notes, and
any other generated text — MUST be written in {settings.language}.
Do NOT generate content in English unless English is the selected language.
Do NOT mix languages. If {settings.language} is a non-Latin script language (e.g. Hindi,
Tamil, Arabic, Chinese, Japanese, Korean), use the native script of that language.

Use a variety of layouts from this list: {layout_hint}.
Start with "hero" and end with "thank-you".

Respond with ONLY a JSON object in this exact shape (no markdown, no commentary):
{json.dumps(_SLIDE_PLAN_SCHEMA, indent=2)}

The "slides" array must contain exactly {slide_count} slide objects. Each slide must have a unique sequential "slideNumber" from 1 to {slide_count}.
"""

    # ── Mode 2: topic only — research/generate content from scratch ──
    return f"""Create a presentation about: "{settings.prompt}"

You are building a complete presentation from a single topic. First analyze the prompt to understand the real subject, audience, and learning goal. Then create a structured slide story with a clear flow. Do not copy-paste the user prompt into the slides.

Settings:
- Audience: {settings.audience}
- Number of slides: {slide_count}
- Language: {settings.language}
- Style: {settings.presentation_style}
- Duration: {settings.duration} minutes
- Include speaker notes: {settings.speaker_notes}
- Include references: {settings.references}
- Include images: {settings.images}
- Include charts: {settings.charts}

ANALYSIS AND STRUCTURE PROCESS:
STEP 1 — UNDERSTAND THE TOPIC:
Identify the real subject matter, the main concepts, and what the audience needs to learn.

STEP 2 — PLAN THE STORY:
Build a logical sequence before writing slide content. Decide which slides should explain the idea,
show context, compare alternatives, examine steps, present supporting evidence, and end with a clear takeaway.

STEP 3 — WRITE STRATEGICALLY:
Turn each section into concise, useful slide content. Use detailed information in speaker notes rather than forcing everything onto the slide.

CONTENT RULES (CRITICAL):
1. Do not copy-paste the prompt or repeat it verbatim.
2. Do not use generic filler such as "This section provides an overview" or "This is an important topic".
3. Every bullet must contain real substance: a fact, definition, example, comparison, or explanation.
4. Slide titles must be specific and descriptive, not generic labels.
5. Each slide must focus on one clear idea.
6. No two slides should repeat the same idea.
7. Keep the deck varied: overview, key concepts, processes, comparison, data, applications, and conclusion where appropriate.
8. Never use placeholder text like "Image placeholder", "Add image here", "Insert image", or "Visual goes here".
9. Generate exactly {slide_count} slides.

SPEAKER NOTES RULES:
Speaker notes should explain how to present the content, emphasize the point, and connect the slide to the next topic.

LAYOUT SELECTION:
Use a variety of layouts from this list: {layout_hint}.
Do NOT make every slide the same layout. Start with "hero" and end with "thank-you".
Match the layout to the content type.

LANGUAGE REQUIREMENT (CRITICAL): Generate the ENTIRE presentation in {settings.language}.
ALL text — the presentation title, slide titles, subtitles, body text, bullet points,
card descriptions, timeline entries, table cells, chart labels, speaker notes, and
any other generated text — MUST be written in {settings.language}.
Do NOT generate content in English unless English is the selected language.
Do NOT mix languages. If {settings.language} is a non-Latin script language (e.g. Hindi,
Tamil, Arabic, Chinese, Japanese, Korean), use the native script of that language.

Respond with ONLY a JSON object in this exact shape (no markdown, no commentary):
{json.dumps(_SLIDE_PLAN_SCHEMA, indent=2)}

The "slides" array must contain exactly {slide_count} slide objects. Each slide must have a unique sequential "slideNumber" from 1 to {slide_count}.
"""


def build_rewrite_prompt(text: str, tone: str) -> str:
    """Build a prompt for rewriting a single piece of text."""
    instructions = {
        "rewrite": "Rewrite the following text in a clearer, more engaging way. Keep the same meaning.",
        "shorten": "Shorten the following text to roughly half its length while keeping the key point.",
        "expand": "Expand the following text with one or two supporting sentences.",
        "simplify": "Simplify the following text. Use plain words and short sentences.",
        "professional": "Rewrite the following text in a professional, polished tone.",
        "academic": "Rewrite the following text in an academic, formal tone suitable for a thesis.",
        "business": "Rewrite the following text in a business-strategic tone.",
        "friendly": "Rewrite the following text in a warm, friendly, conversational tone.",
    }
    instruction = instructions.get(tone, instructions["rewrite"])
    return f"{instruction}\n\nText:\n{text}\n\nRespond with ONLY a JSON object: {{\"text\": \"...\"}}"


def build_viva_prompt(topic: str, audience: str, language: str = "English") -> str:
    """Build a prompt for generating viva/defense questions."""
    return f"""You are preparing a student for a viva/defense on the topic: "{topic}".
The audience is: {audience}.

LANGUAGE REQUIREMENT: Generate ALL questions, answers, and follow-up questions in {language}.
Do NOT use English unless English is the selected language.

Generate 6 likely viva questions. For each, provide:
- question: the question
- answer: a strong 2-3 sentence answer
- followUps: 2 short follow-up questions

Respond with ONLY a JSON object: {{"questions": [{{"id":"vq_1","question":"...","answer":"...","followUps":["...","..."]}}]}}
"""


def build_score_prompt(presentation_json: str) -> str:
    """Build a prompt for scoring a presentation."""
    return f"""Analyze this presentation and score it from 0-100 on each dimension:
- contentQuality
- design
- readability
- visualBalance
- grammar
- flow
- overall (weighted average)

Also provide 3-5 specific, actionable suggestions for improvement.

Presentation:
{presentation_json}

Respond with ONLY a JSON object:
{{"contentQuality":85,"design":80,"readability":90,"visualBalance":75,"grammar":95,"flow":82,"overall":84,"suggestions":["...","..."]}}
"""
