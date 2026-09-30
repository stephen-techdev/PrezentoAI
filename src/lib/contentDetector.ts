// ─────────────────────────────────────────────────────────────────────────────
// Content detection for smart generation mode selection.
//
// Analyzes the user's prompt to determine whether they supplied actual
// presentation content (Mode 1/3) or just a topic (Mode 2). The result drives
// whether the generator uses the user's content directly or performs AI
// research to generate content from scratch.
// ─────────────────────────────────────────────────────────────────────────────

export type GenerationMode = 'user-content' | 'research' | 'empty' | 'multi-topic';

export interface ContentDetection {
  mode: GenerationMode;
  /** The core topic, extracted from the prompt. */
  topic: string;
  /** Display title (Title Case). */
  title: string;
  /** Structured slide instructions parsed from the prompt, if any. */
  slideInstructions: ParsedSlideInstruction[];
  /** Bullet-style content points extracted from the prompt, if any. */
  contentPoints: string[];
  /** Subtopics detected from a topic+subtopic-list prompt (Type B), if any. */
  subtopics: string[];
  /** Independent topics detected from a multi-topic prompt (one topic per line), if any. */
  multiTopics: string[];
  /** Whether the user specified an exact slide count. */
  requestedSlideCount: number | null;
  /** True only when the user LITERALLY wrote a count ("8-slide presentation").
   * `requestedSlideCount` is also derived from multi-topic lists, so this flag
   * is what tells the generator whether trimming user content is allowed. */
  explicitSlideCount: boolean;
  /** The cleaned prompt with boilerplate removed. */
  cleanedPrompt: string;
}

export interface StyleDirectives {
  align?: 'left' | 'center' | 'right';
  fontFamily?: string;
  primaryColor?: string;
  secondaryColor?: string;
  background?: string;
  /** Prompt asks for visuals / icons / diagrams / illustrations. */
  wantsVisuals?: boolean;
  /** Prompt asks for concise, minimal-text, uncluttered slides. */
  concise?: boolean;
}

/** Lines that are slide-CREATION directives, not slide CONTENT.
 * e.g. "Use a professional college-project style.",
 * "Keep each slide concise and easy to read.",
 * "Maintain the same visual theme throughout all 8 slides."
 * These must never appear as bullets/body — they drive styling instead. */
/** Strong design/visual vocabulary — these lines are ALWAYS creation
 * directives, even when written as a bullet ("* Use relevant visuals."). */
const STRONG_DESIGN_RE =
  /\b(?:typograph|theme|style|layout|overcrowd|clutter|consistent|visual|illustration|icon|diagram|palette|spacing|hierarchy|aesthetic|font|design)\w*\b/i;

/** Weaker slide-level vocabulary that only counts as a directive when the
 * line is a bare instruction (no list marker). */
const WEAK_DESIGN_RE =
  /\b(?:slide|slides|text|content|image|picture|paragraph|read|same|throughout|suitable|minute|presentation|color|colour)\w*\b/i;

/** Design phrases strong enough to mark a directive even when the user wrote
 * it as a list item — e.g. "* Keep each slide concise.",
 * "3. Choose audience and design settings" must NOT match. */
const STRONG_LIST_RE =
  /\b(?:typograph|theme|aesthetic|palette|consistent|layout|overcrowd|clutter|visual|illustration|icon|diagram|spacing|hierarchy|font|concise|minimal|readable|colour|color|design\s+(?:style|instruction|guideline|tone))\w*\b/i;

const CREATION_VERB_RE =
  /^(use|utilize|apply|ensure|maintain|keep|make sure|make the|make it|make this|avoid|do not|don't|prefer|choose|pick|select|add|include|insert|go for)\b/i;

export function isDesignDirectiveLine(text: string, listedAsItem = false): boolean {
  const raw = text.trim();
  if (raw.length < 10) return false;
  // A line the user explicitly wrote as a list item is content by intent,
  // unless it uses strong design vocabulary.
  const isListItem = listedAsItem || /^(?:[-*•–—]|\d+[.).])\s+/.test(raw);
  const t = raw.replace(/^[-*•–—\d+.)\s]+/, '').trim();

  if (isListItem) {
    return STRONG_LIST_RE.test(t) && CREATION_VERB_RE.test(t);
  }

  if (STRONG_DESIGN_RE.test(t) && CREATION_VERB_RE.test(t)) return true;
  // Naked style sentences without an imperative verb
  if (/^(consistent|concise|minimal|professional|modern|clean|simple)\b/i.test(t)
    && STRONG_DESIGN_RE.test(t)) return true;
  if (/suitable for a.*(?:minute|presentation)/i.test(t)) return true;
  if (/relevant .*visual/i.test(t)) return true;
  if (CREATION_VERB_RE.test(t) && WEAK_DESIGN_RE.test(t)) return true;
  return false;
}

