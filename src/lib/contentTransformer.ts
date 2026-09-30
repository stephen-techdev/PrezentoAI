// ─────────────────────────────────────────────────────────────────────────────
// Content transformation engine for user-provided content.
//
// Converts raw user text into presentation-ready material:
//   User content → analyze → extract key points → summarize → bullets + notes
//
// This module does NOT copy-paste raw text onto slides. It transforms
// paragraphs into concise bullets, generates speaker notes from detailed
// explanations, and selects appropriate layouts based on content type.
// ─────────────────────────────────────────────────────────────────────────────

import type { SlideLayout } from '../types';
import { uid } from './id';

// ── Text analysis ────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'for', 'to', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'by', 'as', 'at', 'from',
  'this', 'that', 'these', 'those', 'it', 'its', 'about', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'up', 'down', 'over', 'under',
  'again', 'can', 'could', 'should', 'would', 'may', 'might', 'must', 'shall',
  'will', 'has', 'have', 'had', 'do', 'does', 'did', 'not', 'no', 'nor', 'so',
  'than', 'too', 'very', 'just', 'also', 'only', 'such', 'some', 'any', 'all',
  'both', 'each', 'few', 'more', 'most', 'other', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom',
]);

interface SentenceInfo {
  text: string;
  wordCount: number;
  position: number;
  hasNumbers: boolean;
  hasDefinition: boolean;
  hasComparison: boolean;
  hasProcess: boolean;
  hasList: boolean;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

function analyzeSentence(text: string, position: number): SentenceInfo {
  const lower = text.toLowerCase();
  return {
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    position,
    hasNumbers: /\d+/.test(text),
    hasDefinition: /\b(is|are|means|refers to|defined as|consists of|involves)\b/i.test(text),
    hasComparison: /\b(vs|versus|compared to|whereas|while|unlike|whereas|contrast|difference|better than|worse than)\b/i.test(lower),
    hasProcess: /\b(step|phase|stage|first|second|third|then|next|finally|process|procedure|workflow|begin|start|end)\b/i.test(lower),
    hasList: /\b(include|contain|comprise|types|kinds|categories|examples|such as|like|namely)\b/i.test(lower),
  };
}

/**
 * Extract individual items from a sentence that contains a list pattern.
 * e.g. "It encompasses machine learning, NLP, computer vision, and robotics"
 *      → ["machine learning", "NLP", "computer vision", "robotics"]
 * Returns [] if no list pattern is found.
 */
export function extractListItems(sentence: string): string[] {
  // Pattern: "in X for Y, in X for Y, and in X for Y"
  // Each item starts with a preposition → split on comma+preposition boundary
  const prepList = sentence.match(
    /\b(?:in|for|at|on|during|across|within)\s+[^,;]{3,60}(?:,\s*(?:and\s+)?(?:in|for|at|on|during|across|within)\s+[^,;]{3,60})+/i,
  );
  if (prepList) {
    const items = prepList[0]
      .split(/,\s*(?=(?:and\s+)?(?:in|for|at|on|during|across|within)\s)/i)
      .map((s) => s.replace(/^and\s+/i, '').trim())
      .filter((s) => s.length > 3 && s.length < 80);
    if (items.length >= 2) return items;
  }

  // Strip the leading clause up to the list-introducing phrase
  const listIntro = sentence.match(
    /\b(?:such as|including|includes?|encompasses?|consists of|contains?|comprises?|namely|for example|for instance)\s*[:]?\s*/i,
  );
  let listPart: string;
  if (listIntro && listIntro.index !== undefined) {
    listPart = sentence.substring(listIntro.index! + listIntro[0].length);
  } else {
    // Try stripping "X includes Y" → "Y"
    const verbIntro = sentence.match(/\b(?:includes?|involves|covers?|spans?)\s+(.{10,})/i);
    if (verbIntro) {
      listPart = verbIntro[1];
    } else {
      const colonMatch = sentence.match(/[:：]\s*(.+)/);
      if (colonMatch) {
        listPart = colonMatch[1];
      } else {
        // Detect plain comma-separated lists (even with lowercase items)
        // e.g. "Rising global temperatures, melting ice caps, sea level rise,
        //        more frequent extreme weather events, and disruption of..."
        const plainCommaItems = sentence.split(/,\s*/);
        if (plainCommaItems.length >= 3 && plainCommaItems[0].length < 60
            && plainCommaItems[0].length > 3) {
          listPart = sentence;
        } else {
          return [];
        }
      }
    }
  }

  const items = listPart
    .split(/,\s*|;\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 80)
    // Split on "and" only when both sides are substantial (> 10 chars)
    // This prevents splitting "impact on employment and society" into "impact" + "society"
    .flatMap((s) => {
      const andSplit = s.split(/\s+and\s+/);
      if (andSplit.length === 2 && andSplit[0].length > 10 && andSplit[1].length > 10) {
        return andSplit.map((p) => p.trim());
      }
      return [s];
    })
    .map((s) => s.replace(/^(the|a|an|and)\s+/i, '').trim())
    .filter((s) => s.length > 2)
    .map((s) => {
      // Strip trailing prepositional phrases like "around bias" from "Ethical considerations around bias"
      // but only if the remaining part is still meaningful (longer than 12 chars)
      const withoutTrailingPrep = s.replace(/\s+(?:around|about|of|on|in|for|at|with|to)\s+.+$/i, '').trim();
      return withoutTrailingPrep.length >= 12 ? withoutTrailingPrep : s;
    })
    // Filter out items that are too short to be meaningful (< 5 chars)
    .filter((s) => s.length >= 5)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return items;
}

// ── Bullet extraction ────────────────────────────────────────────────────────

/**
 * Filter out user instructions/directives that should never appear on a slide.
 * These are meta-instructions like "Include a brief objective", "Keep the
 * language simple", "Use relevant visuals", "Divide into Frontend and Backend"
 * — they tell the AI what to do, not what to display.
 */
const INSTRUCTION_PATTERNS = [
  /^(include|add|show|use|keep|make|ensure|do not|don't|avoid|put|place|set|create|divide|provide|present|explain|describe|discuss|cover|focus|emphasize|highlight|mention|note|remember|consider|maintain|follow|start with|end with|begin with)\b/i,
  /^(should|must|need to|have to|want to|please|try to|aim to|remember to)\b/i,
  /\b(relevant (visuals?|images?|illustrations?|icons?|diagrams?))\b/i,
  /\b(visual (hierarchy|style|guidance))\b/i,
  /\b(consistent theme|good visual|professional college|minimal text|clean design)\b/i,
  /\b(different (appropriate )?layouts? for different slides)\b/i,
  /\b(suitable for a college student|do not make.*overly technical|keep.*simple|keep.*concise|natural language)\b/i,
  /\b(brief objective|short intro|quick overview)\b/i,
];

function isInstructionPhrase(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  // Only flag as instruction if the phrase starts with an instruction verb
  // AND is relatively short (instructions are usually short directives)
  if (trimmed.length > 200) return false;
  return INSTRUCTION_PATTERNS.some((re) => re.test(trimmed));
}

export function filterInstructions(text: string): string {
  // Remove instruction lines from multi-line content
  const lines = text.split(/\n/);
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;
    return !isInstructionPhrase(trimmed);
  });
  if (filtered.length === 0) return text.trim(); // don't return empty
  return filtered.join('\n').trim();
}

