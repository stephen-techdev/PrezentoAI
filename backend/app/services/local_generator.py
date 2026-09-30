"""Deterministic local presentation generator.

This is the fallback used when Ollama is not available. It produces
rich, varied, topic-aware presentations from templates — no external
dependencies required.
"""
from __future__ import annotations

import hashlib
import random
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from app.ai.prompts import detect_content
from app.models.schemas import (
    CardItem,
    ComparisonData,
    ComparisonRow,
    Presentation,
    PresentationSettings,
    ProcessStep,
    QuoteData,
    Slide,
    SlideBullet,
    StatItem,
    TableData,
    TimelineItem,
)


STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "of", "in", "on", "for", "to",
    "with", "is", "are", "was", "were", "be", "been", "by", "as", "at",
    "from", "this", "that", "these", "those", "it", "its", "about", "into",
}


# ── Topic analysis ──────────────────────────────────────────────────────────

_TOPIC_KEYWORDS: dict[str, list[str]] = {
    "programming": [
        "c ", "c++", "java", "python", "operator", "array", "string", "pointer",
        "function", "loop", "variable", "data type", "recursion", "sorting",
        "linked list", "stack", "queue", "tree", "graph", "algorithm",
        "compil", "debug", "syntax", "code", "programming", "object-oriented",
    ],
    "ai": [
        "artificial intelligence", "machine learning", "deep learning",
        "neural network", "nlp", "computer vision", "generative ai",
        "chatbot", "llm", "gpt", "transformer", "training model",
    ],
    "cloud": [
        "cloud", "aws", "azure", "gcp", "docker", "kubernetes", "microservice",
        "devops", "ci/cd", "serverless", "saas", "iaas", "paas",
    ],
    "cybersecurity": [
        "cybersecurity", "security", "encryption", "firewall", "malware",
        "phishing", "vulnerability", "penetration", "attack", "threat",
        "authentication", "authorization", "zero trust", "siem",
    ],
    "science": [
        "physics", "chemistry", "biology", "quantum", "molecule", "cell",
        "dna", "energy", "thermodynamic", "reaction", "experiment",
    ],
    "math": [
        "mathematics", "calculus", "algebra", "geometry", "statistics",
        "probability", "theorem", "equation", "matrix", "vector", "integral",
        "derivative", "function",
    ],
    "business": [
        "business", "marketing", "strategy", "startup", "entrepreneur",
        "finance", "investment", "revenue", "market", "brand", "sales",
        "customer", "supply chain", "logistics",
    ],
    "healthcare": [
        "healthcare", "health", "medical", "patient", "disease", "treatment",
        "diagnosis", "hospital", "clinical", "drug", "therapy", "epidemic",
    ],
    "energy": [
        "renewable energy", "solar", "wind", "hydro", "nuclear", "fossil",
        "emission", "carbon", "climate", "sustainab", "green", "photovoltaic",
    ],
    "history": [
        "history", "ancient", "medieval", "revolution", "war", "civilization",
        "empire", "dynasty", "historical", "century", "colonial",
    ],
}


def _detect_category(prompt: str) -> str:
    lower = prompt.lower()
    for category, keywords in _TOPIC_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                return category
    return "general"


# ── Category-specific content ───────────────────────────────────────────────

_CATEGORY_OUTLINES: dict[str, list[str]] = {
    "programming": [
        "Introduction", "Core Concepts", "Syntax and Structure",
        "Key Features", "Working with Data", "Operators and Expressions",
        "Control Flow", "Functions and Modularity", "Practical Examples",
        "Common Pitfalls", "Best Practices", "Summary and Key Takeaways",
    ],
    "ai": [
        "Introduction to AI", "What is Machine Learning", "Types of ML",
        "Neural Networks", "Training and Inference", "Deep Learning",
        "NLP and Language Models", "Computer Vision", "Real-World Applications",
        "Ethics and Bias", "Challenges", "Future of AI",
    ],
    "cloud": [
        "Introduction to Cloud", "Cloud Service Models", "Deployment Models",
        "Key Technologies", "Architecture", "Security",
        "Cost Management", "DevOps and CI/CD", "Microservices",
        "Real-World Use Cases", "Challenges", "Future Trends",
    ],
    "cybersecurity": [
        "Introduction to Cybersecurity", "The Threat Landscape",
        "Types of Attacks", "Authentication and Access Control",
        "Encryption Basics", "Network Security", "Application Security",
        "Security Operations", "Incident Response", "Best Practices",
        "Compliance and Governance", "Future of Security",
    ],
    "science": [
        "Introduction", "Fundamental Principles", "Key Theories",
        "Important Experiments", "Core Mechanisms", "Mathematical Models",
        "Real-World Applications", "Modern Research", "Challenges",
        "Future Directions", "Summary",
    ],
    "math": [
        "Introduction", "Fundamental Definitions", "Key Theorems",
        "Properties and Rules", "Formulas and Equations", "Worked Examples",
        "Proofs and Derivations", "Applications", "Common Mistakes",
        "Advanced Topics", "Summary",
    ],
    "business": [
        "Introduction", "Market Overview", "Business Model",
        "Value Proposition", "Target Market", "Revenue Streams",
        "Competitive Analysis", "Go-to-Market Strategy", "Financial Projections",
        "Risks and Mitigation", "Future Outlook",
    ],
    "healthcare": [
        "Introduction", "Current Landscape", "Key Challenges",
        "Technology in Healthcare", "Data and Analytics", "Patient Care",
        "Treatment and Diagnosis", "Regulatory Environment", "Case Studies",
        "Future Trends", "Summary",
    ],
    "energy": [
        "Introduction to Renewable Energy", "Why Renewable Energy Matters",
        "Solar Energy", "Wind Energy", "Hydroelectric Power",
        "Geothermal and Biomass", "Energy Storage", "Grid Integration",
        "Economic and Environmental Benefits", "Challenges",
        "Future of Renewable Energy", "Summary",
    ],
    "history": [
        "Introduction", "Historical Context", "Key Events",
        "Important Figures", "Turning Points", "Social and Cultural Impact",
        "Economic Consequences", "Long-Term Effects", "Lessons Learned",
        "Modern Relevance", "Summary",
    ],
}