export interface ParsedSlideInstruction {
  slideNumber: number | null;
  title: string;
  content: string;
  /** Verbatim bullet lines extracted from the prompt for this slide. */
  bullets: string[];
  /** Parallel to `bullets`: true when the line was written as a list item
   *  ("* ..." / "1. ..."). Lets downstream code tell listed content from
   *  prose so prose-looking bullets aren't mistaken for instructions. */
  bulletMarkers: boolean[];
  /** Verbatim body paragraphs (non-bullet lines). */
  bodyLines: string[];
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'for', 'to', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'by', 'as', 'at', 'from', 'this',
  'that', 'these', 'those', 'it', 'its', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'up', 'down', 'over', 'under', 'again',
  'include', 'including', 'includes', 'include:', 'included',
]);

function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => (STOPWORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function stripBoilerplate(prompt: string): string {
  return prompt
    .replace(/^(create|make|generate|build|design|prepare|write)\s+(a|an|the)?\s*\d*\s*-?\s*slide\s*(presentation|slides|deck|slideshow)?\s*(about|on|for|regarding)?\s*/i, '')
    .replace(/^(create|make|generate|build|design|prepare|write)\s+(a|an|the)?\s*(presentation|slides|deck|slideshow)?\s*(about|on|for|regarding)?\s*/i, '')
    .replace(/[.?!]+$/g, '')
    .trim();
}

function extractSlideCount(prompt: string): number | null {
  const patterns = [
    /(\d+)\s*[-–]?\s*slide\s*(presentation|deck|slideshow)?/i,
    /(\d+)\s*slides\b/i,
    /exactly\s*(\d+)\s*slides?/i,
    /(\d+)\s*slide\s*(presentation|deck)?/i,
  ];
  for (const p of patterns) {
    const m = prompt.match(p);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n <= 50) return n;
    }
  }
  return null;
}

