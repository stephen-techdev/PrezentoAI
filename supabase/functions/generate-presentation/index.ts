/*
 * Edge Function: generate-presentation
 *
 * Server-side presentation generation pipeline:
 *   1. Parse the user prompt (topic, slide count, images flag)
 *   2. Call an OpenAI-compatible API with JSON-mode output for structured
 *      slide content, using the full 18-layout vocabulary the frontend
 *      already renders and exports
 *   3. Fetch images from Unsplash (free tier) for slides that need them
 *   4. Return a Presentation object the frontend can open in the editor
 *
 * API keys are read from Deno.env and never exposed to the client.
 * If the LLM key is missing the function returns a 503 so the frontend
 * can fall back to its local generator.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── LLM System Prompt ─────────────────────────────────────────────────────────
//
// The frontend supports 18 distinct slide layouts (see src/types.ts
// SlideLayout, src/lib/exporter.ts and src/components/SlideRenderer.tsx).
// This prompt asks the model to use the full set, not just plain bullets,
// so generated decks are visually varied instead of a wall of text slides.

const SYSTEM_PROMPT = `You are a presentation architect and subject-matter expert. Your job is to analyze the user's prompt, decide the real message and audience, then write a polished slide deck that is logically structured and easy to present. Do not copy-paste the prompt or turn it into a raw list of sentences.

CRITICAL THINKING PROCESS:
1. Analyze the user's prompt for the actual goal, audience, and key ideas.
2. Decide the best slide order: introduction, context, core points, supporting structure, evidence/visual breakdown, and conclusion.
3. Build a clear narrative before writing slide text.
4. Transform the source material into concise, professional slides with smooth transitions.
5. Keep each slide focused on one main idea and avoid redundancy.

CRITICAL OUTPUT RULES:
1. You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no commentary.
2. The JSON must have a "slides" array.
3. Every slide object must have exactly these base fields:
   - slide_number: integer (1-based, sequential)
   - layout_type: one of "title", "agenda", "bullets", "two-column", "image-left", "image-right", "full-image", "section-divider", "quote", "statistics", "timeline", "process", "comparison", "cards", "table", "chart", "closing"
   - title: string (concise, descriptive, specific to the content — under 8 words)
   - bullet_points: array of strings (used by several layouts — see per-layout rules below)
   - speaker_notes: string (what the presenter should explain, 1-3 sentences)
   - image_query: string (3-5 word search phrase for a relevant photo, or "" if no image needed)
4. The FIRST slide must have layout_type "title".
5. The LAST slide must have layout_type "closing".
6. Generate exactly the requested number of slides.
7. Every bullet point must contain a SPECIFIC FACT or piece of information — never generic filler, and never exceed 12 words each.
8. USE VARIED LAYOUTS. Do not make most slides "bullets". In any deck of 6+ slides, include AT LEAST 2-3 slides using "statistics", "timeline", "process", "comparison", "table", "cards", or "chart" — whichever genuinely fits the topic's content. A deck that is mostly plain bullet slides is a FAILURE of this task.
9. Generate ALL text in the specified language.
10. Never use placeholder text like "Image placeholder" or "Add image here".
11. Slide titles must be DESCRIPTIVE and SPECIFIC — not generic labels like "Key Points" or "Overview".
12. Each slide must cover DIFFERENT information — no repetition across slides.
13. For "title" slides: bullet_points should contain zero or one item (a subtitle phrase).
14. For "closing" slides: bullet_points should contain a brief closing message or call to action.
15. For "quote" slides: title is the quote text itself (no quotation marks), and bullet_points[0] is "— Author Name".
16. For "agenda" slides: bullet_points lists the section/topic names covered later in the deck (one per upcoming section).
17. For "section-divider" slides: title is the section name, bullet_points may contain one short subtitle, and you must also include a "section_number" field (e.g. "01", "02").
18. For "statistics" slides: include a "stats" array of 3-4 objects, each { "value": "short stat like 42% or 3.2x or 10M", "label": "what it measures" }. Do not invent fake precise statistics presented as verified fact for niche/current topics — use clearly reasonable illustrative figures if exact data isn't reliably known.
19. For "timeline" slides: include a "timeline" array of 3-5 objects, each { "year": "a year, date, or phase name", "title": "short label", "description": "one short sentence" }.
20. For "process" slides: include a "steps" array of 3-5 objects, each { "step": <integer starting at 1>, "title": "short step name", "description": "one short sentence" }.
21. For "comparison" slides: include a "comparison" object { "leftTitle": "Option A name", "rightTitle": "Option B name", "rows": [ { "feature": "aspect being compared", "optionA": "value for A", "optionB": "value for B" }, ... 3-5 rows ] }.
22. For "cards" slides: include a "cards" array of 3-4 objects, each { "title": "short label", "description": "one short sentence" }.
23. For "table" slides: include a "table" object { "headers": ["Col1","Col2",...], "rows": [["a","b",...], ...] }, 3-6 rows, 2-4 columns.
24. For "chart" slides: include a "chart" object { "chartType": "bar" or "line", "labels": ["..."], "values": [numbers], "title": "short chart title" }, with real, plausible topic-relevant data.
25. For "image-left", "image-right", and "full-image" slides: bullet_points should contain at most 3 items (less text since part of the slide is an image), and image_query must be non-empty and specific.
26. For "two-column" and "bullets" slides: bullet_points should contain 3-5 items.
27. Never copy the raw user prompt word-for-word onto slides. Instead, summarize, organize, and refine it into a presentation structure.
28. Each slide should sound authored for a presentation, not pasted from the prompt or generated as generic AI filler.
29. Ensure the narration flows naturally from the first slide to the final close.`;

// ── Prompt parsing ──────────────────────────────────────────────────────────

interface ParsedPrompt {
  topic: string;
  slideCount: number;
  includeImages: boolean;
  includeCharts: boolean;
}

function parsePrompt(settings: Record<string, unknown>): ParsedPrompt {
  const prompt = String(settings.prompt || settings.title || "");

  let slideCount = Number(settings.slideCount) || 8;
  const countMatch = prompt.match(/(\d+)\s*[-–]?\s*slide/i);
  if (countMatch) {
    slideCount = parseInt(countMatch[1], 10);
  }
  if (slideCount < 3) slideCount = 3;
  if (slideCount > 30) slideCount = 30;

  let topic = prompt
    .replace(
      /^(create|make|generate|build|design|prepare|write)\s+(a|an|the)?\s*(presentation|slides|deck|slideshow)?\s*(about|on|for|regarding)?\s*/i,
      "",
    )
    .replace(/(\d+)\s*[-–]?\s*slides?.*/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
  if (!topic) topic = String(settings.title || "Untitled Presentation");

  const includeImages = settings.images !== false;
  const includeCharts = settings.charts === true;

  return { topic, slideCount, includeImages, includeCharts };
}

