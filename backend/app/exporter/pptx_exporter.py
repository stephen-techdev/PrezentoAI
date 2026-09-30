"""PPTX export using python-pptx."""
from __future__ import annotations

import io
from typing import Any

from pptx import Presentation as PptxPresentation
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_AUTO_SIZE, PP_ALIGN
from pptx.util import Inches, Pt, Emu

from app.models.schemas import Presentation, Slide
from app.themes_compat import get_theme, get_font_stack


_SLIDE_W = Inches(13.333)
_SLIDE_H = Inches(7.5)


def _hex_to_rgb(hex_str: str) -> RGBColor:
    h = hex_str.lstrip("#")
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def export_pptx(presentation: Presentation) -> bytes:
    """Render a Presentation into a .pptx file and return the bytes."""
    prs = PptxPresentation()
    prs.slide_width = _SLIDE_W
    prs.slide_height = _SLIDE_H

    theme = get_theme(presentation.settings.theme)
    bg_color = _hex_to_rgb(theme["background"])
    text_color = _hex_to_rgb(theme["text"])
    primary_color = _hex_to_rgb(presentation.settings.primary_color or theme["primary"])
    muted_color = _hex_to_rgb(theme["muted"])
    surface_color = _hex_to_rgb(theme["surface"])
    heading_font = get_font_stack(theme["headingFont"])
    body_font = get_font_stack(theme["bodyFont"])

    blank_layout = prs.slide_layouts[6]  # blank

    for slide in presentation.slides:
        s = prs.slides.add_slide(blank_layout)
        # Background
        s.background.fill.solid()
        s.background.fill.fore_color.rgb = bg_color

        # Accent bar
        _add_rect(s, Inches(0.5), Inches(0.4), Inches(0.5), Inches(0.04), primary_color)

        # Title
        _add_text(
            s, Inches(0.5), Inches(0.55), Inches(12.3), Inches(1.0),
            slide.title, size=Pt(32), bold=True, color=text_color, font=heading_font,
        )

        # Subtitle
        if slide.subtitle:
            _add_text(
                s, Inches(0.5), Inches(1.55), Inches(12.3), Inches(0.5),
                slide.subtitle, size=Pt(16), color=muted_color, font=body_font,
            )

        # Body content
        _render_slide_body(s, slide, presentation, text_color, muted_color, primary_color, surface_color, body_font, heading_font)

        # Speaker notes → explanations travel with the deck (presenter view)
        if slide.notes:
            try:
                notes_slide = s.notes_slide
                notes_slide.placeholders[1].text = slide.notes
            except Exception:
                pass

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def _render_slide_body(
    s: Any,
    slide: Slide,
    presentation: Presentation,
    text_color: RGBColor,
    muted_color: RGBColor,
    primary_color: RGBColor,
    surface_color: RGBColor,
    body_font: str,
    heading_font: str,
) -> None:
    layout = slide.layout
    y = Inches(2.4)

    if layout in ("hero", "thank-you"):
        return

    if layout == "section-divider":
        if slide.section_number:
            _add_text(
                s, Inches(0.5), Inches(3.0), Inches(6.0), Inches(2.0),
                slide.section_number, size=Pt(96), bold=True, color=primary_color, font=heading_font,
            )
        return

    if layout in ("agenda", "two-column", "image-left", "image-right", "full-image"):
        if slide.body:
            _add_text(s, Inches(0.5), y, Inches(6.0), Inches(2.0), slide.body, size=Pt(14), color=text_color, font=body_font)
        if slide.bullets:
            bullets_text = "\n".join(f"• {b.text}" for b in slide.bullets)
            _add_text(s, Inches(6.8), y, Inches(6.0), Inches(4.0), bullets_text, size=Pt(14), color=text_color, font=body_font)
        return

    if layout in ("cards", "grid", "diagram"):
        cards = slide.cards or []
        for i, c in enumerate(cards):
            col = i % 2
            row = i // 2
            x = Inches(0.5 + col * 6.3)
            cy = y + Inches(row * 1.7)
            _add_rect(s, x, cy, Inches(6.0), Inches(1.5), surface_color)
            _add_text(s, x + Inches(0.2), cy + Inches(0.15), Inches(5.6), Inches(0.4),
                      c.title, size=Pt(18), bold=True, color=primary_color, font=heading_font)
            _add_text(s, x + Inches(0.2), cy + Inches(0.6), Inches(5.6), Inches(0.8),
                      c.description, size=Pt(12), color=muted_color, font=body_font)
        return

    if layout == "statistics":
        stats = slide.stats or []
        for i, st in enumerate(stats):
            x = Inches(0.5 + i * 3.1)
            _add_text(s, x, y, Inches(3.0), Inches(1.0), st.value, size=Pt(40), bold=True, color=primary_color, font=heading_font, align=PP_ALIGN.CENTER)
            _add_text(s, x, y + Inches(1.1), Inches(3.0), Inches(0.4), st.label, size=Pt(14), bold=True, color=text_color, font=body_font, align=PP_ALIGN.CENTER)
            if st.description:
                _add_text(s, x, y + Inches(1.6), Inches(3.0), Inches(0.4), st.description, size=Pt(11), color=muted_color, font=body_font, align=PP_ALIGN.CENTER)
        return

    if layout == "timeline":
        items = slide.timeline or []
        for i, t in enumerate(items):
            x = Inches(0.5 + i * 2.5)
            _add_text(s, x, y, Inches(2.3), Inches(0.4), t.year, size=Pt(16), bold=True, color=primary_color, font=heading_font)
            _add_text(s, x, y + Inches(0.5), Inches(2.3), Inches(0.4), t.title, size=Pt(14), bold=True, color=text_color, font=body_font)
            _add_text(s, x, y + Inches(1.0), Inches(2.3), Inches(1.5), t.description, size=Pt(11), color=muted_color, font=body_font)
        return

    if layout == "process":
        steps = slide.steps or []
        for i, st in enumerate(steps):
            x = Inches(0.5 + i * 2.4)
            _add_text(s, x, y, Inches(2.2), Inches(0.6), str(st.step).zfill(2), size=Pt(36), bold=True, color=primary_color, font=heading_font)
            _add_text(s, x, y + Inches(0.7), Inches(2.2), Inches(0.4), st.title, size=Pt(14), bold=True, color=text_color, font=body_font)
            _add_text(s, x, y + Inches(1.2), Inches(2.2), Inches(1.5), st.description, size=Pt(11), color=muted_color, font=body_font)
        return

    if layout == "comparison" and slide.comparison:
        rows = slide.comparison.rows
        _add_text(s, Inches(0.5), y, Inches(3.5), Inches(0.5), "Feature", size=Pt(14), bold=True, color=text_color, font=body_font)
        _add_text(s, Inches(4.3), y, Inches(3.5), Inches(0.5), slide.comparison.left_title, size=Pt(14), bold=True, color=muted_color, font=body_font)
        _add_text(s, Inches(8.1), y, Inches(3.5), Inches(0.5), slide.comparison.right_title, size=Pt(14), bold=True, color=primary_color, font=body_font)
        for i, r in enumerate(rows):
            ry = y + Inches(0.6 + i * 0.5)
            _add_text(s, Inches(0.5), ry, Inches(3.5), Inches(0.4), r.feature, size=Pt(12), color=text_color, font=body_font)
            _add_text(s, Inches(4.3), ry, Inches(3.5), Inches(0.4), r.option_a, size=Pt(12), color=muted_color, font=body_font)
            _add_text(s, Inches(8.1), ry, Inches(3.5), Inches(0.4), r.option_b, size=Pt(12), color=primary_color, font=body_font)
        return

    if layout == "table" and slide.table:
        headers = slide.table.headers
        rows = slide.table.rows
        col_w = Inches(12.3 / len(headers))
        for i, h in enumerate(headers):
            _add_text(s, Inches(0.5 + i * (12.3 / len(headers))), y, col_w, Inches(0.5),
                      h, size=Pt(14), bold=True, color=primary_color, font=body_font)
        for i, r in enumerate(rows):
            for j, c in enumerate(r):
                _add_text(s, Inches(0.5 + j * (12.3 / len(headers))), y + Inches(0.6 + i * 0.5), col_w, Inches(0.4),
                          c, size=Pt(12), color=text_color, font=body_font)
        return

    if layout == "quote" and slide.quote:
        _add_text(s, Inches(0.5), y, Inches(12.3), Inches(2.5),
                  f'"{slide.quote.text}"', size=Pt(32), italic=True, color=text_color, font=heading_font)
        _add_text(s, Inches(0.5), y + Inches(2.7), Inches(12.3), Inches(0.5),
                  f"— {slide.quote.author}", size=Pt(16), color=muted_color, font=body_font)
        return

    if layout == "chart" and slide.chart:
        # Render chart as a simple table of values (python-pptx has no native chart here)
        labels = slide.chart.labels
        values = slide.chart.values
        rows_text = "\n".join(f"{l}: {v}" for l, v in zip(labels, values))
        _add_text(s, Inches(0.5), y, Inches(12.3), Inches(3.0),
                  rows_text, size=Pt(14), color=text_color, font=body_font)
        return


def _add_text(
    s: Any,
    x: Emu, y: Emu, cx: Emu, cy: Emu,
    text: str,
    size: Pt = Pt(14),
    bold: bool = False,
    italic: bool = False,
    color: RGBColor | None = None,
    font: str | None = None,
    align: PP_ALIGN = PP_ALIGN.LEFT,
) -> None:
    box = s.shapes.add_textbox(x, y, cx, cy)
    tf = box.text_frame
    tf.word_wrap = True
    # Shrink text to fit instead of clipping it visually in PowerPoint
    tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    lines = text.split("\n")
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        run.text = line
        run.font.size = size
        run.font.bold = bold
        run.font.italic = italic
        if color:
            run.font.color.rgb = color
        if font:
            run.font.name = font


def _add_rect(s: Any, x: Emu, y: Emu, cx: Emu, cy: Emu, color: RGBColor) -> None:
    shape = s.shapes.add_shape(1, x, y, cx, cy)  # MSO_SHAPE.RECTANGLE = 1
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
