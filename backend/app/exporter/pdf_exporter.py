"""PDF export using reportlab.

Renders one landscape page per slide with title, subtitle, and body content.
Keeps formatting close to the on-screen preview.
"""
from __future__ import annotations

import io
from typing import Any

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from app.models.schemas import Presentation, Slide
from app.themes_compat import get_theme, get_font_stack, resolve_background

PAGE_W, PAGE_H = landscape((11 * inch, 8.5 * inch))


def _hex(h: str) -> HexColor:
    return HexColor(h.lstrip("#"))


def export_pdf(presentation: Presentation) -> bytes:
    """Render a Presentation into a PDF and return the bytes."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))

    theme = get_theme(presentation.settings.theme)
    bg = _hex(resolve_background(presentation.settings))
    text_color = _hex(theme["text"])
    muted = _hex(theme["muted"])
    primary = _hex(presentation.settings.primary_color or theme["primary"])
    surface = _hex(theme["surface"])
    heading_font = get_font_stack(theme["headingFont"])
    body_font = get_font_stack(theme["bodyFont"])

    for i, slide in enumerate(presentation.slides):
        if i > 0:
            c.showPage()
        _draw_slide(c, slide, presentation, bg, text_color, muted, primary, surface, heading_font, body_font, i + 1)

    c.save()
    return buf.getvalue()


def _draw_slide(
    c: canvas.Canvas,
    slide: Slide,
    presentation: Presentation,
    bg: HexColor,
    text_color: HexColor,
    muted: HexColor,
    primary: HexColor,
    surface: HexColor,
    heading_font: str,
    body_font: str,
    page_num: int,
) -> None:
    # Background
    c.setFillColor(bg)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Accent bar
    c.setFillColor(primary)
    c.rect(0.5 * inch, PAGE_H - 0.7 * inch, 0.5 * inch, 0.05 * inch, fill=1, stroke=0)

    # Title
    c.setFillColor(text_color)
    c.setFont(heading_font, 28)
    c.drawString(0.5 * inch, PAGE_H - 1.2 * inch, _truncate(slide.title, 70))

    # Subtitle
    if slide.subtitle:
        c.setFillColor(muted)
        c.setFont(body_font, 14)
        c.drawString(0.5 * inch, PAGE_H - 1.6 * inch, _truncate(slide.subtitle, 90))

    # Body
    y = PAGE_H - 2.3 * inch
    layout = slide.layout

    if layout in ("hero", "thank-you"):
        pass

    elif layout == "section-divider":
        if slide.section_number:
            c.setFillColor(primary)
            c.setFont(heading_font, 80)
            c.drawString(0.5 * inch, y - 0.5 * inch, slide.section_number)

    elif layout in ("agenda", "two-column", "image-left", "image-right", "full-image"):
        if slide.body:
            c.setFillColor(text_color)
            c.setFont(body_font, 12)
            _draw_wrapped(c, slide.body, 0.5 * inch, y, 9.0 * inch, 12)
        if slide.bullets:
            c.setFillColor(text_color)
            c.setFont(body_font, 12)
            by = y - (0.4 * inch if slide.body else 0)
            for b in slide.bullets:
                by = _draw_wrapped_ret(c, f"• {b.text}", 0.5 * inch, by, 9.0 * inch, 12)
                by -= 0.12 * inch

    elif layout in ("cards", "grid", "diagram"):
        cards = slide.cards or []
        for j, card in enumerate(cards):
            col = j % 2
            row = j // 2
            x = 0.5 * inch + col * 5.0 * inch
            cy = y - row * 1.5 * inch
            c.setFillColor(surface)
            c.roundRect(x, cy - 1.2 * inch, 4.7 * inch, 1.2 * inch, 0.1 * inch, fill=1, stroke=0)
            c.setFillColor(primary)
            c.setFont(heading_font, 14)
            c.drawString(x + 0.15 * inch, cy - 0.3 * inch, _truncate(card.title, 40))
            c.setFillColor(muted)
            c.setFont(body_font, 10)
            _draw_wrapped(c, card.description, x + 0.15 * inch, cy - 0.6 * inch, 4.4 * inch, 10)

    elif layout == "statistics":
        stats = slide.stats or []
        for j, st in enumerate(stats):
            x = 0.5 * inch + j * 2.5 * inch
            c.setFillColor(primary)
            c.setFont(heading_font, 36)
            c.drawCentredString(x + 1.2 * inch, y, st.value)
            c.setFillColor(text_color)
            c.setFont(body_font, 12)
            c.drawCentredString(x + 1.2 * inch, y - 0.4 * inch, _truncate(st.label, 25))
            if st.description:
                c.setFillColor(muted)
                c.setFont(body_font, 9)
                c.drawCentredString(x + 1.2 * inch, y - 0.7 * inch, _truncate(st.description, 30))

    elif layout == "timeline":
        items = slide.timeline or []
        for j, t in enumerate(items):
            x = 0.5 * inch + j * 2.4 * inch
            c.setFillColor(primary)
            c.setFont(heading_font, 14)
            c.drawString(x, y, t.year)
            c.setFillColor(text_color)
            c.setFont(body_font, 12)
            c.drawString(x, y - 0.3 * inch, _truncate(t.title, 25))
            c.setFillColor(muted)
            c.setFont(body_font, 9)
            _draw_wrapped(c, t.description, x, y - 0.6 * inch, 2.2 * inch, 9)

    elif layout == "process":
        steps = slide.steps or []
        for j, st in enumerate(steps):
            x = 0.5 * inch + j * 2.3 * inch
            c.setFillColor(primary)
            c.setFont(heading_font, 28)
            c.drawString(x, y, str(st.step).zfill(2))
            c.setFillColor(text_color)
            c.setFont(body_font, 12)
            c.drawString(x, y - 0.4 * inch, _truncate(st.title, 25))
            c.setFillColor(muted)
            c.setFont(body_font, 9)
            _draw_wrapped(c, st.description, x, y - 0.7 * inch, 2.1 * inch, 9)

    elif layout == "comparison" and slide.comparison:
        c.setFillColor(text_color)
        c.setFont(body_font, 12)
        c.drawString(0.5 * inch, y, "Feature")
        c.setFillColor(muted)
        c.drawString(4.0 * inch, y, slide.comparison.left_title)
        c.setFillColor(primary)
        c.drawString(7.5 * inch, y, slide.comparison.right_title)
        for j, r in enumerate(slide.comparison.rows):
            ry = y - 0.4 * inch - j * 0.35 * inch
            c.setFillColor(text_color)
            c.drawString(0.5 * inch, ry, _truncate(r.feature, 30))
            c.setFillColor(muted)
            c.drawString(4.0 * inch, ry, _truncate(r.option_a, 30))
            c.setFillColor(primary)
            c.drawString(7.5 * inch, ry, _truncate(r.option_b, 30))

    elif layout == "table" and slide.table:
        headers = slide.table.headers
        rows = slide.table.rows
        col_w = 9.5 * inch / len(headers)
        for j, h in enumerate(headers):
            c.setFillColor(primary)
            c.setFont(body_font, 12)
            c.drawString(0.5 * inch + j * col_w, y, _truncate(h, 20))
        for j, r in enumerate(rows):
            ry = y - 0.35 * inch - j * 0.3 * inch
            for k, cell in enumerate(r):
                c.setFillColor(text_color)
                c.setFont(body_font, 10)
                c.drawString(0.5 * inch + k * col_w, ry, _truncate(cell, 25))

    elif layout == "quote" and slide.quote:
        c.setFillColor(text_color)
        c.setFont(heading_font, 24)
        _draw_wrapped(c, f'"{slide.quote.text}"', 0.5 * inch, y, 9.5 * inch, 24)
        c.setFillColor(muted)
        c.setFont(body_font, 14)
        c.drawString(0.5 * inch, y - 1.5 * inch, f"— {slide.quote.author}")

    elif layout == "chart" and slide.chart:
        labels = slide.chart.labels
        values = slide.chart.values
        max_v = max(values) if values else 1
        bar_w = 9.5 * inch / max(len(values), 1) - 0.1 * inch
        for j, (label, value) in enumerate(zip(labels, values)):
            x = 0.5 * inch + j * (bar_w + 0.1 * inch)
            bar_h = (value / max_v) * 3.0 * inch
            c.setFillColor(primary)
            c.rect(x, y - bar_h, bar_w, bar_h, fill=1, stroke=0)
            c.setFillColor(text_color)
            c.setFont(body_font, 10)
            c.drawCentredString(x + bar_w / 2, y - bar_h - 0.25 * inch, label)
            c.setFillColor(primary)
            c.setFont(body_font, 11)
            c.drawCentredString(x + bar_w / 2, y - bar_h + 0.05 * inch, str(value))

    # Speaker notes → explanations travel with the deck
    if slide.notes:
        c.setFillColor(muted)
        c.setFont(body_font, 9)
        _draw_wrapped(c, f"Notes: {slide.notes}", 0.5 * inch, 1.0 * inch, 9.0 * inch, 9)

    # Page number
    c.setFillColor(muted)
    c.setFont(body_font, 9)
    c.drawRightString(PAGE_W - 0.5 * inch, 0.4 * inch, str(page_num))


def _truncate(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def _draw_wrapped_ret(c: canvas.Canvas, text: str, x: float, y: float, max_w: float, font_size: int) -> float:
    """Draw text wrapped to a max width. Returns the y position after the last line."""
    words = text.split()
    line = ""
    line_y = y
    for word in words:
        test = f"{line} {word}".strip()
        if c.stringWidth(test, c._fontname, font_size) <= max_w:
            line = test
        else:
            c.drawString(x, line_y, line)
            line_y -= font_size * 1.4
            line = word
    if line:
        c.drawString(x, line_y, line)
    return line_y


def _draw_wrapped(c: canvas.Canvas, text: str, x: float, y: float, max_w: float, font_size: int) -> None:
    """Draw text wrapped to a max width."""
    _draw_wrapped_ret(c, text, x, y, max_w, font_size)