/**
 * Extract concise bullet points from a block of text.
 * Converts paragraphs into 3-5 short, punchy points suitable for slides.
 */
export function extractBullets(text: string, maxBullets = 5): { id: string; text: string }[] {
  if (!text || text.trim().length === 0) return [];

  // Filter out instruction/directive phrases before processing
  const cleaned = filterInstructions(text.trim());

  // Case 1: Already a list (newline or semicolon-separated items)
  // Only split on newlines/semicolons — NOT commas, since commas in paragraphs
  // are natural sentence pauses, not list delimiters
  const listItems = cleaned
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 200);

  if (listItems.length >= 3) {
    return listItems.slice(0, maxBullets).map((item) => ({
      id: uid('bl'),
      text: condenseBullet(item),
    }));
  }

  // Case 2: Colon-separated (Title: description)
  const colonParts = cleaned.split(/[:：]/).map((s) => s.trim()).filter(Boolean);
  if (colonParts.length >= 3) {
    // Each pair forms a bullet
    const bullets: { id: string; text: string }[] = [];
    for (let i = 0; i < colonParts.length - 1; i += 2) {
      if (bullets.length >= maxBullets) break;
      const label = colonParts[i];
      const desc = colonParts[i + 1] || '';
      bullets.push({
        id: uid('bl'),
        text: desc.length > 0 ? `${label}: ${condenseBullet(desc)}` : condenseBullet(label),
      });
    }
    return bullets;
  }

  // Case 3: Sentences — extract key points from paragraph text
  const sentences = splitSentences(cleaned);
  if (sentences.length === 0) {
    return [{ id: uid('bl'), text: condenseBullet(cleaned) }];
  }

  // Case 3a: Single long sentence with list pattern → split into sub-bullets
  // e.g. "It encompasses machine learning, natural language processing,
  //        computer vision, and robotics" → 4 bullets
  if (sentences.length <= 2) {
    const subBullets = extractListItems(sentences.join(' '));
    if (subBullets.length >= 3) {
      return subBullets.slice(0, maxBullets).map((text) => ({
        id: uid('bl'),
        text: condenseBullet(text),
      }));
    }
  }

  // Case 3b: Multiple sentences — one bullet per sentence (condensed)
  // Do NOT further split sentences into comma fragments. Each sentence
  // is already a self-contained idea suitable for one bullet.
  if (sentences.length >= 3) {
    return sentences.slice(0, maxBullets).map((s) => ({
      id: uid('bl'),
      text: condenseBullet(s),
    }));
  }

  // Case 3c: 2 sentences — try list extraction, then one bullet per sentence
  const phraseBullets: { id: string; text: string }[] = [];
  for (const s of sentences) {
    if (phraseBullets.length >= maxBullets) break;
    phraseBullets.push({ id: uid('bl'), text: condenseBullet(s) });
  }
  if (phraseBullets.length > 0) {
    return phraseBullets;
  }

  // Fallback: condense each sentence
  return sentences.slice(0, maxBullets).map((s) => ({
    id: uid('bl'),
    text: condenseBullet(s),
  }));
}