// ── LLM call (OpenAI-compatible API) ───────────────────────────────────────

function buildUserPrompt(
  topic: string,
  slideCount: number,
  settings: Record<string, unknown>,
  includeCharts: boolean,
): string {
  return `Create a presentation about: "${topic}"
Number of slides: ${slideCount}
Audience: ${settings.audience || "college"}
Language: ${settings.language || "English"}
Presentation style: ${settings.presentationStyle || "formal"}
Visual theme selected by the user: ${settings.theme || "modern"}
${includeCharts ? 'The user explicitly wants data — include at least one "chart" layout slide with real, relevant illustrative data for this topic.' : ""}

Generate exactly ${slideCount} slides with VARIED layouts (not mostly plain bullets — use statistics, timeline, process, comparison, table, or cards layouts where they genuinely fit the topic). The first slide must be layout_type "title" and the last must be layout_type "closing".

Respond with ONLY a JSON object in this exact format (include extra per-layout fields as instructed in the system prompt only on the slides that need them):
{
  "slides": [
    {
      "slide_number": 1,
      "layout_type": "title",
      "title": "Presentation Title",
      "bullet_points": [],
      "speaker_notes": "Welcome the audience...",
      "image_query": ""
    },
    {
      "slide_number": 2,
      "layout_type": "statistics",
      "title": "The Numbers That Matter",
      "bullet_points": [],
      "speaker_notes": "Walk through each stat...",
      "image_query": "",
      "stats": [
        { "value": "42%", "label": "specific metric" },
        { "value": "3.2x", "label": "specific metric" },
        { "value": "10M", "label": "specific metric" }
      ]
    }
  ]
}`;
}

const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
const OPENAI_BASE_URL = (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");

async function callOpenAICompatible(
  userPrompt: string,
  isRetry: boolean,
): Promise<{ slides: LLMSlide[] }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const systemMessage = isRetry
    ? SYSTEM_PROMPT +
      "\n\nIMPORTANT: Return ONLY valid JSON. No markdown. No code fences. No commentary. Just the raw JSON object starting with { and ending with }."
    : SYSTEM_PROMPT;

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI-compatible API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI-compatible API returned empty content");
  }

  let parsed: { slides?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    const stripped = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(stripped);
  }

  if (!parsed.slides || !Array.isArray(parsed.slides)) {
    throw new Error("OpenAI-compatible API returned invalid JSON structure (no slides array)");
  }

  return parsed as { slides: LLMSlide[] };
}