// Parse explicit slide-by-slide instructions. ARRANGE-ONLY: content is kept
// verbatim — no AI research, no rewriting. Handles:
//   "Slide 1: Title", "Slide 1 - Title",
//   "### Slide 1 – Title", "## Slide 2 – X", "**Slide 3** – Y",
//   "### Design Instructions" (treated as directives block, not a slide)
function parseSlideInstructions(text: string): ParsedSlideInstruction[] {
  const results: ParsedSlideInstruction[] = [];
  // Split inline slide markers so "Slide 1: A. Slide 2: B." works on one line.
  // Pieces that are only markdown markers (e.g. the "###" left behind when
  // splitting "### Slide 2 - ...") are dropped, never treated as content.
  const lines = text
    .split(/\n/)
    .flatMap((l) => l.split(/(?=slide\s*\d+\s*[:\-–—])/i))
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[#*]+$/.test(l));

  interface Block { header: string; num: number | null; lines: string[] }
  const blocks: Block[] = [];
  let current: Block | null = null;

  const headerRe = /^\s*(?:#{1,4}\s*)?(?:\*{0,2}\s*)slide\s*(\d+)?\s*(?:\*{0,2})?\s*[:\-–—.]?\s*(.*)$/i;

  const isDirectiveHeader = (t: string): boolean =>
    /design\s*instructions?|style\s*(guide|instructions?)|formatting/i.test(t);

  // Standalone section header that ends the previous slide and starts a
  // deck-level directives block, e.g. "### Design Instructions".
  const directivesBlockRe =
    /^\s*(?:#{1,4}\s*)?\**\s*(?:design\s+instructions?|style\s+(?:guide|instructions?)|formatting|general\s+instructions?|presentation\s+instructions?)\s*\**\s*:?\s*$/i;

  for (const rawLine of lines) {
    if (directivesBlockRe.test(rawLine)) {
      current = { header: '__directives__', num: null, lines: [] };
      blocks.push(current);
      continue;
    }
    const m = rawLine.match(headerRe);
    // Avoid matching ordinary sentences containing the word "slide(s)"
    const looksLikeHeader =
      m && (/^\s*#{1,4}\s*/.test(rawLine) || /slide\s*\d+/i.test(rawLine) || /^\s*\*{0,2}\s*slide\b/i.test(rawLine));
    if (looksLikeHeader && m) {
      const num = m[1] ? parseInt(m[1], 10) : null;
      const rest = (m[2] || '').trim().replace(/^\*{2}|\*{2}$/g, '').trim();
      if (isDirectiveHeader(rest)) {
        // Directives block — attach to previous? store as non-slide block
        current = { header: '__directives__', num: null, lines: [] };
        blocks.push(current);
        continue;
      }
      current = { header: rest, num, lines: [] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(rawLine);
    }
  }

  for (const b of blocks) {
    if (b.header === '__directives__') continue;
    const bullets: string[] = [];
    const bulletMarkers: boolean[] = [];
    const bodyLines: string[] = [];
    for (const ln of b.lines) {
      const t = ln.trim();
      if (!t) continue;
      // Skip nested design-instruction headers inside a slide
      if (/^#{1,4}\s*design/i.test(t)) continue;
      const bulletMatch = t.match(/^(?:[-*•–—]|\d+[.):])\s+(.*)$/);
      // Bold label lines like "* Name: Stephen" or "**Frontend:**"
      const cleaned = bulletMatch ? bulletMatch[1].trim() : t;
      // Strip markdown bold/italic markers but keep text verbatim otherwise
      const plain = cleaned.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1').trim();
      if (!plain) continue;
      // DESIGN DIRECTIVES are creation instructions, not content — drop them
      // here so they never become bullets/body (they're read by
      // parseStyleDirectives instead). A line the user wrote as a list item
      // is kept unless it uses strong design vocabulary.
      if (isDesignDirectiveLine(plain, !!bulletMatch)) continue;
      // Section sub-headers like "Frontend:" / "Backend:" / "Export:" become bullets
      if (bulletMatch || /^[A-Za-z /&+-]{2,30}:$/.test(t) || plain.length < 140) {
        // Heuristic: short lines & explicit bullets → bullets; long sentences → body
        if (bulletMatch || plain.length < 140) {
          bullets.push(plain);
          bulletMarkers.push(!!bulletMatch);
        } else bodyLines.push(plain);
      } else {
        bodyLines.push(plain);
      }
    }
    // Title: header text up to first "–"/":" else first bullet
    let title = b.header.replace(/[#*]/g, '').trim();
    if (!title && bullets.length > 0) {
      title = bullets.shift()!;
      bulletMarkers.shift();
    }
    title = title.replace(/[.]+$/, '').substring(0, 80) || `Slide ${(b.num ?? results.length + 1)}`;
    const content = [...bodyLines, ...bullets].join('\n');
    results.push({ slideNumber: b.num, title, content, bullets, bulletMarkers, bodyLines });
  }

  // Sort by slide number when present
  results.sort((a, b) => (a.slideNumber ?? 999) - (b.slideNumber ?? 999));

  return results;
}

/** Extract explicit style directives from the prompt (Design Instructions block
 * or inline "Alignment: center", "Font: Poppins", "Color(s): ..."). */
export function parseStyleDirectives(prompt: string): StyleDirectives {
  const out: StyleDirectives = {};
  const lower = prompt.toLowerCase();
  const alignMatch = prompt.match(/align(?:ment)?\s*[:\-–]\s*(left|center|right)/i);
  if (alignMatch) out.align = alignMatch[1].toLowerCase() as StyleDirectives['align'];
  const fontMatch = prompt.match(/font(?:\s*family)?\s*[:\-–]\s*([a-z][a-z0-9 +_-]{2,30})/i);
  if (fontMatch) out.fontFamily = fontMatch[1].trim().toLowerCase().replace(/\s+/g, '');
  const colorMatches = [...prompt.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})/gi)].map((m) => m[0]);
  if (colorMatches.length >= 1) out.primaryColor = colorMatches[0];
  if (colorMatches.length >= 2) out.secondaryColor = colorMatches[1];
  // Named-color hints: "blue theme", "green background" etc.
  if (!out.primaryColor) {
    const named = lower.match(/\b(blue|green|purple|red|orange|teal|indigo|pink)\b.{0,20}(theme|background|color|design)/);
    if (named) out.primaryColor = named[1];
  }
  const bgMatch = prompt.match(/background\s*[:\-–]\s*([a-z#][a-z0-9# +_-]{2,20})/i);
  if (bgMatch) out.background = bgMatch[1].trim();
  // Creation-style directives → behavior flags (never slide content)
  if (/relevant .*visuals|use .*icons?|use .*diagrams?|illustrations|add .*images?|productivity visuals|technology visuals/i.test(prompt)) {
    out.wantsVisuals = true;
  }
  if (/concise|minimal text|easy to read|avoid overcrowding|avoid .*paragraphs/i.test(prompt)) {
    out.concise = true;
  }
  return out;
}

// Detect whether a line is a section header.
// A section header is either:
//   - A line ending with ":" (e.g. "Types of Renewable Energy:")
//   - A line with an inline colon where the part before the colon is a short
//     label (<= 50 chars) and the part after is the content (e.g.
//     "Conclusion: The transition to renewable energy...")
//   - A line with an inline dash where the part before the dash is a short
//     label (e.g. "Advantages - Renewable energy produces...")
function isSectionHeader(line: string): { header: string; content: string } | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  // Line ending with ":" — pure header, content follows on next lines
  if (/[:：]\s*$/.test(trimmed)) {
    return { header: trimmed.replace(/[:：]\s*$/, '').trim(), content: '' };
  }

  // Inline colon: "Header: content"
  const colonIdx = trimmed.search(/[:：]/);
  if (colonIdx > 0 && colonIdx <= 50) {
    const before = trimmed.substring(0, colonIdx).trim();
    const after = trimmed.substring(colonIdx + 1).replace(/^[:：\s]+/, '').trim();
    // The part before the colon must look like a label (no verbs/sentences)
    // Heuristic: short, no period, and either Title Case or a known section word
    if (before.length >= 3 && before.length <= 50 && !/\./.test(before)) {
      const knownSections = /\b(intro|introduction|overview|definition|background|types?|kinds?|categories?|examples?|applications?|advantages?|benefits?|disadvantages?|challenges?|limitations?|future|outlook|conclusion|summary|process|comparison|history|results?|discussion|methodology?|approach|implementation|architecture|components?|features?|requirements?|scope|objectives?|goals?)\b/i;
      const titleCasePattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}$/;
      if (knownSections.test(before) || titleCasePattern.test(before) || before.split(/\s+/).length <= 4) {
        return { header: before, content: after };
      }
    }
  }

  return null;
}

// Parse structured content into content points.
// Handles three formats:
//   1. "Include: X, Y, Z" directive
//   2. Section headers with content (either on the same line or following lines)
//   3. Plain newline/comma-separated lists
function parseContentPoints(text: string): string[] {
  const points: string[] = [];

  // Check for "Include:" or "Include" (with colon) or similar keywords
  const includeMatch = text.match(/(?:^|\n)\s*(?:include|cover|topics|sections|points)\s*[:：]\s*([^]+?)(?:$)/i);
  let listText: string;
  if (includeMatch) {
    listText = includeMatch[1];
  } else {
    listText = text;
  }

  if (!listText || listText.trim().length === 0) return points;

  // Drop creation-directive lines first — they are styling instructions,
  // never slide content.
  const rawLines = listText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isDesignDirectiveLine(l));

  // Check if any line is a section header
  const sectionChecks = rawLines.map((l) => isSectionHeader(l));
  const hasSectionHeaders = sectionChecks.some((s) => s !== null);

  if (hasSectionHeaders) {
    // Group section headers with their following content lines
    const grouped: string[] = [];
    let currentHeader = '';
    let currentContent = '';

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const section = sectionChecks[i];

      if (section) {
        // Save previous group
        if (currentHeader) {
          grouped.push(currentContent ? `${currentHeader}: ${currentContent}` : currentHeader);
        } else if (currentContent) {
          grouped.push(currentContent);
        }
        currentHeader = section.header;
        currentContent = section.content;
      } else if (currentHeader) {
        // Content line under a section header
        currentContent = currentContent ? `${currentContent} ${line}` : line;
      } else {
        // Content before any header — accumulate
        currentContent = currentContent ? `${currentContent} ${line}` : line;
      }
    }
    // Save last group
    if (currentHeader) {
      grouped.push(currentContent ? `${currentHeader}: ${currentContent}` : currentHeader);
    } else if (currentContent) {
      grouped.push(currentContent);
    }

    points.push(...grouped.filter((p) => p.length > 1 && p.length < 1500));
  } else {
    // No section headers — split by newlines, commas, semicolons, or "and"
    const items = listText
      .split(/\n|,|;|\band\b/)
      .map((item) => item.trim())
      .filter((item) => item.length > 1 && item.length < 200 && !isDesignDirectiveLine(item));
    points.push(...items);
  }

  return points.filter((p) => !isDesignDirectiveLine(p));
}

// Heuristic: count "content-bearing" signals in the prompt.
// A prompt with just a topic like "Artificial Intelligence" has very few
// content signals. A prompt with actual content has multiple lines, bullet
// points, slide instructions, or specific factual statements.
function countContentSignals(prompt: string, slideInstructions: ParsedSlideInstruction[], contentPoints: string[]): number {
  let signals = 0;

  // Slide-by-slide instructions are a strong signal
  if (slideInstructions.length >= 2) signals += 3;

  // Content points (Include: X, Y, Z)
  if (contentPoints.length >= 2) signals += 2;
  else if (contentPoints.length === 1) signals += 1;

  // Multiple lines suggest structured content
  const lines = prompt.split(/\n/).filter((l) => l.trim().length > 0);
  if (lines.length >= 3) signals += 2;
  else if (lines.length === 2) signals += 1;

  // Sentences that look like factual statements or instructions
  // (contain a verb and are > 15 chars)
  const sentences = prompt.split(/[.!?]\s+/).filter((s) => s.trim().length > 15);
  if (sentences.length >= 3) signals += 2;
  else if (sentences.length === 2) signals += 1;

  // Keywords that suggest the user is providing content, not just a topic
  const contentKeywords = /\b(include|cover|discuss|explain|describe|focus on|must have|should contain|need to|talk about|present on)\b/i;
  if (contentKeywords.test(prompt)) signals += 1;

  // Colon-separated sections (e.g., "Definition: ...")
  const colonSections = (prompt.match(/[:：]/g) || []).length;
  if (colonSections >= 2) signals += 1;

  // Numbered lists
  if (/\b\d+[.):]\s+\w/.test(prompt)) signals += 1;

  // Long prompt (more than just a topic)
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  if (wordCount > 40) signals += 2;
  else if (wordCount > 20) signals += 1;

  return signals;
}

// Extract the topic from the prompt — the part before content instructions.
function extractTopic(cleanedPrompt: string, slideInstructions: ParsedSlideInstruction[], contentPoints: string[]): string {
  // If there are slide instructions, the topic is before the first "Slide N:"
  if (slideInstructions.length > 0) {
    const firstSlideIdx = cleanedPrompt.search(/slide\s*\d+\s*[:\-–]/i);
    if (firstSlideIdx > 0) {
      return cleanedPrompt.substring(0, firstSlideIdx).trim().replace(/[.,;]+$/, '').trim();
    }
  }

  // If there are content points, the topic is before "Include:" or the first
  // list item.
  if (contentPoints.length > 0) {
    const includeIdx = cleanedPrompt.search(/(?:include|cover|topics|sections|points)\s*[:：]/i);
    if (includeIdx > 0) {
      return cleanedPrompt.substring(0, includeIdx).trim().replace(/[.,;]+$/, '').trim();
    }
    if (includeIdx === 0) {
      // The prompt opens with "Include:" — there is no stated topic, only a
      // content list. Return empty so callers fall back to the settings title
      // instead of using the word "Include" as the deck title.
      return '';
    }
    // If the first content point has a colon (section header format),
    // use the header text as the topic if it looks like a topic
    const firstPoint = contentPoints[0];
    const colonIdx = firstPoint.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 50) {
      const header = firstPoint.substring(0, colonIdx).trim();
      // If the header is short enough to be a topic, use it
      if (header.length >= 3 && header.length <= 60) {
        return header;
      }
    }
    // Topic is the first line (truncated)
    const lines = cleanedPrompt.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length > 1) {
      const firstLine = lines[0].replace(/[.,;]+$/, '').trim();
      // If the first line is very long (a paragraph), truncate to first sentence
      if (firstLine.length > 60) {
        const firstSentence = firstLine.split(/[.]\s+/)[0];
        return firstSentence.length <= 80 ? firstSentence : firstSentence.substring(0, 60);
      }
      return firstLine;
    }
  }

  // No content markers — the whole cleaned prompt is the topic
  return cleanedPrompt;
}