/**
 * Condense a sentence or phrase into a concise bullet point.
 * Removes filler words, shortens verbose constructions, and limits length.
 */
function condenseBullet(text: string): string {
  let result = text.trim();

  // Remove leading transition phrases and time adverbs
  result = result.replace(
    /^(furthermore|moreover|additionally|in addition|however|therefore|thus|hence|consequently|as a result|for example|for instance|such as|namely|in particular|specifically|today|currently|now|recently|modern|nowadays|presently|now)[,:\s]+/i,
    '',
  );

  // Remove "It is" / "There is" / "There are" openings
  result = result.replace(/^(it is (?:important to note that|worth noting that|clear that)|there (?:is|are) (?:also )?)(?:some |several |many |various |a |an |the )?/i, '');

  // Convert "X is a Y that does Z" → "Y that does Z"
  result = result.replace(/^(this|these|that|those)\s+(is|are)\s+/i, '');

  // Strip trailing verb clauses: "X represents/describes/shows Y" → "X"
  const stripPredicate = result.match(/^(.{10,70}?)\s+(?:represents?|describes?|shows?|illustrates?|demonstrates?|exemplifies?|embodies|constitutes?|forms?|provides?|offers?|enables?|allows?|supports?|facilitates?)\s+.{5,}$/i);
  if (stripPredicate) {
    result = stripPredicate[1].trim();
  }

  // Strip leading "The/This X began/started/evolved Y" → keep Y
  const stripSubjectVerb = result.match(/^(?:the|this|these|that|those|a|an)\s+\w+\s+(?:began|started|originated|emerged|evolved|developed|grew|expanded|appeared|arose)\s+(.{5,})/i);
  if (stripSubjectVerb) {
    result = stripSubjectVerb[1].trim();
  }

  // Strip leading "In/At/On the X" → keep just the time reference (for timeline bullets)
  // e.g. "In the 1950s with the Dartmouth Conference and has evolved..." → "1950s"
  const stripPrepPhrase = result.match(/^(?:in|at|on)\s+(?:the\s+)?(\d{4}s?)/i);
  if (stripPrepPhrase) {
    result = stripPrepPhrase[1].trim();
  }

  // Remove trailing periods
  result = result.replace(/[.]+$/, '');

  // Shorten common verbose phrases
  const shortenings: [RegExp, string][] = [
    [/\bin order to\b/gi, 'to'],
    [/\bdue to the fact that\b/gi, 'because'],
    [/\bat this point in time\b/gi, 'now'],
    [/\bin the event that\b/gi, 'if'],
    [/\ba large number of\b/gi, 'many'],
    [/\ba majority of\b/gi, 'most'],
    [/\bwith regard to\b/gi, 'about'],
    [/\bin spite of the fact that\b/gi, 'although'],
    [/\butilization\b/gi, 'use'],
    [/\bapproximately\b/gi, '~'],
    [/\bcommencement\b/gi, 'start'],
    [/\bsubsequently\b/gi, 'then'],
    [/\bprior to\b/gi, 'before'],
    [/\bsubsequent to\b/gi, 'after'],
    [/\bin the context of\b/gi, 'in'],
    [/\bwith respect to\b/gi, 'for'],
    [/\bfor the purpose of\b/gi, 'for'],
    [/\bthe majority of\b/gi, 'most'],
    [/\ba number of\b/gi, 'several'],
    [/\bis able to\b/gi, 'can'],
    [/\bhas the ability to\b/gi, 'can'],
    [/\bhas the capability to\b/gi, 'can'],
  ];
  for (const [re, rep] of shortenings) {
    result = result.replace(re, rep);
  }

  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);

  // Hard limit: if still very long, extract the core clause
  if (result.length > 80) {
    // Try to find the main clause by splitting at conjunctions/relative pronouns
    const clauseBreak = result.search(/\s+(?:that|which|where|when|because|although|while|whereas|so that|in order to|such as)\s+/i);
    if (clauseBreak > 15 && clauseBreak < 80) {
      result = result.substring(0, clauseBreak);
    } else {
      // Try splitting at "for" (purpose clause) or "to" (infinitive)
      const purposeBreak = result.search(/\s+(?:for|to)\s+/i);
      if (purposeBreak > 15 && purposeBreak < 80) {
        result = result.substring(0, purposeBreak);
      } else {
        const cutAt = result.lastIndexOf(',', 75);
        if (cutAt > 40) {
          result = result.substring(0, cutAt);
        } else {
          const cutAtSpace = result.lastIndexOf(' ', 75);
          result = result.substring(0, cutAtSpace > 40 ? cutAtSpace : 75);
        }
      }
    }
  }

  return result.trim();
}

// ── Body text summarization ──────────────────────────────────────────────────

