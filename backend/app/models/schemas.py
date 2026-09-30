"""Pydantic schemas for the PresentGen API."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Slide content models ────────────────────────────────────────────────────

SlideLayout = Literal[
    "hero", "agenda", "two-column", "comparison", "timeline", "process",
    "diagram", "grid", "cards", "quote", "statistics", "image-left",
    "image-right", "full-image", "section-divider", "table", "chart",
    "thank-you",
]


class SlideBullet(BaseModel):
    id: str
    text: str


class TimelineItem(BaseModel):
    id: str
    year: str
    title: str
    description: str


class ProcessStep(BaseModel):
    id: str
    step: int
    title: str
    description: str


class StatItem(BaseModel):
    id: str
    value: str
    label: str
    description: Optional[str] = None


class CardItem(BaseModel):
    id: str
    title: str
    description: str
    icon: Optional[str] = None


class ComparisonRow(BaseModel):
    id: str
    feature: str
    option_a: str = Field(alias="optionA")
    option_b: str = Field(alias="optionB")

    model_config = {"populate_by_name": True, "alias_generator": None}


class ComparisonData(BaseModel):
    left_title: str = Field(alias="leftTitle")
    right_title: str = Field(alias="rightTitle")
    rows: list[ComparisonRow]

    model_config = {"populate_by_name": True}


class TableData(BaseModel):
    headers: list[str]
    rows: list[list[str]]


class ChartData(BaseModel):
    chart_type: Literal["bar", "line", "doughnut", "pie"] = "bar"
    labels: list[str]
    values: list[float]
    title: Optional[str] = None


class QuoteData(BaseModel):
    text: str
    author: str


class SlideImage(BaseModel):
    url: str
    alt: str
    source: Optional[str] = None


class Slide(BaseModel):
    id: str
    layout: SlideLayout
    title: str
    subtitle: Optional[str] = None
    body: Optional[str] = None
    bullets: Optional[list[SlideBullet]] = None
    timeline: Optional[list[TimelineItem]] = None
    steps: Optional[list[ProcessStep]] = None
    stats: Optional[list[StatItem]] = None
    cards: Optional[list[CardItem]] = None
    comparison: Optional[ComparisonData] = None
    table: Optional[TableData] = None
    chart: Optional[ChartData] = None
    quote: Optional[QuoteData] = None
    image: Optional[SlideImage] = None
    section_number: Optional[str] = Field(default=None, alias="sectionNumber")
    notes: Optional[str] = None
    accent_icon: Optional[str] = Field(default=None, alias="accentIcon")

    model_config = {"populate_by_name": True}


# ── Settings ────────────────────────────────────────────────────────────────

ThemeId = Literal[
    "classic", "modern", "minimal", "corporate", "business",
    "education", "dark", "creative", "gradient", "elegant",
]
BackgroundStyle = Literal[
    "white", "black", "blue", "green", "purple", "gradient",
    "abstract", "geometric", "glassmorphism", "custom",
]
FontFamily = Literal[
    "poppins", "inter", "roboto", "montserrat", "lato",
    "opensans", "nunito", "merriweather", "playfair", "mono",
]
IconStyle = Literal["line", "solid", "duotone", "minimal"]
PresentationStyle = Literal["formal", "casual", "persuasive", "informative", "storytelling"]
Audience = Literal["school", "college", "teacher", "business", "investor"]


class PresentationSettings(BaseModel):
    title: str = ""
    prompt: str
    slide_count: int = Field(default=10, alias="slideCount", ge=2, le=50)
    audience: Audience = "college"
    language: str = "English"
    theme: ThemeId = "modern"
    background: BackgroundStyle = "white"
    font_family: FontFamily = Field(default="inter", alias="fontFamily")
    primary_color: str = Field(default="#06b6d4", alias="primaryColor")
    secondary_color: str = Field(default="#6366f1", alias="secondaryColor")
    icon_style: IconStyle = Field(default="line", alias="iconStyle")
    presentation_style: PresentationStyle = Field(default="informative", alias="presentationStyle")
    duration: int = 15
    speaker_notes: bool = Field(default=True, alias="speakerNotes")
    references: bool = True
    images: bool = True
    charts: bool = True
    explain_points: bool = Field(default=True, alias="explainPoints")

    model_config = {"populate_by_name": True}


# ── Presentation ────────────────────────────────────────────────────────────

class Presentation(BaseModel):
    id: str
    settings: PresentationSettings
    slides: list[Slide]
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}


# ── API request/response ────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    settings: PresentationSettings


class GenerateResponse(BaseModel):
    presentation: Presentation


class RewriteRequest(BaseModel):
    text: str
    tone: Literal[
        "rewrite", "shorten", "expand", "simplify",
        "professional", "academic", "business", "friendly",
    ]


class RewriteResponse(BaseModel):
    text: str


class VivaQuestion(BaseModel):
    id: str
    question: str
    answer: str
    follow_ups: list[str] = Field(alias="followUps")

    model_config = {"populate_by_name": True}


class VivaResponse(BaseModel):
    questions: list[VivaQuestion]


class ScoreResponse(BaseModel):
    content_quality: int = Field(alias="contentQuality")
    design: int
    readability: int
    visual_balance: int = Field(alias="visualBalance")
    grammar: int
    flow: int
    overall: int
    suggestions: list[str]

    model_config = {"populate_by_name": True}


class ExportRequest(BaseModel):
    presentation: Presentation
    format: Literal["pptx", "pdf"]


class HealthResponse(BaseModel):
    status: str
    ollama: str
    model: str
    version: str


class EditAction(BaseModel):
    type: str
    target: Optional[str] = None
    field: Optional[str] = None
    value: Optional[Any] = None
    color: Optional[str] = None
    gradientFrom: Optional[str] = None
    gradientTo: Optional[str] = None
    delta: Optional[int] = None
    fontFamily: Optional[str] = None
    align: Optional[str] = None
    layout: Optional[str] = None
    themeId: Optional[str] = None
    patch: Optional[dict] = None
    query: Optional[str] = None
    index: Optional[int] = None
    afterIndex: Optional[int] = None
    fromIndex: Optional[int] = None
    toIndex: Optional[int] = None
    text: Optional[str] = None
    position: Optional[int] = None
    tone: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    w: Optional[float] = None
    h: Optional[float] = None


class EditRequest(BaseModel):
    message: str
    presentation: Presentation
    current_slide_index: int = Field(alias="currentSlideIndex")
    selected_element_id: Optional[str] = Field(default=None, alias="selectedElementId")

    model_config = {"populate_by_name": True}


class EditResponse(BaseModel):
    actions: list[dict]
    message: str
    needs_confirmation: bool = Field(default=False, alias="needsConfirmation")

    model_config = {"populate_by_name": True}