// Detect a Type B prompt: a main topic on the first line followed by a list of
// subtopics (one per line). Example:
//   Operators
//   Arithmetic Operator
//   Assignment Operator
//   Relational Operator
//   Logical Operator
//   Bitwise Operator
//
// Heuristics:
//   - First line is a short noun phrase (the main topic, 2-50 chars)
//   - 2+ subsequent lines, each a short noun phrase (2-60 chars)
//   - No sentence-ending punctuation on most lines (not paragraphs)
//   - No "Slide N:" pattern (those are slideInstructions)
//   - No "Include:" directive
function detectSubtopics(text: string): string[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 3) return [];

  // Reject if any line looks like a slide instruction
  if (lines.some((l) => /^slide\s*\d+\s*[:\-–]/i.test(l))) return [];
  // Reject if first line is an "Include:" directive
  if (/^(include|cover|topics|sections|points)\s*[:：]/i.test(lines[0])) return [];

  const firstLine = lines[0];
  if (firstLine.length < 2 || firstLine.length > 60) return [];

  const subtopicLines = lines.slice(1);
  if (subtopicLines.length < 2) return [];

  // Each subtopic line should be a short noun phrase, not a full sentence.
  // Heuristic: < 60 chars, no sentence-ending period, doesn't start with a verb
  const verbStarters = /^(is|are|was|were|the|this|these|those|that|it|there|in|on|at|for|with|by|to|of|from|when|where|why|how|do|does|did|can|could|should|would|will|has|have|had|please|use|add|create|make|include|ensure|keep|maintain)\b/i;
  const validSubtopics = subtopicLines.filter((l) => {
    if (l.length < 2 || l.length > 60) return false;
    if (/\.\s*$/.test(l) && l.split(/\s+/).length > 6) return false; // long sentence with period
    if (verbStarters.test(l) && l.split(/\s+/).length > 4) return false; // sentence-like
    return true;
  });

  // At least 2 valid subtopics, and they should be the majority
  if (validSubtopics.length < 2) return [];
  if (validSubtopics.length < subtopicLines.length - 1) return [];

  // Reject if the lines look like a paragraph split by newlines (all very long)
  const avgLen = validSubtopics.reduce((a, l) => a + l.length, 0) / validSubtopics.length;
  if (avgLen > 50) return [];

  return validSubtopics;
}

