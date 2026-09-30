// Font library: 75 professional Google Fonts with categories and dynamic loading.

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

export interface FontDefinition {
  id: string;
  name: string;
  category: FontCategory;
  googleName: string; // URL-safe name for Google Fonts API (spaces → +)
  weights: number[];
  fallback: string; // CSS fallback family
}

const SANS_FALLBACK = 'sans-serif';
const SERIF_FALLBACK = 'serif';
const HANDWRITING_FALLBACK = 'cursive';
const MONO_FALLBACK = 'monospace';

export const FONT_LIST: FontDefinition[] = [
  // ── Sans Serif (25) ──
  { id: 'inter', name: 'Inter', category: 'sans-serif', googleName: 'Inter', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'roboto', name: 'Roboto', category: 'sans-serif', googleName: 'Roboto', weights: [300, 400, 500, 700], fallback: SANS_FALLBACK },
  { id: 'opensans', name: 'Open Sans', category: 'sans-serif', googleName: 'Open+Sans', weights: [300, 400, 500, 600, 700], fallback: SANS_FALLBACK },
  { id: 'lato', name: 'Lato', category: 'sans-serif', googleName: 'Lato', weights: [300, 400, 700], fallback: SANS_FALLBACK },
  { id: 'poppins', name: 'Poppins', category: 'sans-serif', googleName: 'Poppins', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'montserrat', name: 'Montserrat', category: 'sans-serif', googleName: 'Montserrat', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'nunito', name: 'Nunito', category: 'sans-serif', googleName: 'Nunito', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'raleway', name: 'Raleway', category: 'sans-serif', googleName: 'Raleway', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'ubuntu', name: 'Ubuntu', category: 'sans-serif', googleName: 'Ubuntu', weights: [300, 400, 500, 700], fallback: SANS_FALLBACK },
  { id: 'sourcesanspro', name: 'Source Sans Pro', category: 'sans-serif', googleName: 'Source+Sans+Pro', weights: [300, 400, 600, 700], fallback: SANS_FALLBACK },
  { id: 'ptsans', name: 'PT Sans', category: 'sans-serif', googleName: 'PT+Sans', weights: [400, 700], fallback: SANS_FALLBACK },
  { id: 'worksans', name: 'Work Sans', category: 'sans-serif', googleName: 'Work+Sans', weights: [300, 400, 500, 600, 700], fallback: SANS_FALLBACK },
  { id: 'rubik', name: 'Rubik', category: 'sans-serif', googleName: 'Rubik', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'dmsans', name: 'DM Sans', category: 'sans-serif', googleName: 'DM+Sans', weights: [400, 500, 700], fallback: SANS_FALLBACK },
  { id: 'quicksand', name: 'Quicksand', category: 'sans-serif', googleName: 'Quicksand', weights: [300, 400, 500, 600, 700], fallback: SANS_FALLBACK },
  { id: 'firasans', name: 'Fira Sans', category: 'sans-serif', googleName: 'Fira+Sans', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'mulish', name: 'Mulish', category: 'sans-serif', googleName: 'Mulish', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'manrope', name: 'Manrope', category: 'sans-serif', googleName: 'Manrope', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'barlow', name: 'Barlow', category: 'sans-serif', googleName: 'Barlow', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'karla', name: 'Karla', category: 'sans-serif', googleName: 'Karla', weights: [300, 400, 500, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'hind', name: 'Hind', category: 'sans-serif', googleName: 'Hind', weights: [300, 400, 500, 600, 700], fallback: SANS_FALLBACK },
  { id: 'heebo', name: 'Heebo', category: 'sans-serif', googleName: 'Heebo', weights: [300, 400, 500, 600, 700, 800, 900], fallback: SANS_FALLBACK },
  { id: 'nunitosans', name: 'Nunito Sans', category: 'sans-serif', googleName: 'Nunito+Sans', weights: [300, 400, 600, 700, 800], fallback: SANS_FALLBACK },
  { id: 'oxygen', name: 'Oxygen', category: 'sans-serif', googleName: 'Oxygen', weights: [300, 400, 700], fallback: SANS_FALLBACK },
  { id: 'cabin', name: 'Cabin', category: 'sans-serif', googleName: 'Cabin', weights: [400, 500, 600, 700], fallback: SANS_FALLBACK },

  // ── Serif (15) ──
  { id: 'merriweather', name: 'Merriweather', category: 'serif', googleName: 'Merriweather', weights: [300, 400, 700], fallback: SERIF_FALLBACK },
  { id: 'playfair', name: 'Playfair Display', category: 'serif', googleName: 'Playfair+Display', weights: [400, 500, 600, 700, 800], fallback: SERIF_FALLBACK },
  { id: 'lora', name: 'Lora', category: 'serif', googleName: 'Lora', weights: [400, 500, 600, 700], fallback: SERIF_FALLBACK },
  { id: 'ptserif', name: 'PT Serif', category: 'serif', googleName: 'PT+Serif', weights: [400, 700], fallback: SERIF_FALLBACK },
  { id: 'sourceserifpro', name: 'Source Serif Pro', category: 'serif', googleName: 'Source+Serif+Pro', weights: [400, 600, 700], fallback: SERIF_FALLBACK },
  { id: 'cormorant', name: 'Cormorant', category: 'serif', googleName: 'Cormorant', weights: [300, 400, 500, 600, 700], fallback: SERIF_FALLBACK },
  { id: 'ebgaramond', name: 'EB Garamond', category: 'serif', googleName: 'EB+Garamond', weights: [400, 500, 600, 700, 800], fallback: SERIF_FALLBACK },
  { id: 'crimsontext', name: 'Crimson Text', category: 'serif', googleName: 'Crimson+Text', weights: [400, 600, 700], fallback: SERIF_FALLBACK },
  { id: 'librebaskerville', name: 'Libre Baskerville', category: 'serif', googleName: 'Libre+Baskerville', weights: [400, 700], fallback: SERIF_FALLBACK },
  { id: 'zillaslab', name: 'Zilla Slab', category: 'serif', googleName: 'Zilla+Slab', weights: [300, 400, 500, 600, 700], fallback: SERIF_FALLBACK },
  { id: 'spectral', name: 'Spectral', category: 'serif', googleName: 'Spectral', weights: [300, 400, 500, 600, 700, 800], fallback: SERIF_FALLBACK },
  { id: 'frankruhllibre', name: 'Frank Ruhl Libre', category: 'serif', googleName: 'Frank+Ruhl+Libre', weights: [300, 400, 500, 700, 900], fallback: SERIF_FALLBACK },
  { id: 'dmserifdisplay', name: 'DM Serif Display', category: 'serif', googleName: 'DM+Serif+Display', weights: [400], fallback: SERIF_FALLBACK },
  { id: 'cormorantgaramond', name: 'Cormorant Garamond', category: 'serif', googleName: 'Cormorant+Garamond', weights: [300, 400, 500, 600, 700], fallback: SERIF_FALLBACK },
  { id: 'notoserif', name: 'Noto Serif', category: 'serif', googleName: 'Noto+Serif', weights: [400, 500, 600, 700], fallback: SERIF_FALLBACK },

  // ── Display (15) ──
  { id: 'oswald', name: 'Oswald', category: 'display', googleName: 'Oswald', weights: [300, 400, 500, 600, 700], fallback: SANS_FALLBACK },
  { id: 'bebasneue', name: 'Bebas Neue', category: 'display', googleName: 'Bebas+Neue', weights: [400], fallback: SANS_FALLBACK },
  { id: 'anton', name: 'Anton', category: 'display', googleName: 'Anton', weights: [400], fallback: SANS_FALLBACK },
  { id: 'archivoblack', name: 'Archivo Black', category: 'display', googleName: 'Archivo+Black', weights: [400], fallback: SANS_FALLBACK },
  { id: 'righteous', name: 'Righteous', category: 'display', googleName: 'Righteous', weights: [400], fallback: SANS_FALLBACK },
  { id: 'abrilfatface', name: 'Abril Fatface', category: 'display', googleName: 'Abril+Fatface', weights: [400], fallback: SERIF_FALLBACK },
  { id: 'bungee', name: 'Bungee', category: 'display', googleName: 'Bungee', weights: [400], fallback: SANS_FALLBACK },
  { id: 'blackopsone', name: 'Black Ops One', category: 'display', googleName: 'Black+Ops+One', weights: [400], fallback: SANS_FALLBACK },
  { id: 'fredoka', name: 'Fredoka', category: 'display', googleName: 'Fredoka', weights: [300, 400, 500, 600, 700], fallback: SANS_FALLBACK },
  { id: 'patuaone', name: 'Patua One', category: 'display', googleName: 'Patua+One', weights: [400], fallback: SERIF_FALLBACK },
  { id: 'staatliches', name: 'Staatliches', category: 'display', googleName: 'Staatliches', weights: [400], fallback: SANS_FALLBACK },
  { id: 'yanonekaffeesatz', name: 'Yanone Kaffeesatz', category: 'display', googleName: 'Yanone+Kaffeesatz', weights: [300, 400, 500, 600, 700], fallback: SANS_FALLBACK },
  { id: 'russoone', name: 'Russo One', category: 'display', googleName: 'Russo+One', weights: [400], fallback: SANS_FALLBACK },
  { id: 'teko', name: 'Teko', category: 'display', googleName: 'Teko', weights: [300, 400, 500, 600, 700], fallback: SANS_FALLBACK },
  { id: 'majormono', name: 'Major Mono Display', category: 'display', googleName: 'Major+Mono+Display', weights: [400], fallback: MONO_FALLBACK },

  // ── Handwriting (12) ──
  { id: 'caveat', name: 'Caveat', category: 'handwriting', googleName: 'Caveat', weights: [400, 500, 600, 700], fallback: HANDWRITING_FALLBACK },
  { id: 'pacifico', name: 'Pacifico', category: 'handwriting', googleName: 'Pacifico', weights: [400], fallback: HANDWRITING_FALLBACK },
  { id: 'lobster', name: 'Lobster', category: 'handwriting', googleName: 'Lobster', weights: [400], fallback: HANDWRITING_FALLBACK },
  { id: 'dancingscript', name: 'Dancing Script', category: 'handwriting', googleName: 'Dancing+Script', weights: [400, 500, 600, 700], fallback: HANDWRITING_FALLBACK },
  { id: 'sacramento', name: 'Sacramento', category: 'handwriting', googleName: 'Sacramento', weights: [400], fallback: HANDWRITING_FALLBACK },
  { id: 'satisfy', name: 'Satisfy', category: 'handwriting', googleName: 'Satisfy', weights: [400], fallback: HANDWRITING_FALLBACK },
  { id: 'greatvibes', name: 'Great Vibes', category: 'handwriting', googleName: 'Great+Vibes', weights: [400], fallback: HANDWRITING_FALLBACK },
  { id: 'permanentmarker', name: 'Permanent Marker', category: 'handwriting', googleName: 'Permanent+Marker', weights: [400], fallback: HANDWRITING_FALLBACK },
  { id: 'shadowsintolight', name: 'Shadows Into Light', category: 'handwriting', googleName: 'Shadows+Into+Light', weights: [400], fallback: HANDWRITING_FALLBACK },
  { id: 'amaticsc', name: 'Amatic SC', category: 'handwriting', googleName: 'Amatic+SC', weights: [400, 700], fallback: HANDWRITING_FALLBACK },
  { id: 'homemadeapple', name: 'Homemade Apple', category: 'handwriting', googleName: 'Homemade+Apple', weights: [400], fallback: HANDWRITING_FALLBACK },
  { id: 'parisienne', name: 'Parisienne', category: 'handwriting', googleName: 'Parisienne', weights: [400], fallback: HANDWRITING_FALLBACK },

  // ── Monospace (8) ──
  { id: 'mono', name: 'Source Code Pro', category: 'monospace', googleName: 'Source+Code+Pro', weights: [400, 500, 600], fallback: MONO_FALLBACK },
  { id: 'firacode', name: 'Fira Code', category: 'monospace', googleName: 'Fira+Code', weights: [300, 400, 500, 600, 700], fallback: MONO_FALLBACK },
  { id: 'jetbrainsmono', name: 'JetBrains Mono', category: 'monospace', googleName: 'JetBrains+Mono', weights: [400, 500, 700, 800], fallback: MONO_FALLBACK },
  { id: 'robotomono', name: 'Roboto Mono', category: 'monospace', googleName: 'Roboto+Mono', weights: [300, 400, 500, 700], fallback: MONO_FALLBACK },
  { id: 'ubuntumono', name: 'Ubuntu Mono', category: 'monospace', googleName: 'Ubuntu+Mono', weights: [400, 700], fallback: MONO_FALLBACK },
  { id: 'inconsolata', name: 'Inconsolata', category: 'monospace', googleName: 'Inconsolata', weights: [400, 700], fallback: MONO_FALLBACK },
  { id: 'spacemono', name: 'Space Mono', category: 'monospace', googleName: 'Space+Mono', weights: [400, 700], fallback: MONO_FALLBACK },
  { id: 'ibmplexmono', name: 'IBM Plex Mono', category: 'monospace', googleName: 'IBM+Plex+Mono', weights: [400, 500, 600, 700], fallback: MONO_FALLBACK },
];

// ── Lookup maps ──

export const FONT_MAP: Record<string, FontDefinition> = Object.fromEntries(
  FONT_LIST.map((f) => [f.id, f]),
);

export function getFontStack(id: string): string {
  const font = FONT_MAP[id];
  if (!font) return `'Inter', sans-serif`;
  return `'${font.name}', ${font.fallback}`;
}

export function getFontName(id: string): string {
  return FONT_MAP[id]?.name || 'Inter';
}

// ── Dynamic font loader ──

const loadedFonts = new Set<string>();
const loadingPromises = new Map<string, Promise<void>>();

function buildFontUrl(font: FontDefinition): string {
  const weightsParam = font.weights.length === 1 && font.weights[0] === 400
    ? ''
    : `:wght@${font.weights.join(';')}`;
  return `https://fonts.googleapis.com/css2?family=${font.googleName}${weightsParam}&display=swap`;
}

export function loadFont(id: string): Promise<void> {
  if (loadedFonts.has(id)) return Promise.resolve();
  if (loadingPromises.has(id)) return loadingPromises.get(id)!;

  const font = FONT_MAP[id];
  if (!font) return Promise.resolve();

  const promise = new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = buildFontUrl(font);
    link.crossOrigin = 'anonymous';
    link.onload = () => {
      loadedFonts.add(id);
      resolve();
    };
    link.onerror = () => {
      // Still resolve so UI doesn't block; font will fall back to system
      resolve();
    };
    document.head.appendChild(link);
  });

  loadingPromises.set(id, promise);
  return promise;
}

export function loadFonts(ids: string[]): Promise<void[]> {
  return Promise.all(ids.map((id) => loadFont(id)));
}

// Load the fonts needed by a presentation's theme
export function loadThemeFonts(headingFontId: string, bodyFontId: string): Promise<void[]> {
  const ids = new Set<string>([headingFontId, bodyFontId]);
  // Also load fonts used by text elements
  return loadFonts([...ids]);
}
