"""Theme compatibility layer — mirrors the frontend theme definitions."""
from __future__ import annotations

from app.models.schemas import BackgroundStyle, FontFamily, ThemeId


THEMES: dict[ThemeId, dict] = {
    "classic": {"background": "#fafaf7", "surface": "#ffffff", "text": "#1f2937", "muted": "#6b7280", "primary": "#92400e", "secondary": "#b45309", "accent": "#d97706", "border": "#e5e7eb", "headingFont": "merriweather", "bodyFont": "lato"},
    "modern": {"background": "#ffffff", "surface": "#f8fafc", "text": "#0f172a", "muted": "#64748b", "primary": "#06b6d4", "secondary": "#6366f1", "accent": "#22d3ee", "border": "#e2e8f0", "headingFont": "poppins", "bodyFont": "inter"},
    "minimal": {"background": "#ffffff", "surface": "#fafafa", "text": "#111111", "muted": "#9ca3af", "primary": "#111111", "secondary": "#525252", "accent": "#111111", "border": "#f3f3f3", "headingFont": "inter", "bodyFont": "inter"},
    "corporate": {"background": "#f8fafc", "surface": "#ffffff", "text": "#0f172a", "muted": "#64748b", "primary": "#1e40af", "secondary": "#0e7490", "accent": "#3b82f6", "border": "#e2e8f0", "headingFont": "montserrat", "bodyFont": "inter"},
    "business": {"background": "#ffffff", "surface": "#f9fafb", "text": "#0f172a", "muted": "#64748b", "primary": "#047857", "secondary": "#0f766e", "accent": "#10b981", "border": "#e5e7eb", "headingFont": "poppins", "bodyFont": "roboto"},
    "education": {"background": "#fffef9", "surface": "#fffbeb", "text": "#1f2937", "muted": "#78716c", "primary": "#f59e0b", "secondary": "#0284c7", "accent": "#fbbf24", "border": "#fde68a", "headingFont": "nunito", "bodyFont": "nunito"},
    "dark": {"background": "#0b1120", "surface": "#0f172a", "text": "#e2e8f0", "muted": "#94a3b8", "primary": "#22d3ee", "secondary": "#818cf8", "accent": "#67e8f9", "border": "#1e293b", "headingFont": "poppins", "bodyFont": "inter"},
    "creative": {"background": "#fff7ed", "surface": "#ffffff", "text": "#1f2937", "muted": "#78716c", "primary": "#ea580c", "secondary": "#db2777", "accent": "#f97316", "border": "#fed7aa", "headingFont": "poppins", "bodyFont": "poppins"},
    "gradient": {"background": "#0f172a", "surface": "#1e293b", "text": "#f1f5f9", "muted": "#cbd5e1", "primary": "#a855f7", "secondary": "#ec4899", "accent": "#f472b6", "border": "#334155", "headingFont": "poppins", "bodyFont": "inter"},
    "elegant": {"background": "#fbfaf7", "surface": "#ffffff", "text": "#1c1917", "muted": "#78716c", "primary": "#1c1917", "secondary": "#92400e", "accent": "#b45309", "border": "#e7e5e4", "headingFont": "playfair", "bodyFont": "lato"},
}


FONT_STACKS: dict[FontFamily, str] = {
    "poppins": "Poppins",
    "inter": "Inter",
    "roboto": "Roboto",
    "montserrat": "Montserrat",
    "lato": "Lato",
    "opensans": "Open Sans",
    "nunito": "Nunito",
    "merriweather": "Merriweather",
    "playfair": "Playfair Display",
    "mono": "Source Code Pro",
}


def get_theme(theme_id: ThemeId) -> dict:
    return THEMES.get(theme_id, THEMES["modern"])


def get_font_stack(font_id: FontFamily) -> str:
    return FONT_STACKS.get(font_id, "Inter")


def resolve_background(settings) -> str:
    """Return a background hex color for the given settings."""
    bg = settings.background
    if bg == "white":
        return "#ffffff"
    if bg == "black":
        return "#0b1120"
    if bg == "blue":
        return "#1e3a8a"
    if bg == "green":
        return "#064e3b"
    if bg == "purple":
        return "#4c1d95"
    if bg == "custom":
        return settings.primary_color
    # gradient/abstract/geometric/glassmorphism — use theme background
    return get_theme(settings.theme)["background"]