/**
 * Create a short subtitle/body summary from longer text.
 * Extracts the core idea in 1-2 sentences, max ~120 chars.
 */
export function summarizeBody(text: string, maxLen = 120): string {
  if (!text || text.trim().length === 0) return '';

  // Filter out instruction/directive phrases
  const trimmed = filterInstructions(text.trim());
  if (trimmed.length === 0) return '';

  // If already short enough, clean it up
  if (trimmed.length <= maxLen) {
    return trimmed.replace(/[.]+$/, '').trim();
  }

  // Try to extract a concise summary phrase rather than a full sentence.
  // Pattern: "X is/are/refers to/means Y" → just "Y" (the definition part)
  const defRegex = new RegExp(
    `^.{5,40}?\\s+(?:is|are|refers to|means|involves|consists of|encompasses|represents|describes)\\s+(.{10,${maxLen}})`,
    'i',
  );
  const defMatch = trimmed.match(defRegex);
  if (defMatch) {
    let def = defMatch[1].trim();
    // Cut at first sentence boundary or list intro
    def = def.split(/\.\s/)[0].trim();
    // If the regex captured up to maxLen, it likely cut mid-word — trim to word boundary
    if (def.length >= maxLen - 1) {
      const lastSpace = def.lastIndexOf(' ');
      if (lastSpace > 15) def = def.substring(0, lastSpace).trim();
    }
    if (def.length > 10) {
      // If too long, truncate at a natural break (comma, semicolon, or conjunction)
      if (def.length > maxLen) {
        const cutAt = def.search(/[,;]|\s+(?:such as|including|like|for example)\s/i);
        if (cutAt > 15 && cutAt < maxLen) {
          def = def.substring(0, cutAt);
        } else {
          // Truncate at word boundary, not mid-word
          const truncated = def.substring(0, maxLen - 3);
          const lastSpace = truncated.lastIndexOf(' ');
          def = (lastSpace > 15 ? truncated.substring(0, lastSpace) : truncated).trim() + '...';
        }
      }
      // Capitalize first letter since we stripped the subject
      def = def.charAt(0).toUpperCase() + def.slice(1);
      return def.replace(/[.]+$/, '').trim();
    }
  }

  // Take the first informative sentence
  const sentences = splitSentences(trimmed);
  if (sentences.length === 0) return trimmed.substring(0, maxLen);

  // Find the most information-dense sentence
  const analyzed = sentences.map((s, i) => analyzeSentence(s, i));
  const scoreOf = (s: SentenceInfo): number =>
    (s.wordCount >= 10 && s.wordCount <= 25 ? 2 : 0) +
    (s.hasDefinition ? 3 : 0) + (s.hasList ? 1 : 0) + (s.position === 0 ? 1 : 0);
  const best = analyzed.reduce((best, s) => {
    return scoreOf(s) > scoreOf(best) ? s : best;
  }, analyzed[0]);

  let result = best.text.replace(/[.]+$/, '').trim();

  // If still too long, truncate at a natural break
  if (result.length > maxLen) {
    const cutAt = result.lastIndexOf(',', maxLen - 10);
    if (cutAt > 40) {
      result = result.substring(0, cutAt);
    } else {
      const truncated = result.substring(0, maxLen - 3);
      const lastSpace = truncated.lastIndexOf(' ');
      result = (lastSpace > 15 ? truncated.substring(0, lastSpace) : truncated).trim() + '...';
    }
  }

  return result;
}

// ── Speaker notes generation ─────────────────────────────────────────────────

/**
 * Generate detailed speaker notes from the full user content.
 * The slide stays concise; the notes preserve the detailed explanation.
 */
export function generateNotesFromContent(
  fullContent: string,
  slideTitle: string,
  bullets: { text: string }[],
  duration?: number,
): string {
  if (!fullContent || fullContent.trim().length === 0) {
    return `Discuss ${slideTitle}. Elaborate on the key points with examples.`;
  }

  const sentences = splitSentences(fullContent);
  const notes: string[] = [];

  // Include the full original explanation that doesn't fit on the slide
  const bulletTexts = new Set(bullets.map((b) => b.text.toLowerCase().substring(0, 30)));
  const extraSentences = sentences.filter(
    (s) => !bulletTexts.has(s.toLowerCase().substring(0, 30)),
  );

  if (extraSentences.length > 0) {
    // Include the fuller explanation, capped at 3 sentences
    notes.push(extraSentences.slice(0, 3).join(' '));
  }

  // Add a delivery hint
  const timeHint = duration
    ? ` Allow about ${Math.round(duration / 6)} minutes.`
    : '';
  notes.push(`Elaborate on each point with a concrete example.${timeHint}`);

  return notes.join(' ');
}

// ── Layout selection ─────────────────────────────────────────────────────────

/**
 * Analyze the content and title to recommend the best layout.
 * This replaces the old approach of using the same layout for every slide.
 */