// ── Image fetching (Unsplash — free tier) ────────────────────────────────────

async function fetchUnsplashImage(query: string): Promise<string | null> {
  const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
  if (!accessKey || !query) return null;

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${
        encodeURIComponent(query)
      }&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${accessKey}` } },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const results = data.results;
    if (!results || results.length === 0) return null;

    return results[0].urls?.regular || null;
  } catch {
    return null;
  }
}

// ── Slide mapping ────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Every layout_type the model can output now maps 1:1 to a real SlideLayout
// the frontend already fully renders and exports (see src/types.ts).
const LAYOUT_MAP: Record<string, string> = {
  "title": "hero",
  "agenda": "agenda",
  "bullets": "two-column",
  "two-column": "two-column",
  "image-left": "image-left",
  "image-right": "image-right",
  "full-image": "full-image",
  "section-divider": "section-divider",
  "quote": "quote",
  "statistics": "statistics",
  "timeline": "timeline",
  "process": "process",
  "comparison": "comparison",
  "cards": "cards",
  "table": "table",
  "chart": "chart",
  "closing": "thank-you",
};

const ICON_MAP: Record<string, string> = {
  "hero": "Sparkles",
  "agenda": "ListChecks",
  "two-column": "BookOpen",
  "image-left": "Image",
  "image-right": "Image",
  "full-image": "Image",
  "section-divider": "Flag",
  "quote": "Quote",
  "statistics": "BarChart3",
  "timeline": "Clock",
  "process": "Workflow",
  "comparison": "Columns",
  "cards": "LayoutGrid",
  "table": "Table",
  "chart": "LineChart",
  "thank-you": "Heart",
};

interface LLMStat {
  value?: string;
  label?: string;
}
interface LLMTimelineItem {
  year?: string;
  title?: string;
  description?: string;
}
interface LLMStep {
  step?: number;
  title?: string;
  description?: string;
}
interface LLMComparisonRow {
  feature?: string;
  optionA?: string;
  optionB?: string;
}
interface LLMComparison {
  leftTitle?: string;
  rightTitle?: string;
  rows?: LLMComparisonRow[];
}
interface LLMCard {
  title?: string;
  description?: string;
}
interface LLMTable {
  headers?: string[];
  rows?: string[][];
}
interface LLMChart {
  chartType?: string;
  labels?: string[];
  values?: number[];
  title?: string;
}

interface LLMSlide {
  slide_number?: number;
  layout_type?: string;
  title?: string;
  bullet_points?: string[];
  speaker_notes?: string;
  image_query?: string;
  section_number?: string;
  stats?: LLMStat[];
  timeline?: LLMTimelineItem[];
  steps?: LLMStep[];
  comparison?: LLMComparison;
  cards?: LLMCard[];
  table?: LLMTable;
  chart?: LLMChart;
}

function mapSlide(
  llmSlide: LLMSlide,
  index: number,
  imageUrl: string | null,
): Record<string, unknown> {
  const layoutType = llmSlide.layout_type || "bullets";
  const layout = LAYOUT_MAP[layoutType] || "two-column";
  const title = llmSlide.title || `Slide ${index + 1}`;
  const rawBullets = (llmSlide.bullet_points || []).slice(0, 5);
  const bullets = rawBullets.map((text: string) => ({
    id: genId("bl"),
    text,
  }));
  const notes = llmSlide.speaker_notes || "";
  const accentIcon = ICON_MAP[layout] || "BookOpen";

  const slide: Record<string, unknown> = {
    id: genId("sl"),
    layout,
    title,
    notes,
    accentIcon,
  };

  if (layout === "hero") {
    slide.subtitle = rawBullets.length > 0 ? rawBullets[0] : "";
  } else if (layout === "thank-you") {
    slide.subtitle = rawBullets.length > 0
      ? rawBullets[0]
      : "Questions and discussion welcome.";
  } else if (layout === "quote") {
    slide.quote = {
      text: title,
      author: rawBullets.length > 0 ? rawBullets[0].replace(/^—\s*/, "") : "Unknown",
    };
    slide.title = "A Thought to Share";
  } else if (layout === "section-divider") {
    slide.sectionNumber = llmSlide.section_number || String(index + 1).padStart(2, "0");
    if (rawBullets.length > 0) slide.subtitle = rawBullets[0];
  } else if (layout === "statistics") {
    const stats = (llmSlide.stats || []).slice(0, 4);
    slide.stats = stats.map((s) => ({
      id: genId("st"),
      value: s.value || "",
      label: s.label || "",
    }));
  } else if (layout === "timeline") {
    const items = (llmSlide.timeline || []).slice(0, 5);
    slide.timeline = items.map((t) => ({
      id: genId("tl"),
      year: t.year || "",
      title: t.title || "",
      description: t.description || "",
    }));
  } else if (layout === "process") {
    const steps = (llmSlide.steps || []).slice(0, 5);
    slide.steps = steps.map((s, i) => ({
      id: genId("ps"),
      step: s.step || i + 1,
      title: s.title || "",
      description: s.description || "",
    }));
  } else if (layout === "comparison") {
    const cmp = llmSlide.comparison;
    slide.comparison = {
      leftTitle: cmp?.leftTitle || "Option A",
      rightTitle: cmp?.rightTitle || "Option B",
      rows: (cmp?.rows || []).slice(0, 6).map((r) => ({
        id: genId("cr"),
        feature: r.feature || "",
        optionA: r.optionA || "",
        optionB: r.optionB || "",
      })),
    };
  } else if (layout === "cards") {
    const cards = (llmSlide.cards || []).slice(0, 4);
    slide.cards = cards.map((c) => ({
      id: genId("cd"),
      title: c.title || "",
      description: c.description || "",
    }));
  } else if (layout === "table") {
    slide.table = {
      headers: llmSlide.table?.headers || [],
      rows: llmSlide.table?.rows || [],
    };
  } else if (layout === "chart") {
    const chartType = llmSlide.chart?.chartType === "line" ? "line" : "bar";
    slide.chart = {
      chartType,
      labels: llmSlide.chart?.labels || [],
      values: llmSlide.chart?.values || [],
      title: llmSlide.chart?.title || "",
    };
  } else if (layout === "agenda") {
    slide.bullets = bullets;
  } else {
    // two-column, image-left, image-right, full-image
    slide.bullets = bullets;
    if (imageUrl) {
      slide.image = {
        url: imageUrl,
        alt: llmSlide.image_query || title,
        source: "Unsplash",
      };
    }
  }

  return slide;
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const settings = body.settings;

    if (!settings) {
      return new Response(
        JSON.stringify({ error: "Missing settings" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Step 1 — Parse the user prompt
    const { topic, slideCount, includeImages, includeCharts } = parsePrompt(settings);

    // Step 2 — Generate structured slide content via an OpenAI-compatible API
    const userPrompt = buildUserPrompt(topic, slideCount, settings, includeCharts);

    let llmData: { slides: LLMSlide[] };
    try {
      llmData = await callOpenAICompatible(userPrompt, false);
    } catch (firstError) {
      try {
        llmData = await callOpenAICompatible(userPrompt, true);
      } catch (retryError) {
        throw new Error(
          `LLM generation failed: ${
            (retryError as Error).message ||
            (firstError as Error).message
          }`,
        );
      }
    }

    let llmSlides: LLMSlide[] = llmData.slides;

    // Enforce slide count
    while (llmSlides.length < slideCount) {
      llmSlides.splice(llmSlides.length - 1, 0, {
        slide_number: llmSlides.length,
        layout_type: "two-column",
        title: `Key Insights ${llmSlides.length}`,
        bullet_points: [],
        speaker_notes: "",
        image_query: "",
      });
    }
    if (llmSlides.length > slideCount) {
      llmSlides = llmSlides.slice(0, slideCount);
    }

    // Force first = title, last = closing
    if (llmSlides.length > 0) {
      llmSlides[0].layout_type = "title";
      llmSlides[llmSlides.length - 1].layout_type = "closing";
    }

    // Step 3 — Fetch images (only if includeImages is true)
    const imageUrls: (string | null)[] = await Promise.all(
      llmSlides.map(async (slide: LLMSlide) => {
        if (!includeImages || !slide.image_query) return null;
        return await fetchUnsplashImage(slide.image_query!);
      }),
    );

    // Step 4 — Map to frontend slide format
    const slides = llmSlides.map((slide, i) =>
      mapSlide(slide, i, imageUrls[i])
    );

    // Step 5 — Build presentation object
    const now = new Date().toISOString();
    const presentation = {
      id: genId("pres"),
      settings,
      slides,
      createdAt: now,
      updatedAt: now,
    };

    return new Response(
      JSON.stringify({ presentation }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = (err as Error).message || "Generation failed";
    const status = message.includes("not configured") ? 503 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