// Detect a multi-topic prompt: a list of independent topics, one per line.
// Supported formats:
//   1. Numbered:  "1. Topic\n2. Topic\n3. Topic"
//   2. Bulleted:   "* Topic\n* Topic" or "- Topic\n- Topic"
//   3. Line-by-line: "Topic\nTopic\nTopic"
//
// Heuristics:
//   - At least 2 non-empty lines
//   - Each line is a short noun phrase (2-80 chars), not a full sentence
//   - No "Slide N:" pattern (those are slideInstructions)
//   - No "Include:" directive
//   - Lines don't end with sentence-ending periods (unless very short)
//   - The first line is NOT a standalone topic header (that would be subtopics)
//     — i.e. there's no "main topic + sub-list" structure
function detectMultiTopics(text: string): string[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // Reject if any line looks like a slide instruction
  if (lines.some((l) => /^slide\s*\d+\s*[:\-–]/i.test(l))) return [];
  // Reject if first line is an "Include:" directive
  if (/^(include|cover|topics|sections|points)\s*[:：]/i.test(lines[0])) return [];

  // Strip leading list markers (1., 1), *, -, •) from each line
  const stripMarker = (l: string): string => l.replace(/^\s*(\d+[.):]\s+|[*\-–•]\s+)/, '').trim();

  // Check if lines have consistent list markers (numbered or bulleted)
  const numberedPattern = /^\s*\d+[.):]\s+\S/;
  const bulletPattern = /^\s*[*\-–•]\s+\S/;
  const numberedCount = lines.filter((l) => numberedPattern.test(l)).length;
  const bulletCount = lines.filter((l) => bulletPattern.test(l)).length;

  // Require ALL lines to have the same marker type — this distinguishes a
  // multi-topic list (all numbered/bulleted) from a main-topic + sub-list
  // (first line unnumbered, rest numbered).
  const hasNumbered = numberedCount === lines.length;
  const hasBullet = bulletCount === lines.length;

  // If not explicitly numbered or bulleted, check if plain lines look like topics
  // (short, no sentence-ending punctuation, no verb-starter sentences)
  let candidates: string[];
  if (hasNumbered || hasBullet) {
    candidates = lines.map(stripMarker);
  } else {
    // Reject if some lines have markers but not all — that's a subtopic pattern
    if (numberedCount > 0 || bulletCount > 0) return [];
    // Plain line-by-line: each line must be a short topic-like phrase
    candidates = lines;
  }

  // Validate each candidate: short, not a sentence, not a directive
  const verbStarters = /^(is|are|was|were|the|this|these|those|that|it|there|in|on|at|for|with|by|to|of|from|when|where|why|how|do|does|did|can|could|should|would|will|has|have|had|please|use|add|create|make|include|ensure|keep|maintain|discuss|explain|describe|focus|talk|present)\b/i;
  const valid = candidates.filter((l) => {
    if (l.length < 2 || l.length > 80) return false;
    // Reject lines that look like full sentences (end with period and are long)
    if (/\.\s*$/.test(l) && l.split(/\s+/).length > 6) return false;
    // Reject lines that start with a verb and are sentence-like
    if (verbStarters.test(l) && l.split(/\s+/).length > 4) return false;
    // Reject lines with colons (section headers, not independent topics)
    if (/[:：]/.test(l) && l.indexOf(':') < 50) return false;
    return true;
  });

  // All lines must be valid topics (allow at most 1 invalid for robustness)
  if (valid.length < 2) return [];
  if (valid.length < candidates.length - 1) return [];

  return candidates;
}