export function chooseLayout(title: string, content: string, hasMultipleItems: boolean): SlideLayout {
  const lower = (title + ' ' + content).toLowerCase();

  // Comparison content
  if (/\b(vs\.?|versus|compare|comparison|difference between|pros.*cons|advantages.*disadvantages|whereas|contrast)\b/i.test(lower)) {
    return 'comparison';
  }

  // Timeline / chronological
  if (/\b(timeline|history|evolution|chronology|milestones|journey|phases?|stages?|chronological)\b/i.test(lower)) {
    if (/\b(19|20)\d{2}\b/.test(content) || /\b(year|decade|century|era)\b/i.test(lower)) {
      return 'timeline';
    }
  }

  // Process / steps
  if (/\b(process|steps?|how to|procedure|workflow|methodology|algorithm|pipeline|workflow)\b/i.test(lower)) {
    if (/\b(step|phase|stage)\s*\d/i.test(content) || /\b(first|second|third|then|next|finally)\b/i.test(lower)) {
      return 'process';
    }
  }

  // Statistics / data
  if (/\b(statistics|stats|data|numbers|metrics|kpi|growth|results?|figures|performance)\b/i.test(lower)) {
    if (/\d+%/.test(content) || /[$₹€£]\d/.test(content) || /\b\d{2,}\b/.test(content)) {
      return 'statistics';
    }
  }

  // Multiple items → cards
  if (hasMultipleItems) {
    const items = content.split(/[;\n]|,\s*(?=[A-Z])|\band\b/).filter((s) => s.trim().length > 2);
    if (items.length >= 4) return 'cards';
  }

  // Definition → two-column with body
  if (/\b(definition|what is|meaning|refers to|defined as|introduction|overview|background)\b/i.test(lower)) {
    return 'two-column';
  }

  // Types/categories → cards or table
  if (/\b(types|kinds|categories|classification|varieties|forms)\b/i.test(lower)) {
    return 'cards';
  }

  // Features/advantages → two-column with bullets
  if (/\b(features?|advantages|benefits|characteristics|properties|aspects?)\b/i.test(lower)) {
    return 'two-column';
  }

  // Applications/examples → cards
  if (/\b(applications?|examples?|use cases?|real.world|case stud)/i.test(lower)) {
    return 'cards';
  }

  // Challenges/issues → two-column
  if (/\b(challenges?|issues?|problems?|limitation|disadvantages?|risks?|threats?)\b/i.test(lower)) {
    return 'two-column';
  }

  // Future/trends → two-column
  if (/\b(future|trends?|outlook|predictions?|forecast|emerging)\b/i.test(lower)) {
    return 'two-column';
  }

  // Conclusion/summary → two-column
  if (/\b(conclusion|summary|key takeaways?|closing|final|wrap.up)\b/i.test(lower)) {
    return 'two-column';
  }

  // Default
  return 'two-column';
}

// ── Slide title cleaning ─────────────────────────────────────────────────────

/**
 * Clean up a raw section heading into a professional slide title.
 */