def _get_outline(category: str, count: int, topic: str) -> list[str]:
    base = _CATEGORY_OUTLINES.get(category, [
        "Introduction", "Key Concepts", "How It Works",
        "Important Features", "Applications", "Advantages",
        "Challenges", "Best Practices", "Case Studies",
        "Future Outlook", "Summary",
    ])
    outline: list[str] = []
    for i in range(count):
        if i == 0:
            outline.append(f"Introduction to {_title_case(topic)}")
        elif i == count - 1:
            outline.append("Summary and Key Takeaways")
        else:
            idx = i - 1
            if idx < len(base) - 2:
                outline.append(base[idx + 1])
            else:
                outline.append(f"Deep Dive: {_title_case(topic)} Part {idx - len(base) + 3}")
    return outline


def _uid(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _seed(text: str) -> int:
    h = hashlib.md5(text.encode()).hexdigest()
    return int(h[:8], 16)


def _title_case(s: str) -> str:
    words = s.split()
    return " ".join(
        w.lower() if w.lower() in STOPWORDS else w.capitalize()
        for w in words
    ).capitalize()


def _topic_noun(prompt: str) -> str:
    cleaned = prompt.lower()
    for prefix in ("create a presentation about", "create a presentation on",
                   "make a presentation about", "generate a presentation about",
                   "create", "make", "generate", "build", "design"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
            break
    cleaned = cleaned.rstrip(".?!")
    words = [w for w in cleaned.split() if len(w) > 2]
    return words[-1] if words else cleaned or "this topic"


def _derive_title(prompt: str) -> str:
    cleaned = prompt.strip().rstrip(".?!")
    for prefix in ("Create a presentation about", "Create a presentation on",
                   "Make a presentation about", "Generate a presentation about",
                   "Create", "Make", "Generate", "Build", "Design"):
        if cleaned.lower().startswith(prefix.lower()):
            cleaned = cleaned[len(prefix):].strip()
            break
    return _title_case(cleaned) if cleaned else "Untitled Presentation"


# ── Content templates ───────────────────────────────────────────────────────

_BODY_TEMPLATES = [
    lambda t: f"At its core, {t} rests on a small set of foundational principles that guide every implementation and evaluation.",
    lambda t: f"The practical impact of {t} can be observed across multiple dimensions, from operational efficiency to user experience.",
    lambda t: f"Several key drivers explain the momentum behind {t}: technological maturation, shifting expectations, and demonstrated ROI.",
    lambda t: f"Yet {t} is not without its challenges — implementation gaps and resource constraints continue to slow progress.",
]

_STAT_TEMPLATES = [
    lambda: {"value": "87%", "label": "Adoption Growth", "description": "Year-over-year increase"},
    lambda: {"value": "3.4x", "label": "Productivity Gain", "description": "After twelve months"},
    lambda: {"value": "$2.1T", "label": "Market Value", "description": "Projected by 2030"},
    lambda: {"value": "64%", "label": "Cost Reduction", "description": "Average savings"},
    lambda: {"value": "12M+", "label": "Active Users", "description": "Growing 28% annually"},
    lambda: {"value": "92%", "label": "Satisfaction", "description": "Report positive outcomes"},
]

_TIMELINE_TEMPLATES = [
    lambda t: [
        TimelineItem(id=_uid("tl"), year="2015", title="Early Exploration", description=f"Initial research around {t}."),
        TimelineItem(id=_uid("tl"), year="2018", title="Industry Pilots", description="First enterprise deployments."),
        TimelineItem(id=_uid("tl"), year="2021", title="Mainstream Adoption", description="Widespread uptake begins."),
        TimelineItem(id=_uid("tl"), year="2024", title="Refinement & Scale", description="Focus shifts to optimization."),
        TimelineItem(id=_uid("tl"), year="2027", title="Future Outlook", description="New application domains open."),
    ],
    lambda t: [
        TimelineItem(id=_uid("tl"), year="Phase 1", title="Discovery", description=f"Map the landscape of {t}."),
        TimelineItem(id=_uid("tl"), year="Phase 2", title="Foundation", description="Build core capabilities."),
        TimelineItem(id=_uid("tl"), year="Phase 3", title="Execution", description="Deliver and iterate."),
        TimelineItem(id=_uid("tl"), year="Phase 4", title="Scale", description="Expand successful patterns."),
    ],
]

_PROCESS_TEMPLATES = [
    lambda t: [
        ProcessStep(id=_uid("ps"), step=1, title="Assess", description=f"Evaluate readiness for {t}."),
        ProcessStep(id=_uid("ps"), step=2, title="Design", description="Define target architecture."),
        ProcessStep(id=_uid("ps"), step=3, title="Build", description="Develop with feedback loops."),
        ProcessStep(id=_uid("ps"), step=4, title="Deploy", description="Roll out incrementally."),
        ProcessStep(id=_uid("ps"), step=5, title="Optimize", description="Refine based on data."),
    ],
]

_CARD_TEMPLATES = [
    lambda t: [
        CardItem(id=_uid("cd"), title="Foundations", description=f"Core concepts of {t}.", icon="BookOpen"),
        CardItem(id=_uid("cd"), title="Applications", description="Real-world use cases.", icon="Layers"),
        CardItem(id=_uid("cd"), title="Benefits", description="Tangible outcomes.", icon="TrendingUp"),
        CardItem(id=_uid("cd"), title="Challenges", description="Common pitfalls.", icon="AlertTriangle"),
    ],
    lambda t: [
        CardItem(id=_uid("cd"), title="People", description=f"Skills for {t}.", icon="Users"),
        CardItem(id=_uid("cd"), title="Process", description="Workflows that drive quality.", icon="Workflow"),
        CardItem(id=_uid("cd"), title="Technology", description="Tools that enable scale.", icon="Cpu"),
        CardItem(id=_uid("cd"), title="Measurement", description="KPIs for tracking impact.", icon="BarChart3"),
    ],
]

_COMPARISON_TEMPLATES = [
    lambda: ComparisonData(
        leftTitle="Traditional Approach",
        rightTitle="Modern Approach",
        rows=[
            ComparisonRow(id=_uid("cr"), feature="Setup Time", optionA="Weeks to months", optionB="Hours to days"),
            ComparisonRow(id=_uid("cr"), feature="Cost", optionA="High fixed", optionB="Pay-as-you-go"),
            ComparisonRow(id=_uid("cr"), feature="Scalability", optionA="Manual", optionB="Elastic"),
            ComparisonRow(id=_uid("cr"), feature="Time to Value", optionA="6–12 months", optionB="2–6 weeks"),
        ],
    ),
]

_TABLE_TEMPLATES = [
    lambda: TableData(
        headers=["Dimension", "Current", "Target", "Priority"],
        rows=[
            ["Awareness", "Limited", "Org-wide", "High"],
            ["Tooling", "Fragmented", "Integrated", "High"],
            ["Skills", "Specialized", "Cross-functional", "Medium"],
            ["Governance", "Informal", "Documented", "Medium"],
        ],
    ),
]

_QUOTE_TEMPLATES = [
    lambda: QuoteData(text="The best way to predict the future is to invent it.", author="Alan Kay"),
    lambda: QuoteData(text="Innovation distinguishes between a leader and a follower.", author="Steve Jobs"),
    lambda: QuoteData(text="Simplicity is the ultimate sophistication.", author="Leonardo da Vinci"),
]

_SECTION_LABELS = [
    "Foundations", "Why It Matters", "How It Works", "In Practice",
    "Evidence", "Comparison", "Roadmap", "Challenges", "Opportunities",
]


# ── Slide builders ──────────────────────────────────────────────────────────

def _build_hero(settings: PresentationSettings, topic: str) -> Slide:
    return Slide(
        id=_uid("sl"),
        layout="hero",
        title=settings.title or _derive_title(settings.prompt),
        subtitle=f"An exploration of {topic} — prepared for a {settings.audience} audience.",
        notes=f"Welcome the audience. Introduce the topic. Set expectations for {settings.duration} minutes.",
        accentIcon="Sparkles",
    )


def _build_agenda(topic: str) -> Slide:
    return Slide(
        id=_uid("sl"),
        layout="agenda",
        title="Agenda",
        subtitle="What we will cover today",
        bullets=[
            SlideBullet(id=_uid("bl"), text="Introduction and context"),
            SlideBullet(id=_uid("bl"), text="Key concepts and foundations"),
            SlideBullet(id=_uid("bl"), text="Evidence and examples"),
            SlideBullet(id=_uid("bl"), text="Practical recommendations"),
            SlideBullet(id=_uid("bl"), text="Q&A"),
        ],
        notes="Walk through the agenda briefly. Keep under a minute.",
        accentIcon="ListOrdered",
    )


def _build_section(label: str, idx: int, topic: str) -> Slide:
    return Slide(
        id=_uid("sl"),
        layout="section-divider",
        title=label,
        sectionNumber=str(idx).zfill(2),
        subtitle=f"Continuing our discussion of {topic}.",
        notes="Transition cleanly. Pause briefly.",
        accentIcon="SeparatorHorizontal",
    )


def _build_two_column(topic: str, label: str, idx: int) -> Slide:
    return Slide(
        id=_uid("sl"),
        layout="two-column",
        title=label,
        subtitle="Key concepts at a glance",
        body=_BODY_TEMPLATES[idx % len(_BODY_TEMPLATES)](topic),
        bullets=[
            SlideBullet(id=_uid("bl"), text=f"Definition — what {topic} means in practice."),
            SlideBullet(id=_uid("bl"), text="Foundational principles for implementation."),
            SlideBullet(id=_uid("bl"), text="Common patterns across adopters."),
            SlideBullet(id=_uid("bl"), text="Pitfalls to avoid early on."),
        ],
        notes="Anchor the audience. Define terms. Give one concrete example.",
        accentIcon="Columns2",
    )


def _build_cards(topic: str, idx: int, section_title: str | None = None) -> Slide:
    cards = _CARD_TEMPLATES[idx % len(_CARD_TEMPLATES)](topic)
    title = section_title or _SECTION_LABELS[idx % len(_SECTION_LABELS)]
    return Slide(
        id=_uid("sl"),
        layout="cards",
        title=title,
        subtitle="Four perspectives worth understanding",
        cards=cards,
        notes="Walk through each card. Spend roughly equal time.",
        accentIcon="LayoutGrid",
    )


def _build_statistics(topic: str, idx: int) -> Slide:
    stats = [
        StatItem(id=_uid("st"), **_STAT_TEMPLATES[i % len(_STAT_TEMPLATES)]())
        for i in range(4)
    ]
    return Slide(
        id=_uid("sl"),
        layout="statistics",
        title="By the Numbers",
        subtitle=f"What the data tells us about {topic}",
        stats=stats,
        notes="Anchor each statistic with context.",
        accentIcon="BarChart3",
    )


def _build_timeline(topic: str, idx: int) -> Slide:
    timeline = _TIMELINE_TEMPLATES[idx % len(_TIMELINE_TEMPLATES)](topic)
    return Slide(
        id=_uid("sl"),
        layout="timeline",
        title="Evolution & Milestones",
        subtitle=f"How {topic} arrived at this moment",
        timeline=timeline,
        notes="Show momentum and inflection points.",
        accentIcon="GitCommitHorizontal",
    )


def _build_process(topic: str, idx: int) -> Slide:
    steps = _PROCESS_TEMPLATES[idx % len(_PROCESS_TEMPLATES)](topic)
    return Slide(
        id=_uid("sl"),
        layout="process",
        title="A Practical Roadmap",
        subtitle="From assessment to optimization",
        steps=steps,
        notes="Emphasize that the process is iterative.",
        accentIcon="Workflow",
    )


def _build_comparison(topic: str, idx: int) -> Slide:
    comparison = _COMPARISON_TEMPLATES[idx % len(_COMPARISON_TEMPLATES)]()
    return Slide(
        id=_uid("sl"),
        layout="comparison",
        title="Side by Side",
        subtitle="Contrasting approaches and their trade-offs",
        comparison=comparison,
        notes="Be fair to both sides.",
        accentIcon="Columns2",
    )


def _build_grid(topic: str, idx: int) -> Slide:
    cards = [
        CardItem(id=_uid("cd"), title="Strategy", description="Clear goals, aligned stakeholders.", icon="Target"),
        CardItem(id=_uid("cd"), title="Execution", description="Disciplined delivery.", icon="Zap"),
        CardItem(id=_uid("cd"), title="Culture", description="Curiosity and learning.", icon="Heart"),
        CardItem(id=_uid("cd"), title="Outcomes", description="Measured and reported.", icon="Trophy"),
        CardItem(id=_uid("cd"), title="Risks", description="Identified early.", icon="ShieldAlert"),
        CardItem(id=_uid("cd"), title="Scale", description="Repeatable patterns.", icon="Maximize"),
    ]
    return Slide(
        id=_uid("sl"),
        layout="grid",
        title="Key Dimensions",
        subtitle=f"What makes {topic} efforts succeed",
        cards=cards,
        notes="Give the audience a mental model.",
        accentIcon="LayoutGrid",
    )


def _build_table(topic: str, idx: int) -> Slide:
    table = _TABLE_TEMPLATES[idx % len(_TABLE_TEMPLATES)]()
    return Slide(
        id=_uid("sl"),
        layout="table",
        title="Decision Framework",
        subtitle="A structured way to evaluate options",
        table=table,
        notes="Walk row by row. Highlight the recommended column.",
        accentIcon="Table",
    )


def _build_quote(idx: int) -> Slide:
    quote = _QUOTE_TEMPLATES[idx % len(_QUOTE_TEMPLATES)]()
    return Slide(
        id=_uid("sl"),
        layout="quote",
        title="A Thought to Sit With",
        quote=quote,
        notes="Let the quote breathe. Read it slowly.",
        accentIcon="Quote",
    )


def _build_image_right(topic: str, idx: int, settings: PresentationSettings) -> Slide:
    photos = [
        "https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1200",
        "https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=1200",
        "https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1200",
        "https://images.pexels.com/photos/590016/pexels-photo-590016.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ]
    return Slide(
        id=_uid("sl"),
        layout="image-right",
        title="In the Real World",
        subtitle="Where this meets practice",
        bullets=[
            SlideBullet(id=_uid("bl"), text="Practitioners report measurable gains within the first quarter."),
            SlideBullet(id=_uid("bl"), text="Cross-functional teams outperform siloed efforts."),
            SlideBullet(id=_uid("bl"), text="Documentation and shared learning compound over time."),
        ],
        image={"url": photos[idx % len(photos)], "alt": f"Illustration of {topic}", "source": "Pexels"} if settings.images else None,
        notes="Use the image as a conversation starter.",
        accentIcon="Image",
    )


def _build_chart(topic: str, idx: int) -> Slide:
    return Slide(
        id=_uid("sl"),
        layout="chart",
        title="Growth Trajectory",
        subtitle=f"Projected adoption of {topic}",
        chart={
            "chart_type": "bar",
            "labels": ["2022", "2023", "2024", "2025", "2026"],
            "values": [12, 28, 47, 68, 89],
            "title": "Adoption (%) ",
        },
        notes="Walk through the trend. Highlight the inflection point.",
        accentIcon="BarChart3",
    )


def _build_diagram(topic: str, idx: int) -> Slide:
    return Slide(
        id=_uid("sl"),
        layout="diagram",
        title="How the Pieces Fit",
        subtitle=f"A systems view of {topic}",
        cards=[
            CardItem(id=_uid("cd"), title="Inputs", description="Data, people, resources.", icon="ArrowDownToLine"),
            CardItem(id=_uid("cd"), title="Process", description="Transform, analyze, decide.", icon="Cpu"),
            CardItem(id=_uid("cd"), title="Outputs", description="Insights, products, actions.", icon="ArrowUpFromLine"),
            CardItem(id=_uid("cd"), title="Feedback", description="Measure, learn, iterate.", icon="RefreshCw"),
        ],
        notes="Frame this as a system, not a sequence.",
        accentIcon="Share2",
    )


def _build_thank_you(settings: PresentationSettings) -> Slide:
    return Slide(
        id=_uid("sl"),
        layout="thank-you",
        title="Thank You",
        subtitle="Questions, comments, and discussion welcome.",
        notes="Close confidently. Open the floor for questions.",
        accentIcon="Heart",
    )


def _build_references(topic: str) -> Slide:
    refs = [
        f"Smith, J. (2024). Understanding {_title_case(topic)}. Journal of Applied Innovation, 12(3).",
        f"Lee, R. (2023). Evidence and Adoption in {_title_case(topic)}. Annual Review of Practice, 8(2).",
        "World Economic Forum. (2024). Global Outlook Report.",
        "Gartner. (2025). Hype Cycle Report.",
    ]
    return Slide(
        id=_uid("sl"),
        layout="table",
        title="References",
        subtitle="Selected sources for further reading",
        table=TableData(
            headers=["#", "Source"],
            rows=[[str(i + 1), r] for i, r in enumerate(refs)],
        ),
        notes="Encourage the audience to read at least one source.",
        accentIcon="BookMarked",
    )


# ── Layout planner ─────────────────────────────────────────────────────────

def _plan_layouts(count: int, seed: int) -> list[str]:
    layouts = ["hero", "agenda"]
    middle = [
        "section-divider", "two-column", "cards", "statistics", "process",
        "timeline", "comparison", "grid", "table", "quote", "image-right",
        "two-column", "statistics", "section-divider", "cards", "chart",
    ]
    rng = random.Random(seed)
    rng.shuffle(middle)
    needed = max(0, count - 3)
    for i in range(needed):
        layouts.append(middle[i % len(middle)])
    layouts.append("thank-you")
    while len(layouts) > count:
        layouts.pop(-2)
    while len(layouts) < count:
        layouts.insert(-1, "two-column")
    return layouts[:count]


# ── Main entry ─────────────────────────────────────────────────────────────

def _generate_from_user_content(detection, settings: PresentationSettings):
    """Build slides from user-provided content (Mode 1/3)."""
    slide_count = detection.requested_slide_count or settings.slide_count
    topic = detection.topic or detection.title
    slides: list[dict[str, Any]] = []

    def _hero(title: str, subtitle: str) -> dict[str, Any]:
        return {
            "id": _uid("sl"), "layout": "hero", "title": title,
            "subtitle": subtitle,
            "notes": f"Welcome the audience. Introduce {title}. Set expectations for {settings.duration} minutes.",
            "accentIcon": "Sparkles",
        }

    def _thank_you() -> dict[str, Any]:
        return {
            "id": _uid("sl"), "layout": "thank-you", "title": "Thank You",
            "subtitle": "Questions, comments, and discussion welcome.",
            "notes": "Close confidently. Open the floor for questions.",
            "accentIcon": "Heart",
        }

    # Case 1: explicit slide-by-slide instructions
    if len(detection.slide_instructions) >= 2:
        instructions = detection.slide_instructions
        if len(instructions) == slide_count:
            for i, inst in enumerate(instructions):
                slides.append(_build_user_slide(inst, i, len(instructions), settings))
        elif len(instructions) < slide_count:
            for i, inst in enumerate(instructions):
                slides.append(_build_user_slide(inst, i, slide_count, settings))
            for i in range(len(instructions), slide_count):
                if i == slide_count - 1:
                    slides.append(_thank_you())
                else:
                    slides.append({
                        "id": _uid("sl"), "layout": "section-divider",
                        "title": "Additional Insights",
                        "sectionNumber": str(i + 1).zfill(2),
                        "subtitle": f"Further exploration of {topic}",
                        "notes": "Transition cleanly. Pause briefly.",
                        "accentIcon": "SeparatorHorizontal",
                    })
        else:
            truncated = instructions[:slide_count - 1]
            truncated.append(instructions[-1])
            for i, inst in enumerate(truncated):
                slides.append(_build_user_slide(inst, i, len(truncated), settings))
        return slides

    # Case 2: content points (Include: X, Y, Z)
    if len(detection.content_points) >= 2:
        points = detection.content_points
        slides.append(_hero(topic, f"An exploration of {topic}"))
        slides.append({
            "id": _uid("sl"), "layout": "agenda", "title": "Agenda",
            "subtitle": f"What we will cover in {topic}",
            "bullets": [{"id": _uid("bl"), "text": p} for p in points[:6]],
            "notes": "Walk through the agenda briefly.",
            "accentIcon": "ListOrdered",
        })
        content_count = slide_count - 2
        for i in range(min(len(points), content_count)):
            slides.append(_build_slide_from_point(points[i], i, content_count, topic, settings))
        while len(slides) < slide_count - 1:
            slides.append({
                "id": _uid("sl"), "layout": "section-divider",
                "title": "Further Discussion",
                "sectionNumber": str(len(slides)).zfill(2),
                "subtitle": f"Continuing our discussion of {topic}",
                "notes": "Transition cleanly.",
                "accentIcon": "SeparatorHorizontal",
            })
        if len(slides) < slide_count:
            slides.append(_thank_you())
        while len(slides) > slide_count:
            slides.pop(-2)
        return slides

    # Case 3: long-form content
    sentences = [s.strip() for s in detection.cleaned_prompt.split(".") if len(s.strip()) > 10]
    if len(sentences) >= 3:
        slides.append(_hero(topic, f"An exploration of {topic}"))
        content_count = slide_count - 2
        per_slide = max(1, len(sentences) // content_count)
        for i in range(content_count):
            chunk = sentences[i * per_slide:(i + 1) * per_slide]
            if not chunk:
                break
            text = ". ".join(chunk)
            slides.append({
                "id": _uid("sl"), "layout": "two-column",
                "title": f"Overview of {topic}" if i == 0 else f"Key Points {i + 1}",
                "body": text[:200],
                "bullets": [{"id": _uid("bl"), "text": s} for s in chunk[:4]],
                "notes": f"Discuss the key points about {topic}.",
                "accentIcon": "Columns2",
            })
        slides.append(_thank_you())
        return slides

    # Fallback: not enough structured content
    return _generate_from_user_content_fallback(settings)


def _build_user_slide(inst, index: int, total: int, settings: PresentationSettings) -> dict[str, Any]:
    """Build a single slide from a parsed slide instruction."""
    is_first = index == 0
    is_last = index == total - 1
    title = inst.title
    content = inst.content or ""

    if is_first and re.search(r"intro|overview|welcome|title|agenda", title, re.IGNORECASE):
        if re.search(r"agenda|outline|contents", title, re.IGNORECASE) and content:
            items = [s.strip() for s in re.split(r"[;\n]|,\s*(?=[A-Z])", content) if s.strip()][:6]
            if len(items) >= 2:
                return {
                    "id": _uid("sl"), "layout": "agenda", "title": title,
                    "subtitle": "What we will cover",
                    "bullets": [{"id": _uid("bl"), "text": t} for t in items],
                    "notes": "Walk through the agenda.",
                    "accentIcon": "ListOrdered",
                }
        return {
            "id": _uid("sl"), "layout": "hero", "title": title,
            "subtitle": content or f"An overview prepared for a {settings.audience} audience.",
            "notes": f"Welcome the audience. Introduce {title}.",
            "accentIcon": "Sparkles",
        }

    if is_last and re.search(r"conclu|thank|q&a|summary|closing|final", title, re.IGNORECASE):
        if re.search(r"thank", title, re.IGNORECASE):
            return {
                "id": _uid("sl"), "layout": "thank-you", "title": title,
                "subtitle": content or "Questions, comments, and discussion welcome.",
                "notes": "Close confidently.",
                "accentIcon": "Heart",
            }
        items = [s.strip() for s in re.split(r"[;\n]|,\s*(?=[A-Z])", content) if s.strip()][:4] if content else []
        return {
            "id": _uid("sl"), "layout": "two-column", "title": title,
            "subtitle": "Key takeaways",
            "bullets": [{"id": _uid("bl"), "text": t} for t in items] or [{"id": _uid("bl"), "text": content or "Summary"}],
            "body": content,
            "notes": "Summarize the main points.",
            "accentIcon": "CheckCircle",
        }

    # Comparison
    if re.search(r"vs\.?|versus|compare|comparison|pros.*cons", title + " " + content, re.IGNORECASE):
        parts = [p.strip() for p in re.split(r"\bvs\.?\b|\bversus\b|\bagainst\b", content, flags=re.IGNORECASE) if p.strip()]
        if len(parts) >= 2:
            return {
                "id": _uid("sl"), "layout": "comparison", "title": title,
                "subtitle": "Side by side comparison",
                "comparison": {
                    "leftTitle": parts[0].split(",")[0].strip()[:30] or "Option A",
                    "rightTitle": parts[1].split(",")[0].strip()[:30] or "Option B",
                    "rows": [{"id": _uid("cr"), "feature": "Overview", "optionA": parts[0][:80], "optionB": parts[1][:80]}],
                },
                "notes": "Compare the two approaches.",
                "accentIcon": "Columns2",
            }

    # Statistics
    if re.search(r"statistic|data|metric|number|growth|result|kpi", title, re.IGNORECASE) or re.search(r"\d+%|[$₹€£]\d", content):
        stat_matches = re.findall(r"(\d+\.?\d*%?|[$₹€£]\d+\.?\d*[TBMK]?)[^.;,]*", content)
        if len(stat_matches) >= 2:
            stats = []
            for s in stat_matches[:4]:
                vm = re.match(r"^(\d+\.?\d*%?|[$₹€£]\d+\.?\d*[TBMK]?)", s)
                val = vm.group(1) if vm else s[:10]
                rest = s[len(val):].lstrip(",.;: ").strip()
                stats.append({"id": _uid("st"), "value": val, "label": rest[:40] or "Metric", "description": rest[:80]})
            return {
                "id": _uid("sl"), "layout": "statistics", "title": title,
                "subtitle": content[:100], "stats": stats,
                "notes": "Anchor each statistic with context.",
                "accentIcon": "BarChart3",
            }

    # Default: two-column with bullets
    items = [s.strip() for s in re.split(r"[;\n]|,\s*(?=[A-Z])|\band\b", content) if 2 < len(s.strip()) < 150]
    return {
        "id": _uid("sl"), "layout": "two-column", "title": title,
        "body": content[:200] if len(content) > 100 else content,
        "bullets": [{"id": _uid("bl"), "text": t} for t in items[:5]] or [{"id": _uid("bl"), "text": content or title}],
        "notes": f"Discuss {title}. Elaborate with examples.",
        "accentIcon": "Columns2",
    }


def _build_slide_from_point(point: str, index: int, total: int, topic: str, settings: PresentationSettings) -> dict[str, Any]:
    """Build a content slide from a single content point."""
    parts = [p.strip() for p in re.split(r"[:\-–]", point, maxsplit=1)]
    slide_title = parts[0]
    slide_content = parts[1] if len(parts) > 1 else ""
    is_first = index == 0
    is_last = index == total - 1

    if is_first and re.search(r"intro|overview|what is|definition|background", slide_title, re.IGNORECASE):
        return {
            "id": _uid("sl"), "layout": "hero", "title": topic,
            "subtitle": slide_content or f"An exploration of {topic}",
            "notes": f"Welcome the audience. Introduce {topic}.",
            "accentIcon": "Sparkles",
        }

    if is_last and re.search(r"conclu|summary|thank|closing|final|q&a", slide_title, re.IGNORECASE):
        if re.search(r"thank", slide_title, re.IGNORECASE):
            return {
                "id": _uid("sl"), "layout": "thank-you", "title": slide_title,
                "subtitle": slide_content or "Questions, comments, and discussion welcome.",
                "notes": "Close confidently.",
                "accentIcon": "Heart",
            }
        return {
            "id": _uid("sl"), "layout": "two-column", "title": slide_title,
            "subtitle": "Key takeaways",
            "bullets": [{"id": _uid("bl"), "text": slide_content or f"Summary of {topic}"}],
            "notes": "Summarize the main points.",
            "accentIcon": "CheckCircle",
        }

    items = [s.strip() for s in re.split(r"[;\n]|,\s*(?=[A-Z])|\band\b", slide_content) if 2 < len(s.strip()) < 150]
    return {
        "id": _uid("sl"), "layout": "two-column", "title": slide_title,
        "body": slide_content[:200] if len(slide_content) > 80 else slide_content,
        "bullets": [{"id": _uid("bl"), "text": t} for t in items[:5]] or [{"id": _uid("bl"), "text": slide_content or slide_title}],
        "notes": f"Discuss {slide_title}. Elaborate with examples.",
        "accentIcon": "Columns2",
    }


def _generate_from_user_content_fallback(settings: PresentationSettings):
    """Fallback when user-content mode lacks enough structure — use templates."""
    seed = _seed(settings.prompt + settings.title + str(settings.slide_count))
    topic = _topic_noun(settings.prompt)
    category = _detect_category(settings.prompt)
    layouts = _plan_layouts(settings.slide_count, seed)
    outline = _get_outline(category, settings.slide_count, topic)

    slides: list[Slide] = []
    section_idx = 0

    for i, layout in enumerate(layouts):
        section_title = outline[i] if i < len(outline) else f"Section {i + 1}"
        if layout == "hero":
            slides.append(_build_hero(settings, topic))
        elif layout == "agenda":
            slides.append(_build_agenda(topic))
        elif layout == "section-divider":
            section_idx += 1
            slides.append(_build_section(section_title, section_idx, topic))
        elif layout == "two-column":
            slides.append(_build_two_column(topic, section_title, i))
        elif layout == "cards":
            slides.append(_build_cards(topic, i, section_title))
        elif layout == "statistics":
            slides.append(_build_statistics(topic, i))
        elif layout == "process":
            slides.append(_build_process(topic, i))
        elif layout == "timeline":
            slides.append(_build_timeline(topic, i))
        elif layout == "comparison":
            slides.append(_build_comparison(topic, i))
        elif layout == "grid":
            slides.append(_build_grid(topic, i))
        elif layout == "table":
            slides.append(_build_table(topic, i))
        elif layout == "quote":
            slides.append(_build_quote(i))
        elif layout == "image-right":
            slides.append(_build_image_right(topic, i, settings))
        elif layout == "chart":
            slides.append(_build_chart(topic, i))
        elif layout == "diagram":
            slides.append(_build_diagram(topic, i))
        elif layout == "thank-you":
            slides.append(_build_thank_you(settings))

    if settings.references:
        slides.insert(-1, _build_references(topic))

    now = datetime.now(timezone.utc).isoformat()
    return Presentation(
        id=_uid("pres"),
        settings=settings,
        slides=slides,
        createdAt=now,
        updatedAt=now,
    )


def _enforce_slide_count(presentation: Presentation, target: int) -> Presentation:
    """Ensure the presentation has exactly `target` slides."""
    slides = list(presentation.slides)
    if len(slides) == target:
        return presentation

    if len(slides) < target:
        topic = _topic_noun(presentation.settings.prompt)
        category = _detect_category(presentation.settings.prompt)
        outline = _get_outline(category, target, topic)
        while len(slides) < target:
            idx = len(slides) - 1 if len(slides) > 0 else 0
            section = outline[idx] if idx < len(outline) else f"Additional Insights {len(slides)}"
            extra = _build_two_column(topic, section, len(slides))
            insert_at = len(slides) - 1 if len(slides) > 0 else len(slides)
            slides.insert(insert_at, extra)
    elif len(slides) > target:
        keep_first = 1
        keep_last = 1
        middle = slides[keep_first:-keep_last]
        needed = max(0, target - keep_first - keep_last)
        slides = slides[:keep_first] + middle[:needed] + slides[-keep_last:]

    return Presentation(
        id=presentation.id,
        settings=presentation.settings,
        slides=slides,
        createdAt=presentation.created_at,
        updatedAt=presentation.updated_at,
    )


def _generate_from_multi_topic(topics: list[str], settings: PresentationSettings) -> list[Slide]:
    """Generate one slide per independent topic — no hero, agenda, or thank-you."""
    content_layouts = ["two-column", "cards", "statistics", "process", "timeline",
                       "comparison", "table", "two-column", "cards", "two-column"]
    slides: list[Slide] = []
    for i, topic_str in enumerate(topics):
        layout = content_layouts[i % len(content_layouts)]
        slide = _build_slide_for_topic(topic_str, layout, i, settings)
        slides.append(slide)
    return slides


def _build_slide_for_topic(
    topic: str, layout: str, index: int, settings: PresentationSettings,
) -> Slide:
    """Build a single content slide for an independent topic."""
    if layout == "cards":
        return _build_cards(topic, index, topic)
    if layout == "statistics":
        return _build_statistics(topic, index)
    if layout == "process":
        return _build_process(topic, index)
    if layout == "timeline":
        return _build_timeline(topic, index)
    if layout == "comparison":
        return _build_comparison(topic, index)
    if layout == "table":
        return _build_table(topic, index)
    # Default: two-column with topic-specific content
    return _build_two_column(topic, topic, index)


def generate_local(settings: PresentationSettings) -> Presentation:
    """Generate a complete presentation using local templates.

    Uses content detection: if the user provided actual content, build slides
    from it directly; otherwise use the existing template-based generation.
    """
    detection = detect_content(settings.prompt)

    if detection.mode == "multi-topic":
        slides = _generate_from_multi_topic(detection.multi_topics, settings)
        now = datetime.now(timezone.utc).isoformat()
        return Presentation(
            id=_uid("pres"),
            settings=settings,
            slides=slides,
            createdAt=now,
            updatedAt=now,
        )

    if detection.mode == "user-content":
        slides = _generate_from_user_content(detection, settings)
        now = datetime.now(timezone.utc).isoformat()
        pres = Presentation(
            id=_uid("pres"),
            settings=settings,
            slides=slides,
            createdAt=now,
            updatedAt=now,
        )
    else:
        pres = _generate_from_user_content_fallback(settings)

    return _enforce_slide_count(pres, settings.slide_count)


def rewrite_local(text: str, tone: str) -> str:
    """Local fallback text rewrite."""
    if not text.strip():
        return text
    if tone == "shorten":
        sentences = text.split(". ")
        return ". ".join(sentences[: max(1, len(sentences) // 2)]).strip()
    if tone == "expand":
        return text + " This is supported by consistent evidence across multiple contexts."
    if tone == "simplify":
        swaps = {"utilize": "use", "leverage": "use", "demonstrate": "show", "numerous": "many"}
        out = text
        for old, new in swaps.items():
            out = out.replace(old, new).replace(old.capitalize(), new.capitalize())
        return out
    if tone == "professional":
        return text.replace("kinda", "somewhat").replace("stuff", "materials")
    if tone == "academic":
        return f"Research indicates that {text[0].lower()}{text[1:]}"
    if tone == "business":
        return f"From a strategic perspective, {text[0].lower()}{text[1:]}"
    if tone == "friendly":
        return text.replace("must", "can").replace("therefore", "so")
    # default rewrite
    swaps = {"important": "critical", "help": "support", "use": "leverage", "show": "demonstrate"}
    out = text
    for old, new in swaps.items():
        out = out.replace(old, new).replace(old.capitalize(), new.capitalize())
    return out


def generate_viva_local(topic: str, audience: str, language: str = "English") -> list[dict[str, Any]]:
    """Local fallback viva questions."""
    return [
        {
            "id": _uid("vq"),
            "question": f"What motivated you to choose {topic} as your topic?",
            "answer": f"{_title_case(topic)} is timely and impactful. It affects a wide range of stakeholders and understanding it well positions practitioners to make better decisions.",
            "followUps": ["How does this relate to your experience?", "What surprised you most?"],
        },
        {
            "id": _uid("vq"),
            "question": "Can you summarize the single most important takeaway?",
            "answer": f"The key takeaway is that {topic} rewards disciplined, evidence-based adoption. Organizations that invest in foundations outperform those that focus only on tools.",
            "followUps": ["What evidence supports that?", "How would you measure success?"],
        },
        {
            "id": _uid("vq"),
            "question": f"What are the main challenges associated with {topic}?",
            "answer": "The principal challenges are skills gaps, integration with legacy systems, and sustaining momentum beyond the initial pilot.",
            "followUps": ["How would you prioritize these?", "Which is most underestimated?"],
        },
        {
            "id": _uid("vq"),
            "question": f"How does {topic} compare to alternative approaches?",
            "answer": f"Compared with traditional methods, {topic} offers faster iteration and lower fixed costs. The trade-off is greater complexity in governance.",
            "followUps": ["When would you not recommend this?", "What would change your recommendation?"],
        },
        {
            "id": _uid("vq"),
            "question": f"What are the ethical implications of {topic}?",
            "answer": "Key considerations include fairness, transparency, privacy, and the distribution of benefits. Responsible adoption requires explicit guardrails.",
            "followUps": ["Who should own these guardrails?", "How do we measure ethical impact?"],
        },
        {
            "id": _uid("vq"),
            "question": f"Where do you see {topic} heading in the next five years?",
            "answer": "We expect continued maturation, convergence with adjacent technologies, and a shift from experimentation to operationalization.",
            "followUps": ["What could disrupt that trajectory?", "How should organizations prepare?"],
        },
    ]


def score_local(slides_count: int, layout_variety: int, has_refs: bool, has_notes: bool, has_images: bool) -> dict[str, Any]:
    """Local fallback scoring heuristic."""
    content = min(99, 70 + (12 if slides_count >= 8 else 0) + (6 if has_refs else 0) + (6 if has_notes else 0) + min(layout_variety * 1, 6))
    design = min(99, 72 + min(layout_variety * 2, 14) + (6 if has_images else 0))
    readability = 92
    visual = min(99, 74 + min(layout_variety * 2, 16) + (6 if has_images else 0))
    grammar = 90
    flow = min(99, 76 + (10 if slides_count >= 6 else 0) + (10 if layout_variety >= 5 else 0))
    overall = round(content * 0.25 + design * 0.2 + readability * 0.15 + visual * 0.15 + grammar * 0.1 + flow * 0.15)
    suggestions = []
    if layout_variety < 5:
        suggestions.append("Vary slide layouts more to keep the audience visually engaged.")
    if not has_images:
        suggestions.append("Add relevant images to break up text-heavy sections.")
    if not has_notes:
        suggestions.append("Generate speaker notes to strengthen delivery.")
    if slides_count < 8:
        suggestions.append("Consider adding 1–2 more slides to fully develop the narrative arc.")
    if not has_refs:
        suggestions.append("Include a references slide to add credibility.")
    if not suggestions:
        suggestions.append("Excellent work — this presentation is well-structured and ready to deliver.")
    return {
        "contentQuality": content,
        "design": design,
        "readability": readability,
        "visualBalance": visual,
        "grammar": grammar,
        "flow": flow,
        "overall": overall,
        "suggestions": suggestions,
    }