export function detectContent(prompt: string): ContentDetection {
  const trimmed = prompt.trim();

  // Mode: empty — no topic and no content
  if (trimmed.length === 0) {
    return {
      mode: 'empty',
      topic: '',
      title: 'Untitled Presentation',
      slideInstructions: [],
      contentPoints: [],
      subtopics: [],
      multiTopics: [],
      requestedSlideCount: null,
      explicitSlideCount: false,
      cleanedPrompt: '',
    };
  }

  const cleanedPrompt = stripBoilerplate(trimmed);
  const slideInstructions = parseSlideInstructions(cleanedPrompt);
  const contentPoints = parseContentPoints(cleanedPrompt);
  const requestedSlideCount = extractSlideCount(trimmed);
  const explicitSlideCount = requestedSlideCount !== null || slideInstructions.length >= 2;
  const subtopics = detectSubtopics(cleanedPrompt);
  const multiTopics = detectMultiTopics(cleanedPrompt);
  const topic = extractTopic(cleanedPrompt, slideInstructions, contentPoints);
  // The prompt opens with "Include:"-style directive — there is no stated
  // topic, so the deck title must come from settings instead.
  const includeLead = cleanedPrompt.trimStart().search(/^(?:include|cover)\s*[:：]/i) === 0;
  const title = titleCase(topic || (includeLead ? '' : cleanedPrompt));
  const signals = countContentSignals(cleanedPrompt, slideInstructions, contentPoints);

  // Multi-topic mode takes priority: each line is an independent topic = one slide.
  // When all lines have consistent markers (numbered/bulleted), it's multi-topic,
  // not subtopics (which requires a main topic header + sub-list).
  if (multiTopics.length >= 2 && slideInstructions.length === 0) {
    return {
      mode: 'multi-topic',
      topic,
      title,
      slideInstructions,
      contentPoints,
      subtopics,
      multiTopics,
      requestedSlideCount: multiTopics.length,
      explicitSlideCount: false,
      cleanedPrompt,
    };
  }

  // Determine mode based on content signals
  // 0-1 signals = topic only (research mode)
  // 2+ signals = user has provided content (user-content mode)
  // Subtopics also count as user-content (Type B prompt)
  const mode: GenerationMode = (signals >= 2 || subtopics.length >= 2) ? 'user-content' : 'research';

  return {
    mode,
    topic,
    title,
    slideInstructions,
    contentPoints,
    subtopics,
    multiTopics: [],
    requestedSlideCount,
    explicitSlideCount,
    cleanedPrompt,
  };
}