export function cleanSlideTitle(raw: string): string {
  let title = raw.trim();

  // Remove "Slide N:" prefix if present
  title = title.replace(/^slide\s*\d+\s*[:\-–]\s*/i, '');

  // Remove trailing punctuation
  title = title.replace(/[.]+$/, '');

  // Remove numbering like "1.", "1)", "1-"
  title = title.replace(/^\d+[.):-]\s+/, '');

  // Title case for short titles, leave longer ones as-is
  if (title.length < 50 && title === title.toLowerCase()) {
    title = title
      .split(' ')
      .map((w) => (STOPWORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')
      .replace(/^./, (c) => c.toUpperCase());
  }

  // Capitalize first letter regardless
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return title;
}

// ── Quality check ────────────────────────────────────────────────────────────

export interface SlideQualityIssue {
  slideIndex: number;
  issue: 'overloaded' | 'no-content' | 'repeated-text' | 'layout-mismatch';
  severity: 'warning' | 'error';
  fix?: string;
}

/**
 * Check slides for quality issues before returning the presentation.
 * Returns a list of issues found.
 */
export function qualityCheck(slides: {
  layout: SlideLayout;
  title: string;
  body?: string;
  bullets?: { text: string }[];
  notes?: string;
}[]): SlideQualityIssue[] {
  const issues: SlideQualityIssue[] = [];

  const seenText = new Set<string>();

  slides.forEach((slide, i) => {
    // Check for overloaded slides (too much text)
    const bodyLen = slide.body?.length || 0;
    const bulletCount = slide.bullets?.length || 0;
    const totalText = bodyLen + (slide.bullets || []).reduce((acc, b) => acc + b.text.length, 0);

    if (totalText > 300) {
      issues.push({
        slideIndex: i,
        issue: 'overloaded',
        severity: 'error',
        fix: 'Reduce body text and move detail to speaker notes',
      });
    }

    if (bulletCount > 6) {
      issues.push({
        slideIndex: i,
        issue: 'overloaded',
        severity: 'warning',
        fix: 'Limit to 5 bullets maximum',
      });
    }

    // Check for empty slides
    if (!slide.title && !slide.body && (!slide.bullets || slide.bullets.length === 0)) {
      issues.push({
        slideIndex: i,
        issue: 'no-content',
        severity: 'error',
        fix: 'Add content or remove slide',
      });
    }

    // Check for repeated text across slides
    const slideTextKey = (slide.body || '').substring(0, 50).toLowerCase();
    if (slideTextKey.length > 10) {
      if (seenText.has(slideTextKey)) {
        issues.push({
          slideIndex: i,
          issue: 'repeated-text',
          severity: 'warning',
          fix: 'Vary content between slides',
        });
      }
      seenText.add(slideTextKey);
    }
  });

  return issues;
}

/**
 * Fix overloaded slides by trimming body text and moving detail to notes.
 */
export function fixOverloadedSlide(slide: {
  body?: string;
  bullets?: { id: string; text: string }[];
  notes?: string;
  layout: SlideLayout;
}): { body?: string; bullets?: { id: string; text: string }[]; notes?: string } {
  let body = slide.body;
  let bullets = slide.bullets;
  let notes = slide.notes;

  // Trim body to max 150 chars
  if (body && body.length > 150) {
    const fullBody = body;
    body = summarizeBody(fullBody, 150);
    // Move the full text to notes
    notes = (notes || '') + ' ' + fullBody;
  }

  // Limit bullets to 5
  if (bullets && bullets.length > 5) {
    const removed = bullets.slice(5);
    bullets = bullets.slice(0, 5);
    // Move removed bullets to notes
    const removedText = removed.map((b) => b.text).join('. ');
    notes = (notes || '') + ' ' + removedText;
  }

  return { body, bullets, notes };
}

// ── Content analysis & slide planning ───────────────────────────────────────

export interface PlannedSlide {
  title: string;
  content: string;
  layout: SlideLayout;
}

/**
 * Analyze raw user content and produce a slide plan.
 *
 * Instead of mechanically chunking sentences into equal groups, this function
 * identifies topical shifts in the text and groups sentences into logical
 * sections. Each section becomes a planned slide with a meaningful title and
 * an appropriate layout.
 *
 * Pipeline: raw text → split into sentences → detect topical boundaries →
 * group into sections → generate titles → choose layouts → return plan
 */
export function analyzeAndPlanContent(
  rawContent: string,
  targetSlideCount: number,
  topic: string,
): PlannedSlide[] {
  return _analyzeAndPlanContent(rawContent, targetSlideCount, topic);
}

function _analyzeAndPlanContent(
  rawContent: string,
  targetSlideCount: number,
  topic: string,
): PlannedSlide[] {
  const trimmed = (rawContent || '').trim();
  if (trimmed.length === 0) return [];

  const sentences = splitSentences(trimmed);
  if (sentences.length === 0) return [];

  // Step 1: Score each sentence for content type signals
  const analyzed = sentences.map((s, i) => {
    const info = analyzeSentence(s, i);
    let topicHint = '';

    if (info.hasDefinition) topicHint = 'definition';
    else if (/\b(types?|kinds?|categories?|varieties|forms|classification)\b/i.test(s)) topicHint = 'types';
    else if (/\b(applications?|uses?|use cases?|examples?|real.world|case stud)/i.test(s)) topicHint = 'applications';
    else if (/\b(advantage|benefit|strength|positive|pro\b)/i.test(s)) topicHint = 'advantages';
    else if (/\b(challenge|limitation|risk|disadvantage|weakness|threat|con\b)/i.test(s)) topicHint = 'challenges';
    else if (/\b(future|trends?|outlook|predictions?|forecast|emerging|upcoming)\b/i.test(s)) topicHint = 'future';
    else if (/\b(began|started|originated|founded|established|history|evolution|milestone)\b/i.test(s)) topicHint = 'history';
    else if (/\b(today|currently|now|recent|modern|current)\b/i.test(s)) topicHint = 'current';
    else if (/\b(step|phase|stage|process|procedure|workflow|how to)\b/i.test(s)) topicHint = 'process';
    else if (/\b(compare|comparison|vs\.?|versus|whereas|contrast|difference)\b/i.test(s)) topicHint = 'comparison';
    else if (/\b(conclusion|summary|takeaway|closing|final|wrap)\b/i.test(s)) topicHint = 'conclusion';
    else if (info.hasNumbers) topicHint = 'statistics';

    return { ...info, topicHint };
  });

  // Step 2: Group sentences into sections based on topic shifts
  const sections: { sentences: string[]; topicHint: string; startIndex: number }[] = [];
  let currentGroup: string[] = [analyzed[0].text];
  let currentHint = analyzed[0].topicHint;
  let groupStart = 0;

  for (let i = 1; i < analyzed.length; i++) {
    const s = analyzed[i];
    const prevHint = analyzed[i - 1].topicHint;

    // Start a new section when:
    // 1. Topic hint changes to a non-empty value (strong signal)
    // 2. Previous group has at least 1 sentence
    const hintChanged = s.topicHint !== '' && s.topicHint !== currentHint && s.topicHint !== prevHint;
    const groupLongEnough = currentGroup.length >= 1;

    if (hintChanged && groupLongEnough) {
      sections.push({ sentences: currentGroup, topicHint: currentHint, startIndex: groupStart });
      currentGroup = [s.text];
      currentHint = s.topicHint;
      groupStart = i;
    } else {
      currentGroup.push(s.text);
      // Update hint if current was empty and we find one
      if (currentHint === '' && s.topicHint !== '') currentHint = s.topicHint;
    }
  }
  // Push the last group
  if (currentGroup.length > 0) {
    sections.push({ sentences: currentGroup, topicHint: currentHint, startIndex: groupStart });
  }

  // Step 3: Adjust section count to match target slide count
  const adjusted = sections.slice();

  // When targetSlideCount is 0, use the natural section count (content-driven)
  const effectiveTarget = targetSlideCount > 0 ? targetSlideCount : adjusted.length;

  // Merge small sections if we have too many
  while (adjusted.length > effectiveTarget) {
    // Find the smallest section and merge it with its neighbor
    let minIdx = 0;
    let minLen = Infinity;
    for (let i = 0; i < adjusted.length; i++) {
      if (adjusted[i].sentences.length < minLen) {
        minLen = adjusted[i].sentences.length;
        minIdx = i;
      }
    }
    const mergeTarget = minIdx > 0 ? minIdx - 1 : 0;
    adjusted[mergeTarget].sentences = adjusted[mergeTarget].sentences.concat(adjusted[minIdx].sentences);
    adjusted.splice(minIdx, 1);
  }

  // Split large sections if we have too few
  while (adjusted.length < effectiveTarget) {
    // Find the largest section and split it
    let maxIdx = 0;
    let maxLen = 0;
    for (let i = 0; i < adjusted.length; i++) {
      if (adjusted[i].sentences.length > maxLen) {
        maxLen = adjusted[i].sentences.length;
        maxIdx = i;
      }
    }
    if (adjusted[maxIdx].sentences.length < 2) break; // Can't split further

    const section = adjusted[maxIdx];
    const mid = Math.ceil(section.sentences.length / 2);
    const firstHalf = section.sentences.slice(0, mid);
    const secondHalf = section.sentences.slice(mid);

    const firstHint = firstHalf.map((_, j) => analyzed[section.startIndex + j]?.topicHint || '').filter(Boolean)[0] || section.topicHint;
    const secondHint = secondHalf.map((_, j) => analyzed[section.startIndex + mid + j]?.topicHint || '').filter(Boolean)[0] || section.topicHint;

    adjusted.splice(maxIdx, 1,
      { sentences: firstHalf, topicHint: firstHint, startIndex: section.startIndex },
      { sentences: secondHalf, topicHint: secondHint, startIndex: section.startIndex + mid },
    );
  }

  // Step 4: Build planned slides from sections
  return adjusted.map((section, i) => {
    const content = section.sentences.join('. ');
    const title = generateTitleFromHint(section.topicHint, content, i, topic);
    const layout = chooseLayoutFromHint(section.topicHint, title, content);
    return { title, content, layout };
  });
}

// ── Slide validation & cleaning ───────────────────────────────────────────────

const VALIDATION_INSTRUCTION_PATTERNS = [
  /^(use|add|create|make|include|ensure|keep|maintain|do not|don't|avoid|note:|hint:|tip:)/i,
  /\b(professional|background|blue and white|theme|font|color|layout|slide type)\b.*\b(background|theme|font|color|layout|design)\b/i,
  /^(add an image|add a diagram|placeholder|insert|place a)/i,
];

function looksLikeInstruction(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  return VALIDATION_INSTRUCTION_PATTERNS.some((re) => re.test(trimmed));
}

export function validateAndCleanSlides(slides: {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: { id: string; text: string }[];
  cards?: { id: string; title: string; description: string; icon?: string }[];
  notes?: string;
}[]): typeof slides {
  const seenTitles = new Set<string>();
  const seenBulletTexts = new Set<string>();

  return slides.map((slide) => {
    const title = slide.title.trim();
    let body = slide.body?.trim() || '';
    let bullets = slide.bullets?.slice() || [];
    let cards = slide.cards?.slice() || [];

    // Strip instruction-like text from body
    if (looksLikeInstruction(body)) body = '';

    // Strip instruction-like bullets
    bullets = bullets.filter((b) => {
      const text = b.text.trim();
      if (looksLikeInstruction(text)) return false;
      const key = text.toLowerCase().substring(0, 60);
      if (seenBulletTexts.has(key)) return false;
      seenBulletTexts.add(key);
      return true;
    });

    // Strip empty/instruction cards
    cards = cards.filter((c) => {
      const t = c.title.trim();
      const d = c.description.trim();
      if (t.length < 2 || looksLikeInstruction(t) || looksLikeInstruction(d)) return false;
      // Filter meaningless single-word titles
      if (/^(user|time|professionals?|thing|stuff|item|point)$/i.test(t)) return false;
      return true;
    });

    // Deduplicate slide titles
    const titleKey = title.toLowerCase().substring(0, 50);
    if (seenTitles.has(titleKey)) {
      // Keep but don't add — we don't want to delete slides entirely
    } else {
      seenTitles.add(titleKey);
    }

    // Strip placeholder text
    body = body.replace(/\b(add an image|add a diagram|placeholder|insert image here|lorem ipsum)\b[^.]*/gi, '').trim();

    return {
      ...slide,
      title,
      body: body || undefined,
      bullets: bullets.length > 0 ? bullets : undefined,
      cards: cards.length > 0 ? cards : undefined,
    };
  });
}

function generateTitleFromHint(hint: string, content: string, index: number, topic: string): string {
  const firstSentence = content.split(/[.]\s+/)[0] || content;

  switch (hint) {
    case 'definition': {
      // Try to extract the subject being defined
      const defMatch = firstSentence.match(/^([A-Z][^.]{5,50}?)\s+(?:is|are|refers to|means|involves|consists of)\s/i);
      if (defMatch) return `What is ${defMatch[1].trim().replace(/^the\s+/i, '')}?`;
      return index === 0 ? `Introduction to ${topic}` : 'Overview';
    }

    case 'types': {
      const typesMatch = firstSentence.match(/(?:types?|kinds?|categories?|varieties|forms?)\s+of\s+([A-Z][^.]{3,40})/i);
      if (typesMatch) return `Types of ${typesMatch[1].trim()}`;
      return 'Types & Categories';
    }

    case 'applications': {
      const appMatch = firstSentence.match(/^([A-Z][^.]{3,40}?)\s+(?:has\s+applications|is\s+(?:used|applied)|finds\s+application)/i);
      if (appMatch) return `Applications of ${appMatch[1].trim()}`;
      return 'Real-World Applications';
    }

    case 'advantages':
      return 'Key Advantages';

    case 'challenges':
      return 'Challenges & Limitations';

    case 'future':
      return 'Future Outlook';

    case 'history':
      return 'History & Evolution';

    case 'current':
      return 'Current Landscape';

    case 'process':
      return 'How It Works';

    case 'comparison':
      return 'Comparison';

    case 'statistics':
      return 'Key Statistics';

    case 'conclusion':
      return 'Conclusion & Takeaways';

    default: {
      // Fallback: use generateSlideTitleFromContent logic inline
      const words = firstSentence.split(/\s+/).slice(0, 5).join(' ');
      const shortTitle = words.replace(/^(the|a|an|this|these|those)\s+/i, '').trim();
      if (shortTitle.length > 10 && shortTitle.length < 50) {
        return shortTitle.charAt(0).toUpperCase() + shortTitle.slice(1);
      }
      return index === 0 ? `Overview of ${topic}` : `Key Points ${index + 1}`;
    }
  }
}

function chooseLayoutFromHint(hint: string, title: string, content: string): SlideLayout {
  switch (hint) {
    case 'comparison': return 'comparison';
    case 'history': {
      // Only use timeline if there are 2+ year references
      const yearCount = (content.match(/\b(19|20)\d{2}s?\b/g) || []).length;
      return yearCount >= 2 ? 'timeline' : 'two-column';
    }
    case 'process': {
      // Only use process if there are 2+ step/phase references
      const stepCount = (content.match(/\b(?:step|phase|stage)\s*\d/i) || []).length;
      return stepCount >= 2 ? 'process' : 'two-column';
    }
    case 'statistics': {
      const statCount = (content.match(/\d+%|[$₹€£]\d/g) || []).length;
      return statCount >= 2 ? 'statistics' : 'two-column';
    }
    case 'types': return 'cards';
    case 'applications': return 'cards';
    case 'advantages':
    case 'challenges':
    case 'future':
    case 'current':
    case 'definition':
    case 'conclusion':
    default:
      return chooseLayout(title, content, true);
  }
}

// ── Full transformation ──────────────────────────────────────────────────────

export interface TransformedContent {
  /** Short subtitle/body for the slide (max ~120 chars) */
  body: string;
  /** 3-5 concise bullet points extracted from the content */
  bullets: { id: string; text: string }[];
  /** Detailed speaker notes preserving the full explanation */
  notes: string;
  /** Recommended layout based on content analysis */
  layout: SlideLayout;
}

/**
 * Main transformation function.
 * Takes raw user content and a title, returns presentation-ready material.
 *
 * Pipeline: raw text → analyze → extract key points → summarize → choose layout
 */
export function transformContent(
  rawContent: string,
  title: string,
  options?: { duration?: number; preferLayout?: SlideLayout },
): TransformedContent {
  const trimmed = (rawContent || '').trim();

  if (trimmed.length === 0) {
    return {
      body: '',
      bullets: [],
      notes: `Discuss ${title}.`,
      layout: options?.preferLayout || 'two-column',
    };
  }

  // Extract bullets from the raw content
  const bullets = extractBullets(trimmed, 5);

  // Create a short body summary — shorter when bullets carry the detail
  const body = summarizeBody(trimmed, bullets.length >= 3 ? 60 : 120);

  // Generate speaker notes from the full content
  const notes = generateNotesFromContent(trimmed, title, bullets, options?.duration);

  // Choose the best layout
  const hasMultipleItems = bullets.length >= 3;
  const layout = options?.preferLayout || chooseLayout(title, trimmed, hasMultipleItems);

  return { body, bullets, notes, layout };
}
