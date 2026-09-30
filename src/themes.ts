import type { ThemeId, BackgroundStyle, FontFamily } from './types';
import { FONT_LIST, getFontStack, getFontName } from './lib/fonts';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  // slide palette
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  // typography
  headingFont: FontFamily;
  bodyFont: FontFamily;
  // decorative
  pattern: 'none' | 'dots' | 'grid' | 'lines' | 'blobs' | 'gradient';
  radius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Timeless serif elegance with warm neutrals',
    background: '#fafaf7',
    surface: '#ffffff',
    text: '#1f2937',
    muted: '#6b7280',
    primary: '#92400e',
    secondary: '#b45309',
    accent: '#d97706',
    border: '#e5e7eb',
    headingFont: 'merriweather',
    bodyFont: 'lato',
    pattern: 'none',
    radius: 'sm',
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean sans-serif with vibrant cyan accents',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    muted: '#64748b',
    primary: '#06b6d4',
    secondary: '#6366f1',
    accent: '#22d3ee',
    border: '#e2e8f0',
    headingFont: 'poppins',
    bodyFont: 'inter',
    pattern: 'dots',
    radius: 'lg',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Whitespace-forward, ultra restrained',
    background: '#ffffff',
    surface: '#fafafa',
    text: '#111111',
    muted: '#9ca3af',
    primary: '#111111',
    secondary: '#525252',
    accent: '#111111',
    border: '#f3f3f3',
    headingFont: 'inter',
    bodyFont: 'inter',
    pattern: 'none',
    radius: 'md',
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    description: 'Trustworthy navy with steel grays',
    background: '#f8fafc',
    surface: '#ffffff',
    text: '#0f172a',
    muted: '#64748b',
    primary: '#1e40af',
    secondary: '#0e7490',
    accent: '#3b82f6',
    border: '#e2e8f0',
    headingFont: 'montserrat',
    bodyFont: 'inter',
    pattern: 'grid',
    radius: 'md',
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'Professional emerald on slate',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#0f172a',
    muted: '#64748b',
    primary: '#047857',
    secondary: '#0f766e',
    accent: '#10b981',
    border: '#e5e7eb',
    headingFont: 'poppins',
    bodyFont: 'roboto',
    pattern: 'lines',
    radius: 'sm',
  },
  education: {
    id: 'education',
    name: 'Education',
    description: 'Friendly amber and sky for learning',
    background: '#fffef9',
    surface: '#fffbeb',
    text: '#1f2937',
    muted: '#78716c',
    primary: '#f59e0b',
    secondary: '#0284c7',
    accent: '#fbbf24',
    border: '#fde68a',
    headingFont: 'nunito',
    bodyFont: 'nunito',
    pattern: 'dots',
    radius: 'xl',
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Sleek dark mode with neon cyan',
    background: '#0b1120',
    surface: '#0f172a',
    text: '#e2e8f0',
    muted: '#94a3b8',
    primary: '#22d3ee',
    secondary: '#818cf8',
    accent: '#67e8f9',
    border: '#1e293b',
    headingFont: 'poppins',
    bodyFont: 'inter',
    pattern: 'blobs',
    radius: 'lg',
  },
  creative: {
    id: 'creative',
    name: 'Creative',
    description: 'Playful pinks and oranges, bold shapes',
    background: '#fff7ed',
    surface: '#ffffff',
    text: '#1f2937',
    muted: '#78716c',
    primary: '#ea580c',
    secondary: '#db2777',
    accent: '#f97316',
    border: '#fed7aa',
    headingFont: 'poppins',
    bodyFont: 'poppins',
    pattern: 'blobs',
    radius: 'xl',
  },
  gradient: {
    id: 'gradient',
    name: 'Gradient',
    description: 'Vibrant gradient mesh backgrounds',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f1f5f9',
    muted: '#cbd5e1',
    primary: '#a855f7',
    secondary: '#ec4899',
    accent: '#f472b6',
    border: '#334155',
    headingFont: 'poppins',
    bodyFont: 'inter',
    pattern: 'gradient',
    radius: 'lg',
  },
  elegant: {
    id: 'elegant',
    name: 'Elegant',
    description: 'Editorial Playfair + soft champagne',
    background: '#fbfaf7',
    surface: '#ffffff',
    text: '#1c1917',
    muted: '#78716c',
    primary: '#1c1917',
    secondary: '#92400e',
    accent: '#b45309',
    border: '#e7e5e4',
    headingFont: 'playfair',
    bodyFont: 'lato',
    pattern: 'none',
    radius: 'sm',
  },
};

export const THEME_LIST = Object.values(THEMES);

export function getTheme(id: ThemeId): ThemeConfig {
  return THEMES[id] ?? THEMES.modern;
}

/** Darken (negative percent) or lighten (positive) a hex color.
 * Used to auto-derive a matching secondary shade from a single theme color. */
export function shadeHex(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Background style overrides (applied on top of theme)
export const BACKGROUND_STYLES: { id: BackgroundStyle; name: string; preview: string }[] = [
  { id: 'white', name: 'White', preview: '#ffffff' },
  { id: 'black', name: 'Black', preview: '#0b1120' },
  { id: 'blue', name: 'Blue', preview: '#1e40af' },
  { id: 'green', name: 'Green', preview: '#047857' },
  { id: 'purple', name: 'Purple', preview: '#6d28d9' },
  { id: 'gradient', name: 'Gradient', preview: 'linear-gradient(135deg,#06b6d4,#6366f1)' },
  { id: 'abstract', name: 'Abstract Shapes', preview: 'linear-gradient(135deg,#f97316,#ec4899)' },
  { id: 'geometric', name: 'Geometric', preview: 'linear-gradient(135deg,#1e293b,#0ea5e9)' },
  { id: 'glassmorphism', name: 'Glassmorphism', preview: 'linear-gradient(135deg,#a5f3fc,#c7d2fe)' },
  { id: 'custom', name: 'Custom Color', preview: 'repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0 8px,#f1f5f9 8px,#f1f5f9 16px)' },
];

export interface FontOption {
  id: string;
  name: string;
  sample: string;
}

export const FONT_OPTIONS: FontOption[] = FONT_LIST.map((f) => ({
  id: f.id,
  name: f.name,
  sample: f.name,
}));

// FONT_STACK maps a font id to a CSS font-family string.
// Dynamically backed by the font library; falls back to Inter for unknown ids.
export const FONT_STACK: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return getFontStack(prop);
  },
  has() {
    return true;
  },
});

export function getFontDisplayName(id: string): string {
  return getFontName(id);
}

export const AUDIENCE_OPTIONS = [
  { id: 'school', name: 'School', icon: 'GraduationCap' },
  { id: 'college', name: 'College', icon: 'BookOpen' },
  { id: 'teacher', name: 'Teacher', icon: 'Presentation' },
  { id: 'business', name: 'Business', icon: 'Briefcase' },
  { id: 'investor', name: 'Investor', icon: 'TrendingUp' },
] as const;

export const STYLE_OPTIONS = [
  { id: 'formal', name: 'Formal' },
  { id: 'casual', name: 'Casual' },
  { id: 'persuasive', name: 'Persuasive' },
  { id: 'informative', name: 'Informative' },
  { id: 'storytelling', name: 'Storytelling' },
] as const;

export const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Hindi', 'Arabic', 'Chinese', 'Japanese', 'Korean', 'Russian',
];

export const COLOR_PRESETS = [
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#0ea5e9', '#64748b',
];
