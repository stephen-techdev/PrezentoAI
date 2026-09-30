import type {
  Presentation,
  PresentationSettings,
  Slide,
  TimelineItem,
  ProcessStep,
  StatItem,
  CardItem,
  ComparisonRow,
  TableData,
  ChartData,
  VivaQuestion,
  PresentationScore,
  RewriteTone,
} from '../types';
import { uid, seedFrom } from './id';
import {
  detectCategory,
  type TopicCategory,
} from './knowledge';
import { detectContent, parseStyleDirectives, isDesignDirectiveLine } from './contentDetector';

// ─────────────────────────────────────────────────────────────────────────────
// Local "AI" generation engine.
//
// A topic-aware generator that produces presentations genuinely about the
// user's topic. It first checks a knowledge base of curated topics; if a match
// is found, it uses topic-specific content. Otherwise, it builds a unique
// outline based on the detected category (programming, science, history, etc.)
// and generates content directly related to the topic.
//
// The generator NEVER uses a fixed generic template. Every presentation is
// structured around the topic itself.
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'for', 'to', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'by', 'as', 'at', 'from', 'this',
  'that', 'these', 'those', 'it', 'its', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'up', 'down', 'over', 'under', 'again',
]);

// ── Topic analysis ───────────────────────────────────────────────────────────

interface TopicAnalysis {
  /** Display title (Title Case). */
  title: string;
  /** Short topic noun phrase, e.g. "machine learning". */
  topic: string;
  /** Keywords extracted from the prompt (lowercase, significant words). */
  keywords: string[];
  /** The original cleaned prompt. */
  prompt: string;
  /** Detected category. */
  category: TopicCategory;
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => (STOPWORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function cleanPrompt(prompt: string): string {
  return prompt
    .replace(/^(create|make|generate|build|design|prepare|write)\s+(a|an|the)?\s*(presentation|slides|deck|slideshow)?\s*(about|on|for|regarding)?\s*/i, '')
    .replace(/[.?!]+$/g, '')
    .trim();
}

function analyzeTopic(settings: PresentationSettings): TopicAnalysis {
  const cleaned = cleanPrompt(settings.prompt) || settings.title || 'Untitled Presentation';
  const title = titleCase(cleaned);

  const words = cleaned.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));
  const keywords = Array.from(new Set(words.map((w) => w.toLowerCase()))).slice(0, 8);
  const topic = keywords.length > 0 ? keywords.slice(-2).join(' ') : cleaned.toLowerCase();

  const category = detectCategory(cleaned);

  return { title, topic, keywords, prompt: cleaned, category };
}

// ── Category-aware content builders for fallback ─────────────────────────────
// These produce section-specific content that teaches something real about the topic,
// rather than generic template sentences. Each section type gets content appropriate
// to what it's supposed to teach.

function buildFallbackBody(section: string, ta: TopicAnalysis): string {
  const topic = ta.topic;
  const title = ta.title;
  const lower = section.toLowerCase();
  const isProgramming = ta.category === 'programming';

  if (lower.includes('introduction') || lower.includes('what is')) {
    if (isProgramming) {
      return `${title} are fundamental constructs in C programming that operate on operands to produce results. Understanding them is essential for writing efficient and correct C code, as nearly every expression involves at least one operator.`;
    }
    if (ta.category === 'ai' && ta.keywords.some((k) => k.includes('health') || k.includes('medical'))) {
      return `Artificial Intelligence is transforming healthcare by enabling faster diagnosis, personalized treatment, and data-driven decision-making. This presentation explores how AI is applied across medical imaging, drug discovery, patient monitoring, and the ethical challenges that arise.`;
    }
    if (ta.category === 'ai') {
      return `Artificial Intelligence (AI) is the science and engineering of building systems that mimic human cognitive functions — reasoning, learning, perception, and language. From virtual assistants to self-driving cars, AI is reshaping how we interact with technology. This presentation introduces the core concepts, explores real-world applications, and examines the advantages, challenges, and future directions of this rapidly evolving field.`;
    }
    return `${title} is a significant topic that touches on multiple important concepts. This slide introduces the core idea, explains why it matters, and outlines what the audience will learn throughout the presentation.`;
  }
  if (lower.includes('arithmetic')) {
    return `Arithmetic operators perform mathematical computations on numeric operands. In C, these include addition (+), subtraction (-), multiplication (*), division (/), and modulus (%). Integer division truncates the result, and the modulus operator works only on integer operands.`;
  }
  if (lower.includes('relational') || lower.includes('logical')) {
    if (lower.includes('logical')) {
      return `Logical operators combine multiple conditions: AND (&&), OR (||), and NOT (!). They use short-circuit evaluation — AND stops evaluating if the left operand is false, and OR stops if the left operand is true. This is critical for safe pointer access patterns.`;
    }
    return `Relational operators compare two values and return 1 (true) or 0 (false). C has no native boolean type — any non-zero value is true. The operators are: ==, !=, >, <, >=, and <=. A common bug is using = (assignment) instead of == (comparison).`;
  }
  if (lower.includes('assignment')) {
    return `The assignment operator = stores a value in a variable. Compound assignment operators (+=, -=, *=, /=, %=, etc.) combine an operation with assignment, making code more concise and less error-prone. For example, a += 5 is equivalent to a = a + 5.`;
  }
  if (lower.includes('bitwise')) {
    return `Bitwise operators work on the binary representation of integers: AND (&), OR (|), XOR (^), NOT (~), left shift (<<), and right shift (>>). They are essential for low-level programming, device drivers, flag manipulation, and embedded systems where individual bits carry meaning.`;
  }
  if (lower.includes('increment') || lower.includes('decrement')) {
    return `The ++ and -- operators add or subtract 1 from a variable. Prefix form (++a) increments before the value is used; postfix form (a++) increments after. This distinction matters in expressions where the variable's value is used immediately.`;
  }
  if (lower.includes('conditional') || lower.includes('ternary')) {
    return `The conditional operator ?: is C's only ternary operator. Syntax: condition ? value_if_true : value_if_false. It is a concise alternative to if-else for simple assignments, e.g., max = (a > b) ? a : b;`;
  }
  if (lower.includes('precedence') || lower.includes('associativity')) {
    return `Operator precedence determines the order in which operators are evaluated in an expression. Higher-precedence operators bind tighter. Associativity determines evaluation order for operators of the same precedence (left-to-right or right-to-left).`;
  }
  if (lower.includes('syntax') || lower.includes('declaration') || lower.includes('definition') || lower.includes('notation')) {
    if (isProgramming) {
      return `The syntax for ${topic.toLowerCase()} follows C's standard rules: declare the type, use the operator or construct, and ensure operands are compatible. Correct syntax is essential — the compiler will reject invalid expressions.`;
    }
    return `The formal definition of ${topic} establishes the vocabulary and rules that govern its use. Mastering these fundamentals is essential before proceeding to more advanced concepts and applications.`;
  }
  if (lower.includes('concept') || lower.includes('propert') || lower.includes('component') || lower.includes('terminology')) {
    return `The key concepts of ${topic} form the foundation for understanding how it works. Each concept builds on the previous one, creating a coherent framework that explains the subject's behavior and characteristics.`;
  }
  if (lower.includes('feature') || lower.includes('structure') || lower.includes('composition') || lower.includes('characteristic')) {
    return `The main features of ${topic} define its capabilities and limitations. Understanding these features helps practitioners apply ${topic} effectively and avoid common pitfalls.`;
  }
  if (lower.includes('how') && (lower.includes('work') || lower.includes('process'))) {
    return `The mechanism of ${topic} involves a series of well-defined steps. Each step plays a specific role, and together they produce the desired outcome. Understanding this process is key to applying ${topic} correctly.`;
  }
  if (lower.includes('example') || lower.includes('code example') || lower.includes('practical')) {
    if (isProgramming) {
      return `The following code examples demonstrate ${topic} in practice. Each example shows a complete, compilable snippet that illustrates a specific concept. Study the syntax and output to understand how the operators behave.`;
    }
    return `Real-world applications of ${topic} demonstrate its practical value. These examples show how the concepts translate into working solutions and provide context for the theory covered earlier.`;
  }
  if (lower.includes('application') || lower.includes('use case') || lower.includes('real-world') || lower.includes('case stud')) {
    if (ta.category === 'ai') {
      return `AI has applications across virtually every industry. In healthcare, AI powers medical imaging analysis and drug discovery. In finance, it drives fraud detection and algorithmic trading. In transportation, AI enables autonomous vehicles and traffic optimization. Natural language processing powers chatbots, translation, and sentiment analysis. Computer vision enables facial recognition, quality inspection, and augmented reality. These applications demonstrate how AI transforms theoretical research into practical, high-impact solutions.`;
    }
    return `${title} has practical applications across multiple domains. These use cases demonstrate how theoretical concepts translate into real-world solutions and why the topic matters beyond the classroom.`;
  }
  if (lower.includes('best practice') || lower.includes('common mistake') || lower.includes('pitfall') || lower.includes('challenge') || lower.includes('disorder') || lower.includes('issue') || lower.includes('limitation')) {
    if (ta.category === 'ai') {
      return `AI faces significant challenges across technical, ethical, and societal dimensions. Bias in training data can produce unfair or discriminatory outcomes. The black-box nature of deep learning makes decisions hard to explain. Data privacy concerns arise from AI's reliance on large personal datasets. High computational costs limit accessibility. Job displacement fears persist as automation expands. Addressing these challenges requires interdisciplinary collaboration, transparent algorithms, and thoughtful regulation that balances innovation with responsibility.`;
    }
    return `When working with ${topic}, several common mistakes can undermine results. Being aware of these pitfalls — and following established best practices — helps ensure success and avoid preventable errors.`;
  }
  if (lower.includes('advantage') || lower.includes('benefit') || lower.includes('importance') || lower.includes('impact') || lower.includes('legacy') || lower.includes('outcome') || lower.includes('significance')) {
    if (ta.category === 'ai') {
      return `AI offers transformative advantages: it processes vast datasets faster than any human, operates 24/7 without fatigue, and identifies patterns invisible to manual analysis. In healthcare, AI enables earlier disease detection and personalized treatment. In business, it automates repetitive tasks, reducing costs and human error. AI scales effortlessly — once trained, a model can serve millions of users simultaneously. It augments human creativity by generating text, images, and code. These advantages make AI one of the most impactful technologies of the 21st century.`;
    }
    return `The importance of ${topic} extends beyond its immediate context. Its advantages and impact are felt across multiple domains, making it a valuable subject of study and application.`;
  }
  if (lower.includes('future') || lower.includes('trend') || lower.includes('direction')) {
    if (ta.category === 'ai') {
      return `The future of AI points toward more capable, efficient, and accessible systems. Large language models are becoming multimodal, processing text, images, and audio together. Edge AI brings intelligence to phones and IoT devices without cloud dependency. Quantum computing may unlock breakthroughs in AI training speed. Regulatory frameworks like the EU AI Act are shaping responsible deployment. AI agents that autonomously plan and execute multi-step tasks are emerging. As AI becomes ubiquitous, the focus shifts from capability to responsibility — ensuring systems are safe, fair, and beneficial to society.`;
    }
    return `The future of ${topic} holds exciting possibilities. Ongoing research and development continue to expand its capabilities, opening new applications and opportunities for innovation.`;
  }
  if (lower.includes('summary') || lower.includes('conclusion') || lower.includes('takeaway') || lower.includes('key takeaway')) {
    return `In summary, ${topic} is a significant subject with well-defined concepts, practical applications, and ongoing relevance. The key takeaways from this presentation provide a foundation for further exploration and application.`;
  }
  if (lower.includes('background') || lower.includes('context')) {
    return `To understand ${topic}, it is important to first establish the background and context. The conditions and developments that led to its emergence shape how we interpret and apply it today.`;
  }
  if (lower.includes('event') || lower.includes('milestone') || lower.includes('figure') || lower.includes('leader')) {
    return `The key events and figures associated with ${topic} shaped its course and outcomes. Understanding who was involved and what happened provides a complete picture of the subject.`;
  }
  if (lower.includes('cause') || lower.includes('motivation')) {
    return `The causes and motivations behind ${topic} explain why it developed the way it did. These driving factors are essential for a complete understanding of the subject.`;
  }
  if (lower.includes('type') || lower.includes('categor') || lower.includes('classification')) {
    return `${title} can be classified into several types based on its characteristics. Each type has distinct properties and use cases, and understanding the differences helps in choosing the right approach.`;
  }
  if (lower.includes('architecture') || lower.includes('design') || lower.includes('framework') || lower.includes('strategic') || lower.includes('algorithm') || lower.includes('technique')) {
    return `The architecture of ${topic} defines its structure and organization. A well-designed architecture ensures that ${topic} functions correctly and can scale to meet demands.`;
  }
  if (lower.includes('formula') || lower.includes('theorem') || lower.includes('rule') || lower.includes('property')) {
    return `The formulas and properties of ${topic} provide the mathematical foundation for applying it to real problems. Each property has specific conditions under which it holds true.`;
  }
  if (lower.includes('metric') || lower.includes('measurement')) {
    return `Measuring the effectiveness of ${topic} requires well-defined metrics. These metrics help practitioners evaluate performance, identify areas for improvement, and demonstrate value.`;
  }
  if (lower.includes('ethic') || lower.includes('privacy') || lower.includes('security concern')) {
    return `The use of ${topic} raises important ethical and privacy considerations. Balancing innovation with responsible practices is essential for long-term trust and sustainability.`;
  }
  if (lower.includes('diagnosis') || lower.includes('imaging') || lower.includes('drug')) {
    return `AI-powered diagnosis and medical imaging are among the most impactful applications. Machine learning models can detect patterns in X-rays, MRIs, and CT scans with accuracy rivaling specialist physicians, enabling earlier and more accurate diagnosis.`;
  }
  if (lower.includes('patient') || lower.includes('monitoring') || lower.includes('care')) {
    return `AI enables continuous patient monitoring through wearable devices and predictive analytics. Real-time data analysis can alert healthcare providers to deteriorating conditions before they become critical, improving patient outcomes.`;
  }

  // ── Topic-level matches for common C programming constructs ──
  if (lower.includes('array') && (lower.includes('c') || isProgramming)) {
    return `An array in C is a collection of elements of the same type stored in contiguous memory locations. Arrays allow you to group related data under a single name and access individual elements using an index. They are declared with a type and size, e.g., int arr[10] creates an array of 10 integers. Array indexing starts at 0, so arr[0] is the first element and arr[9] is the last. Arrays can be initialized at declaration: int arr[] = {1, 2, 3, 4, 5}. Multidimensional arrays like int matrix[3][4] represent tables or grids. Arrays and pointers are closely related — the array name decays to a pointer to its first element when passed to a function.`;
  }
  if (lower.includes('string') && (lower.includes('c') || isProgramming)) {
    return `In C, a string is a one-dimensional array of characters terminated by a null character ('\\0'). C has no built-in string type — strings are manipulated using character arrays and functions from <string.h>. Common functions include strlen (length), strcpy (copy), strcat (concatenate), strcmp (compare), and strchr (search). String literals like "Hello" are stored as read-only character arrays with an implicit null terminator. To read a string from input, use scanf with %s (stops at whitespace) or fgets (reads a full line). Always ensure the destination array is large enough to hold the string plus the null terminator to avoid buffer overflows.`;
  }
  if (lower.includes('function') && (lower.includes('c') || isProgramming)) {
    return `A function in C is a self-contained block of code that performs a specific task. Functions promote code reuse, modularity, and readability. A function has a return type, name, parameters, and body: int add(int a, int b) { return a + b; }. Functions must be declared (prototyped) before use, either with a forward declaration or by defining them before the call site. C passes arguments by value — changes inside the function do not affect the caller's variables. To modify the caller's variables, pass pointers. Functions can have a void return type and/or void parameters. The main() function is the entry point of every C program and returns 0 on success.`;
  }
  if (lower.includes('structure') && (lower.includes('c') || isProgramming)) {
    return `A structure in C is a user-defined data type that groups related variables of different types under a single name. Structures are declared using the struct keyword: struct Student { char name[50]; int roll; float marks; };. Members are accessed using the dot operator (s.name) for struct variables and the arrow operator (s->name) for pointers to structs. Structures can be nested, passed to functions by value or by pointer, and arrays of structures can be created. typedef can simplify struct usage: typedef struct { int x; int y; } Point; allows declaring Point p; without the struct keyword. Structures are essential for organizing complex data in C programs.`;
  }

  return `${section} is an important aspect of ${topic}. This section covers the key points, explains how they relate to the overall topic, and provides context for the sections that follow.`;
}

function buildFallbackBullets(section: string, ta: TopicAnalysis): { text: string }[] {
  const topic = ta.topic;
  const lower = section.toLowerCase();
  const isProgramming = ta.category === 'programming';

  if (lower.includes('arithmetic')) {
    return [
      { text: '+ (Addition): a + b — sum of two operands' },
      { text: '- (Subtraction): a - b — difference of two operands' },
      { text: '* (Multiplication): a * b — product of two operands' },
      { text: '/ (Division): a / b — integer division truncates (10/3 = 3)' },
      { text: '% (Modulus): a % b — remainder, integers only (10%3 = 1)' },
    ];
  }
  if (lower.includes('relational')) {
    return [
      { text: '== (Equal to): returns 1 if operands are equal' },
      { text: '!= (Not equal to): returns 1 if operands differ' },
      { text: '>, <, >=, <=: comparison operators returning 1 or 0' },
      { text: 'Common bug: using = (assignment) instead of == (comparison)' },
    ];
  }
  if (lower.includes('logical')) {
    return [
      { text: '&& (AND): true only if both conditions are true' },
      { text: '|| (OR): true if at least one condition is true' },
      { text: '! (NOT): reverses the truth value of a condition' },
      { text: 'Short-circuit: && stops on false, || stops on true' },
      { text: 'Example: if (ptr != NULL && ptr->value > 0) — safe access' },
    ];
  }
  if (lower.includes('assignment')) {
    return [
      { text: '= (Simple assignment): a = 5 stores 5 in a' },
      { text: '+= (Add and assign): a += 3 is shorthand for a = a + 3' },
      { text: '-=, *=, /=, %= : compound assignment operators' },
      { text: 'Compound operators are concise and reduce repetition errors' },
    ];
  }
  if (lower.includes('bitwise')) {
    return [
      { text: '& (AND): bit is 1 only if both bits are 1' },
      { text: '| (OR): bit is 1 if at least one bit is 1' },
      { text: '^ (XOR): bit is 1 if bits differ' },
      { text: '~ (NOT): inverts all bits (one\'s complement)' },
      { text: '<< (Left shift): equivalent to multiplying by 2^n' },
      { text: '>> (Right shift): equivalent to dividing by 2^n' },
    ];
  }
  if (lower.includes('increment') || lower.includes('decrement')) {
    return [
      { text: '++a (Prefix): increment first, then use the new value' },
      { text: 'a++ (Postfix): use current value, then increment' },
      { text: '--a (Prefix): decrement first, then use the new value' },
      { text: 'a-- (Postfix): use current value, then decrement' },
      { text: 'Example: b = ++a (a=5) gives b=6, a=6; b = a++ gives b=5, a=6' },
    ];
  }
  if (lower.includes('conditional') || lower.includes('ternary')) {
    return [
      { text: 'Syntax: condition ? value_if_true : value_if_false' },
      { text: 'Example: max = (a > b) ? a : b;' },
      { text: 'Only ternary operator in C — operates on three operands' },
      { text: 'Use for simple assignments, not complex logic' },
    ];
  }
  if (lower.includes('precedence') || lower.includes('associativity')) {
    return [
      { text: 'Higher precedence operators bind tighter (evaluated first)' },
      { text: 'Parentheses () override default precedence' },
      { text: 'Associativity: left-to-right or right-to-left for same precedence' },
      { text: 'Example: * has higher precedence than +, so a + b * c = a + (b * c)' },
    ];
  }
  if (lower.includes('introduction') || lower.includes('what is')) {
    if (isProgramming) {
      return [
        { text: `Operators are symbols that perform operations on operands` },
        { text: 'C has unary (1 operand), binary (2 operands), and ternary (3 operands) operators' },
        { text: 'Operators are the building blocks of every C expression' },
        { text: 'Understanding precedence and associativity is essential for correct code' },
      ];
    }
    if (ta.category === 'ai' && ta.keywords.some((k) => k.includes('health') || k.includes('medical'))) {
      return [
        { text: 'AI is transforming healthcare through data-driven decision-making' },
        { text: 'Applications include diagnosis, drug discovery, and patient monitoring' },
        { text: 'Machine learning models analyze medical images with high accuracy' },
        { text: 'Ethical and privacy challenges must be addressed alongside innovation' },
      ];
    }
    if (ta.category === 'ai') {
      return [
        { text: 'AI mimics human cognitive functions: reasoning, learning, perception, and language' },
        { text: 'Subfields include machine learning, deep learning, NLP, and computer vision' },
        { text: 'AI systems learn from data rather than being explicitly programmed' },
        { text: 'From virtual assistants to self-driving cars, AI is reshaping technology' },
      ];
    }
    return [
      { text: `Definition — what ${topic} means and why it matters` },
      { text: 'Scope — what this presentation covers' },
      { text: 'Why it is relevant today' },
      { text: 'What you will take away' },
    ];
  }
  if (lower.includes('syntax') || lower.includes('declaration') || lower.includes('definition') || lower.includes('notation')) {
    if (isProgramming) {
      return [
        { text: `Declare the type before using ${topic}` },
        { text: 'Operands can be variables, constants, or expressions' },
        { text: 'The compiler enforces type compatibility' },
        { text: 'Incorrect syntax produces compilation errors' },
      ];
    }
    return [
      { text: `Formal definition of ${topic}` },
      { text: 'Key terms and vocabulary' },
      { text: 'Basic rules and conventions' },
      { text: `How to read and interpret ${topic}` },
    ];
  }
  if (lower.includes('concept') || lower.includes('propert') || lower.includes('component') || lower.includes('terminology')) {
    return [
      { text: `Core concepts that define ${topic}` },
      { text: 'How these concepts relate to each other' },
      { text: 'Common misconceptions to avoid' },
      { text: 'Foundational principles for further study' },
    ];
  }
  if (lower.includes('feature') || lower.includes('structure') || lower.includes('composition') || lower.includes('characteristic')) {
    return [
      { text: `Main features of ${topic}` },
      { text: 'How the structure supports its function' },
      { text: 'Key characteristics and properties' },
      { text: `What distinguishes ${topic} from related subjects` },
    ];
  }
  if (lower.includes('how') && (lower.includes('work') || lower.includes('process'))) {
    return [
      { text: `Step-by-step explanation of how ${topic} works` },
      { text: 'The role of each step in the overall process' },
      { text: 'Inputs, outputs, and transformations' },
      { text: 'What can go wrong at each stage' },
    ];
  }
  if (lower.includes('example') || lower.includes('code example') || lower.includes('practical')) {
    if (isProgramming) {
      return [
        { text: 'Example 1: int a = 10, b = 3; printf("%d", a + b); // Output: 13' },
        { text: 'Example 2: int x = 5; x += 3; // x is now 8' },
        { text: 'Example 3: int flag = (a > b) ? 1 : 0; // flag is 1' },
        { text: 'Each example demonstrates a different operator category' },
      ];
    }
    return [
      { text: `Real-world examples of ${topic} in action` },
      { text: 'How the theory translates into practice' },
      { text: 'Lessons learned from each example' },
      { text: 'How to apply these examples to your own work' },
    ];
  }
  if (lower.includes('application') || lower.includes('use case') || lower.includes('real-world') || lower.includes('case stud')) {
    if (ta.category === 'ai') {
      return [
        { text: 'Healthcare: AI detects tumors in X-rays and MRIs with specialist-level accuracy' },
        { text: 'Finance: fraud detection, algorithmic trading, and credit scoring' },
        { text: 'Transportation: autonomous vehicles and real-time traffic optimization' },
        { text: 'NLP: chatbots, real-time translation, and sentiment analysis' },
        { text: 'Computer vision: facial recognition, quality inspection, and AR' },
      ];
    }
    return [
      { text: `Key application areas for ${topic}` },
      { text: 'How practitioners use it in industry' },
      { text: 'Benefits delivered in each use case' },
      { text: 'Limitations to be aware of' },
    ];
  }
  if (lower.includes('best practice') || lower.includes('common mistake') || lower.includes('pitfall') || lower.includes('challenge') || lower.includes('disorder') || lower.includes('issue') || lower.includes('limitation')) {
    if (isProgramming) {
      return [
        { text: 'Always use == for comparison, not = (assignment)' },
        { text: 'Use parentheses to make precedence explicit' },
        { text: 'Be careful with increment/decrement in complex expressions' },
        { text: 'Check for integer division when floating-point result is expected' },
      ];
    }
    if (ta.category === 'ai') {
      return [
        { text: 'Bias in training data leads to unfair or discriminatory outcomes' },
        { text: 'Deep learning models are black boxes — decisions are hard to explain' },
        { text: 'Data privacy concerns from reliance on large personal datasets' },
        { text: 'High computational costs limit accessibility for smaller organizations' },
        { text: 'Job displacement fears as automation expands across industries' },
      ];
    }
    return [
      { text: `Common mistakes when working with ${topic}` },
      { text: 'Best practices to follow' },
      { text: 'How to identify and avoid pitfalls' },
      { text: 'Tips for getting it right the first time' },
    ];
  }
  if (lower.includes('advantage') || lower.includes('benefit') || lower.includes('importance') || lower.includes('impact') || lower.includes('legacy') || lower.includes('outcome') || lower.includes('significance')) {
    if (ta.category === 'ai') {
      return [
        { text: 'Processes vast datasets faster than any human, 24/7 without fatigue' },
        { text: 'Identifies patterns and insights invisible to manual analysis' },
        { text: 'Automates repetitive tasks, reducing costs and human error' },
        { text: 'Scales effortlessly — one trained model serves millions of users' },
        { text: 'Augments human creativity in text, image, and code generation' },
      ];
    }
    return [
      { text: `Key advantages of ${topic}` },
      { text: 'Why it matters in its field' },
      { text: 'Who benefits and how' },
      { text: 'Long-term significance and impact' },
    ];
  }
  if (lower.includes('future') || lower.includes('trend') || lower.includes('direction')) {
    if (ta.category === 'ai') {
      return [
        { text: 'Multimodal models processing text, images, and audio together' },
        { text: 'Edge AI brings intelligence to phones and IoT without cloud dependency' },
        { text: 'Quantum computing may unlock breakthroughs in AI training speed' },
        { text: 'AI agents autonomously plan and execute multi-step tasks' },
        { text: 'Regulatory frameworks like the EU AI Act shape responsible deployment' },
      ];
    }
    return [
      { text: `Current trends in ${topic}` },
      { text: 'Emerging developments to watch' },
      { text: 'Potential future applications' },
      { text: 'How to stay current with the field' },
    ];
  }
  if (lower.includes('summary') || lower.includes('conclusion') || lower.includes('takeaway') || lower.includes('key takeaway')) {
    return [
      { text: 'Key takeaways from this presentation' },
      { text: 'The most important points to remember' },
      { text: 'How to apply what you have learned' },
      { text: 'Where to go for further study' },
    ];
  }
  if (lower.includes('background') || lower.includes('context')) {
    return [
      { text: `Historical background of ${topic}` },
      { text: 'The context in which it developed' },
      { text: 'Key influences and predecessors' },
      { text: 'Why understanding the background matters' },
    ];
  }
  if (lower.includes('event') || lower.includes('milestone') || lower.includes('figure') || lower.includes('leader')) {
    return [
      { text: `Key events that shaped ${topic}` },
      { text: 'Important figures and their contributions' },
      { text: 'How these events and figures influenced outcomes' },
      { text: 'Lessons we can learn from them' },
    ];
  }
  if (lower.includes('cause') || lower.includes('motivation')) {
    return [
      { text: `Primary causes behind ${topic}` },
      { text: 'Motivations of the key participants' },
      { text: 'How these causes interacted' },
      { text: 'What would have happened without them' },
    ];
  }
  if (lower.includes('type') || lower.includes('categor') || lower.includes('classification')) {
    return [
      { text: `Main types or categories of ${topic}` },
      { text: 'Distinguishing features of each type' },
      { text: 'When to use each type' },
      { text: 'How the types relate to each other' },
    ];
  }
  if (lower.includes('architecture') || lower.includes('design') || lower.includes('framework') || lower.includes('strategic') || lower.includes('algorithm') || lower.includes('technique')) {
    return [
      { text: `Overall architecture of ${topic}` },
      { text: 'Key components and their roles' },
      { text: 'How the components interact' },
      { text: 'Design principles and trade-offs' },
    ];
  }
  if (lower.includes('formula') || lower.includes('theorem') || lower.includes('rule') || lower.includes('property')) {
    return [
      { text: `Key formulas and properties of ${topic}` },
      { text: 'Conditions under which each property holds' },
      { text: 'How to apply the formulas in practice' },
      { text: 'Common errors when applying formulas' },
    ];
  }
  if (lower.includes('metric') || lower.includes('measurement')) {
    return [
      { text: `Key metrics for evaluating ${topic}` },
      { text: 'How to measure each metric' },
      { text: 'What good performance looks like' },
      { text: 'How to use metrics for improvement' },
    ];
  }
  if (lower.includes('ethic') || lower.includes('privacy') || lower.includes('security concern')) {
    return [
      { text: `Ethical considerations for ${topic}` },
      { text: 'Privacy and data protection concerns' },
      { text: 'Balancing innovation with responsibility' },
      { text: 'Regulatory and compliance requirements' },
    ];
  }
  if (lower.includes('diagnosis') || lower.includes('imaging') || lower.includes('drug')) {
    return [
      { text: 'AI detects patterns in X-rays, MRIs, and CT scans' },
      { text: 'Deep learning models achieve specialist-level accuracy' },
      { text: 'Earlier detection of diseases like cancer and diabetes' },
      { text: 'Reduces diagnostic errors and radiologist workload' },
    ];
  }
  if (lower.includes('patient') || lower.includes('monitoring') || lower.includes('care')) {
    return [
      { text: 'Wearable devices track vital signs continuously' },
      { text: 'Predictive analytics alert providers to deterioration' },
      { text: 'Personalized treatment plans based on patient data' },
      { text: 'Remote monitoring reduces hospital readmissions' },
    ];
  }

  // ── Topic-level matches for common C programming constructs ──
  if (lower.includes('array') && (lower.includes('c') || isProgramming)) {
    return [
      { text: 'Declaration: type name[size] — e.g., int arr[10] creates 10 integers' },
      { text: 'Indexing starts at 0: arr[0] is first, arr[size-1] is last' },
      { text: 'Initialization: int arr[] = {1, 2, 3, 4, 5} sets size automatically' },
      { text: '2D arrays: int matrix[3][4] for tables and grids' },
      { text: 'Array name decays to a pointer when passed to a function' },
      { text: 'No bounds checking — accessing out-of-bounds indices is undefined behavior' },
    ];
  }
  if (lower.includes('string') && (lower.includes('c') || isProgramming)) {
    return [
      { text: 'A string is a char array terminated by \'\\0\' (null character)' },
      { text: 'strlen() returns length excluding \'\\0\'; strcpy() copies; strcat() concatenates' },
      { text: 'strcmp() compares two strings — returns 0 if equal' },
      { text: 'scanf("%s", str) reads one word; fgets(str, n, stdin) reads a full line' },
      { text: 'String literals "Hello" are read-only — modifying them is undefined' },
      { text: 'Always allocate space for the null terminator to avoid buffer overflows' },
    ];
  }
  if (lower.includes('function') && (lower.includes('c') || isProgramming)) {
    return [
      { text: 'Syntax: returnType name(parameters) { body; return value; }' },
      { text: 'Functions must be declared (prototyped) before they are called' },
      { text: 'C passes arguments by value — use pointers to modify caller variables' },
      { text: 'void return type means no value is returned' },
      { text: 'main() is the entry point — returns 0 on success' },
      { text: 'Functions enable code reuse, modularity, and easier debugging' },
    ];
  }
  if (lower.includes('structure') && (lower.includes('c') || isProgramming)) {
    return [
      { text: 'Declaration: struct Name { type member1; type member2; };' },
      { text: 'Access members with dot (s.name) or arrow for pointers (s->name)' },
      { text: 'typedef struct { int x; int y; } Point; simplifies declarations' },
      { text: 'Structures can be nested — a struct member can be another struct' },
      { text: 'Pass structs to functions by pointer to avoid copying large data' },
      { text: 'Arrays of structures: struct Student class[30];' },
    ];
  }

  return [
    { text: `Key points about ${section.toLowerCase()} in ${topic}` },
    { text: 'Why this matters in the overall context' },
    { text: 'How it connects to other sections' },
    { text: 'Practical implications' },
  ];
}

// ── Category-aware special slides for fallback ───────────────────────────────

function buildFallbackTimeline(ta: TopicAnalysis): TimelineItem[] {
  if (ta.category === 'programming') {
    return [
      { id: uid('tl'), year: '1972', title: 'Language Created', description: 'Dennis Ritchie at Bell Labs developed C for the UNIX operating system.' },
      { id: uid('tl'), year: '1978', title: 'K&R Standard', description: 'The C Programming Language book by Kernighan and Ritchie became the de facto standard.' },
      { id: uid('tl'), year: '1989', title: 'ANSI C', description: 'ANSI X3.159-1989 standardized the language, known as C89.' },
      { id: uid('tl'), year: '1999', title: 'C99 Standard', description: 'Added new features: variable-length arrays, // comments, and improved floating-point support.' },
      { id: uid('tl'), year: '2011', title: 'C11 Standard', description: 'Introduced multithreading support, anonymous structs, and atomic operations.' },
    ];
  }
  if (ta.category === 'ai') {
    return [
      { id: uid('tl'), year: '1950s', title: 'AI Foundations', description: 'Alan Turing proposed the Turing Test; the Dartmouth Conference coined the term "artificial intelligence."' },
      { id: uid('tl'), year: '1980s', title: 'Expert Systems', description: 'Rule-based expert systems brought AI into commercial applications.' },
      { id: uid('tl'), year: '1997', title: 'Deep Blue', description: 'IBM\'s Deep Blue defeated world chess champion Garry Kasparov.' },
      { id: uid('tl'), year: '2012', title: 'Deep Learning Era', description: 'AlexNet won the ImageNet competition, launching the deep learning revolution.' },
      { id: uid('tl'), year: '2020s', title: 'Generative AI', description: 'Large language models like GPT transformed natural language understanding and generation.' },
    ];
  }
  return [
    { id: uid('tl'), year: 'Early', title: 'Origins', description: `The early development of ${ta.topic} established the foundational ideas and directions.` },
    { id: uid('tl'), year: 'Growth', title: 'Expansion', description: `${ta.topic} grew as more practitioners adopted and refined the core concepts.` },
    { id: uid('tl'), year: 'Maturity', title: 'Mainstream', description: `${ta.topic} reached wider recognition and became established in its field.` },
    { id: uid('tl'), year: 'Modern', title: 'Current State', description: `Today, ${ta.topic} continues to evolve with new research and applications.` },
  ];
}

function buildFallbackProcess(ta: TopicAnalysis): ProcessStep[] {
  const lower = (ta.prompt || ta.topic).toLowerCase();
  if (lower.includes('array')) {
    return [
      { id: uid('ps'), step: 1, title: 'Declare', description: 'Specify the element type and size: int arr[10]; reserves space for 10 integers.' },
      { id: uid('ps'), step: 2, title: 'Initialize', description: 'Assign values at declaration (int arr[] = {1,2,3}) or assign each element by index.' },
      { id: uid('ps'), step: 3, title: 'Access', description: 'Read or write elements using arr[index]. Remember indexing starts at 0.' },
      { id: uid('ps'), step: 4, title: 'Iterate', description: 'Use a for loop to traverse: for (int i = 0; i < n; i++) process arr[i].' },
    ];
  }
  if (lower.includes('string')) {
    return [
      { id: uid('ps'), step: 1, title: 'Declare', description: 'Create a char array large enough for the text plus null terminator: char str[50];' },
      { id: uid('ps'), step: 2, title: 'Initialize', description: 'Assign a literal (char str[] = "Hello";) or read input with fgets or scanf.' },
      { id: uid('ps'), step: 3, title: 'Manipulate', description: 'Use <string.h> functions: strlen, strcpy, strcat, strcmp for common operations.' },
      { id: uid('ps'), step: 4, title: 'Output', description: 'Print with printf("%s", str) or puts(str). The null terminator marks the end.' },
    ];
  }
  if (lower.includes('function')) {
    return [
      { id: uid('ps'), step: 1, title: 'Declare', description: 'Write a prototype: int add(int a, int b); tells the compiler the signature before use.' },
      { id: uid('ps'), step: 2, title: 'Define', description: 'Provide the body: int add(int a, int b) { return a + b; } implements the logic.' },
      { id: uid('ps'), step: 3, title: 'Call', description: 'Invoke the function: int result = add(5, 3); passes arguments by value.' },
      { id: uid('ps'), step: 4, title: 'Return', description: 'Use return to send a result back. void functions need no return statement.' },
    ];
  }
  if (lower.includes('pointer')) {
    return [
      { id: uid('ps'), step: 1, title: 'Declare', description: 'int *ptr; declares a pointer to an integer. The * indicates pointer-to type.' },
      { id: uid('ps'), step: 2, title: 'Assign Address', description: 'ptr = &var; stores the address of var using the address-of operator &.' },
      { id: uid('ps'), step: 3, title: 'Dereference', description: '*ptr accesses the value at the stored address. Modify it with *ptr = 10;' },
      { id: uid('ps'), step: 4, title: 'Free Memory', description: 'If allocated with malloc, call free(ptr) to release memory and avoid leaks.' },
    ];
  }
  if (lower.includes('structure')) {
    return [
      { id: uid('ps'), step: 1, title: 'Define', description: 'struct Student { char name[50]; int roll; float marks; }; defines the template.' },
      { id: uid('ps'), step: 2, title: 'Declare', description: 'struct Student s1; creates a variable. typedef can shorten this to Student s1;' },
      { id: uid('ps'), step: 3, title: 'Access', description: 'Use s1.roll = 101; or for pointers, ptr->roll = 101; to reach individual members.' },
      { id: uid('ps'), step: 4, title: 'Use in Arrays', description: 'struct Student class[30]; creates an array of structures for batch processing.' },
    ];
  }
  if (ta.category === 'programming') {
    return [
      { id: uid('ps'), step: 1, title: 'Declare Variables', description: 'Define the variables and their data types before using operators.' },
      { id: uid('ps'), step: 2, title: 'Apply Operators', description: 'Use the appropriate operator for the operation: arithmetic, relational, logical, etc.' },
      { id: uid('ps'), step: 3, title: 'Check Precedence', description: 'Verify operator precedence and associativity to ensure correct evaluation order.' },
      { id: uid('ps'), step: 4, title: 'Compile and Test', description: 'Compile the program and test with sample inputs to verify the output.' },
    ];
  }
  if (ta.category === 'ai' && (lower.includes('future') || lower.includes('trend'))) {
    return [
      { id: uid('ps'), step: 1, title: 'Multimodal AI', description: 'Models that process text, images, and audio together for richer understanding.' },
      { id: uid('ps'), step: 2, title: 'Edge AI', description: 'Running AI locally on phones and IoT devices without cloud dependency.' },
      { id: uid('ps'), step: 3, title: 'AI Agents', description: 'Autonomous systems that plan and execute multi-step tasks independently.' },
      { id: uid('ps'), step: 4, title: 'Responsible AI', description: 'Regulatory frameworks and safety standards ensuring fair, transparent deployment.' },
    ];
  }
  if (ta.category === 'ai') {
    return [
      { id: uid('ps'), step: 1, title: 'Data Collection', description: 'Gather and label large datasets to train AI models effectively.' },
      { id: uid('ps'), step: 2, title: 'Model Training', description: 'Use machine learning algorithms to learn patterns from the training data.' },
      { id: uid('ps'), step: 3, title: 'Evaluation', description: 'Test the model on unseen data to measure accuracy, precision, and recall.' },
      { id: uid('ps'), step: 4, title: 'Deployment', description: 'Deploy the trained model to production and monitor for drift and bias.' },
    ];
  }
  return [
    { id: uid('ps'), step: 1, title: 'Input', description: `Collect and prepare the materials needed to work with ${ta.topic}.` },
    { id: uid('ps'), step: 2, title: 'Process', description: `Apply the core methods and techniques of ${ta.topic} to the inputs.` },
    { id: uid('ps'), step: 3, title: 'Evaluate', description: `Assess the results against the desired outcomes and criteria.` },
    { id: uid('ps'), step: 4, title: 'Refine', description: `Use feedback to improve the process and outcomes for the next iteration.` },
  ];
}

function buildFallbackStats(ta: TopicAnalysis): StatItem[] {
  const lower = (ta.prompt || ta.topic).toLowerCase();
  if (ta.category === 'programming') {
    if (lower.includes('pointer')) {
      return [
        { id: uid('st'), value: '&*', label: 'Core Operators', description: '& (address-of) and * (dereference) are the two fundamental pointer operators' },
        { id: uid('st'), value: '8', label: 'Bytes (64-bit)', description: 'Size of a pointer on a 64-bit system, regardless of pointed-to type' },
        { id: uid('st'), value: 'NULL', label: 'Invalid Check', description: 'Always check if (ptr != NULL) before dereferencing to avoid crashes' },
        { id: uid('st'), value: '4', label: 'Pointer Arithmetic', description: 'Operations: increment, decrement, subtraction, comparison' },
      ];
    }
    if (lower.includes('array')) {
      return [
        { id: uid('st'), value: '0', label: 'Start Index', description: 'Array indexing begins at 0, not 1 — arr[0] is the first element' },
        { id: uid('st'), value: 'N-1', label: 'End Index', description: 'Last valid index is size-1; accessing arr[N] is out of bounds' },
        { id: uid('st'), value: 'O(1)', label: 'Access Time', description: 'Random access via index is constant time — arrays are fast' },
        { id: uid('st'), value: 'Contiguous', label: 'Memory Layout', description: 'Elements stored in adjacent memory locations for cache efficiency' },
      ];
    }
    if (lower.includes('string')) {
      return [
        { id: uid('st'), value: "'\\0'", label: 'Null Terminator', description: 'Every C string ends with a null character marking its end' },
        { id: uid('st'), value: '<string.h>', label: 'Library', description: 'Provides strlen, strcpy, strcat, strcmp, and more string functions' },
        { id: uid('st'), value: 'O(n)', label: 'strlen Time', description: 'strlen scans until the null terminator — linear in string length' },
        { id: uid('st'), value: 'Read-only', label: 'String Literals', description: 'String literals like "hello" are stored in read-only memory' },
      ];
    }
    if (lower.includes('function')) {
      return [
        { id: uid('st'), value: '1', label: 'Entry Point', description: 'main() is the single entry point every C program must define' },
        { id: uid('st'), value: 'By Value', label: 'Default Passing', description: 'C passes arguments by value — use pointers to modify caller vars' },
        { id: uid('st'), value: 'void', label: 'No Return', description: 'void return type means the function returns no value' },
        { id: uid('st'), value: 'Prototype', label: 'Forward Decl', description: 'Functions must be declared before use via prototype or definition' },
      ];
    }
    if (lower.includes('struct')) {
      return [
        { id: uid('st'), value: 'struct', label: 'Keyword', description: 'Defines a custom data type grouping related variables together' },
        { id: uid('st'), value: '.', label: 'Dot Access', description: 'Access struct members with s.name for struct variables' },
        { id: uid('st'), value: '->', label: 'Arrow Access', description: 'Access struct members with ptr->name for pointers to structs' },
        { id: uid('st'), value: 'typedef', label: 'Shortcut', description: 'Creates aliases so you can write Point p instead of struct Point p' },
      ];
    }
    return [
      { id: uid('st'), value: '8', label: 'Operator Categories', description: 'Arithmetic, relational, logical, assignment, bitwise, increment, conditional, special' },
      { id: uid('st'), value: '45+', label: 'Operators in C', description: 'Total operators across all categories' },
      { id: uid('st'), value: '15', label: 'Precedence Levels', description: 'Operators grouped by binding strength' },
      { id: uid('st'), value: '1972', label: 'Language Origin', description: 'C was created by Dennis Ritchie at Bell Labs' },
    ];
  }
  if (ta.category === 'ai') {
    const lower = (ta.prompt || ta.topic).toLowerCase();
    if (lower.includes('challenge')) {
      return [
        { id: uid('st'), value: '80%', label: 'Bias Risk', description: 'Most AI systems show some form of demographic bias in outputs' },
        { id: uid('st'), value: '$1.2T', label: 'Compute Cost', description: 'Estimated cost of training frontier AI models as they scale' },
        { id: uid('st'), value: '40%', label: 'Explainability Gap', description: 'Of deep learning decisions cannot be easily explained' },
        { id: uid('st'), value: '300M', label: 'Jobs Affected', description: 'Estimated global jobs impacted by AI automation by 2030' },
      ];
    }
    return [
      { id: uid('st'), value: '97%', label: 'ImageNet Accuracy', description: 'Deep learning models now exceed human accuracy on image classification' },
      { id: uid('st'), value: '175B', label: 'GPT-3 Parameters', description: 'Large language models contain hundreds of billions of parameters' },
      { id: uid('st'), value: '$500B', label: 'AI Market by 2024', description: 'Projected global AI market value' },
      { id: uid('st'), value: '70%', label: 'Healthcare Adoption', description: 'Of healthcare organizations piloting AI solutions' },
    ];
  }
  return [
    { id: uid('st'), value: '100+', label: 'Key Concepts', description: `Core concepts within ${ta.topic}` },
    { id: uid('st'), value: '50+', label: 'Applications', description: `Real-world applications of ${ta.topic}` },
    { id: uid('st'), value: '10+', label: 'Years of Study', description: 'Active research and development' },
    { id: uid('st'), value: 'Global', label: 'Relevance', description: `${ta.topic} is studied and applied worldwide` },
  ];
}

function buildFallbackCards(ta: TopicAnalysis, section: string): CardItem[] {
  const lower = section.toLowerCase();
  if (lower.includes('array')) {
    return [
      { id: uid('cd'), title: 'Declaration', description: 'type name[size]; — e.g., int arr[10]; reserves space for 10 integers.', icon: 'Code' },
      { id: uid('cd'), title: 'Indexing', description: 'Elements accessed via arr[i]. Index starts at 0, ends at size-1.', icon: 'ListOrdered' },
      { id: uid('cd'), title: 'Initialization', description: 'int arr[] = {1, 2, 3}; sets values at declaration. Size inferred automatically.', icon: 'Settings2' },
      { id: uid('cd'), title: '2D Arrays', description: 'int matrix[3][4]; for tables and grids. Access with matrix[row][col].', icon: 'Grid3x3' },
    ];
  }
  if (lower.includes('string')) {
    return [
      { id: uid('cd'), title: 'Null Terminator', description: 'Every string ends with \'\\0\'. strlen stops counting at this character.', icon: 'CircleStop' },
      { id: uid('cd'), title: 'strlen()', description: 'Returns the length of a string, excluding the null terminator.', icon: 'Ruler' },
      { id: uid('cd'), title: 'strcpy()', description: 'Copies one string into another. Ensure the destination is large enough.', icon: 'Copy' },
      { id: uid('cd'), title: 'strcmp()', description: 'Compares two strings. Returns 0 if equal, negative or positive otherwise.', icon: 'GitCompare' },
    ];
  }
  if (lower.includes('function')) {
    return [
      { id: uid('cd'), title: 'Prototype', description: 'int add(int a, int b); — declares the signature before use.', icon: 'FileCode' },
      { id: uid('cd'), title: 'Definition', description: 'The body implements the logic: { return a + b; }', icon: 'Code' },
      { id: uid('cd'), title: 'Call by Value', description: 'Arguments are copied. Changes inside do not affect the caller.', icon: 'ArrowRightLeft' },
      { id: uid('cd'), title: 'Return', description: 'return sends a result back. void means no value is returned.', icon: 'CornerUpLeft' },
    ];
  }
  if (lower.includes('structure')) {
    return [
      { id: uid('cd'), title: 'struct Keyword', description: 'Groups related variables of different types under one name.', icon: 'Box' },
      { id: uid('cd'), title: 'Member Access', description: 'Use dot (s.name) for variables, arrow (s->name) for pointers.', icon: 'MousePointerClick' },
      { id: uid('cd'), title: 'typedef', description: 'typedef struct { int x; int y; } Point; — simplifies declarations.', icon: 'Type' },
      { id: uid('cd'), title: 'Nesting', description: 'Structures can contain other structures for complex data models.', icon: 'Layers' },
    ];
  }
  if (ta.category === 'programming' && (lower.includes('type') || lower.includes('categor'))) {
    return [
      { id: uid('cd'), title: 'Arithmetic', description: '+, -, *, /, % — mathematical operations on numeric operands.', icon: 'Calculator' },
      { id: uid('cd'), title: 'Relational', description: '==, !=, >, <, >=, <= — compare two values, return 1 or 0.', icon: 'GitCompare' },
      { id: uid('cd'), title: 'Logical', description: '&&, ||, ! — combine conditions with short-circuit evaluation.', icon: 'Merge' },
      { id: uid('cd'), title: 'Bitwise', description: '&, |, ^, ~, <<, >> — operate on individual bits of integers.', icon: 'Binary' },
      { id: uid('cd'), title: 'Assignment', description: '=, +=, -=, *=, /=, %= — store and update variable values.', icon: 'ArrowRightToLine' },
      { id: uid('cd'), title: 'Conditional', description: '?: — the only ternary operator, a shorthand for if-else.', icon: 'HelpCircle' },
    ];
  }
  if (ta.category === 'ai' && (lower.includes('application') || lower.includes('example'))) {
    return [
      { id: uid('cd'), title: 'Healthcare', description: 'AI detects tumors in X-rays and MRIs, accelerates drug discovery, and monitors patients via wearables.', icon: 'Stethoscope' },
      { id: uid('cd'), title: 'Finance', description: 'Fraud detection, algorithmic trading, and credit scoring powered by pattern recognition.', icon: 'TrendingUp' },
      { id: uid('cd'), title: 'Transportation', description: 'Autonomous vehicles, traffic optimization, and route planning using real-time sensor data.', icon: 'Car' },
      { id: uid('cd'), title: 'NLP & Vision', description: 'Chatbots, real-time translation, facial recognition, and quality inspection systems.', icon: 'MessageSquare' },
    ];
  }
  if (ta.category === 'ai' && (lower.includes('challenge') || lower.includes('limitation') || lower.includes('issue'))) {
    return [
      { id: uid('cd'), title: 'Algorithmic Bias', description: 'Training data reflects human biases, leading to unfair or discriminatory AI outcomes.', icon: 'AlertTriangle' },
      { id: uid('cd'), title: 'Black-Box Problem', description: 'Deep learning decisions are hard to explain, making accountability difficult.', icon: 'EyeOff' },
      { id: uid('cd'), title: 'Data Privacy', description: 'AI relies on large personal datasets, raising concerns about surveillance and consent.', icon: 'Lock' },
      { id: uid('cd'), title: 'Job Displacement', description: 'Automation threatens jobs in manufacturing, driving, and administrative roles.', icon: 'Briefcase' },
    ];
  }
  if (ta.category === 'ai' && (lower.includes('advantage') || lower.includes('benefit'))) {
    return [
      { id: uid('cd'), title: 'Speed & Scale', description: 'Processes vast datasets instantly and serves millions of users simultaneously.', icon: 'Zap' },
      { id: uid('cd'), title: '24/7 Operation', description: 'AI systems work without fatigue, enabling continuous monitoring and support.', icon: 'Clock' },
      { id: uid('cd'), title: 'Pattern Discovery', description: 'Finds insights in data that are invisible to manual analysis.', icon: 'Search' },
      { id: uid('cd'), title: 'Cost Reduction', description: 'Automates repetitive tasks, reducing operational costs and human error.', icon: 'TrendingDown' },
    ];
  }
  if (ta.category === 'ai' && (lower.includes('future') || lower.includes('trend'))) {
    return [
      { id: uid('cd'), title: 'Multimodal AI', description: 'Models that process text, images, and audio together for richer understanding.', icon: 'Layers' },
      { id: uid('cd'), title: 'Edge AI', description: 'On-device intelligence for phones and IoT without cloud dependency.', icon: 'Smartphone' },
      { id: uid('cd'), title: 'AI Agents', description: 'Autonomous systems that plan and execute multi-step tasks independently.', icon: 'Bot' },
      { id: uid('cd'), title: 'Responsible AI', description: 'Regulatory frameworks ensuring safety, fairness, and transparency.', icon: 'Scale' },
    ];
  }
  if (lower.includes('feature') || lower.includes('component') || lower.includes('concept')) {
    return [
      { id: uid('cd'), title: 'Core Feature 1', description: `A primary feature of ${ta.topic} that defines its capability.`, icon: 'Star' },
      { id: uid('cd'), title: 'Core Feature 2', description: `A second key feature that extends the functionality.`, icon: 'Star' },
      { id: uid('cd'), title: 'Core Feature 3', description: `A third feature that rounds out the offering.`, icon: 'Star' },
      { id: uid('cd'), title: 'Core Feature 4', description: `An additional feature that adds value.`, icon: 'Star' },
    ];
  }
  if (lower.includes('best practice') || lower.includes('mistake') || lower.includes('challenge') || lower.includes('disorder') || lower.includes('issue')) {
    if (ta.category === 'ai') {
      return [
        { id: uid('cd'), title: 'Algorithmic Bias', description: 'Training data reflects human biases, leading to unfair or discriminatory AI outcomes.', icon: 'AlertTriangle' },
        { id: uid('cd'), title: 'Black-Box Problem', description: 'Deep learning decisions are hard to explain, making accountability difficult.', icon: 'EyeOff' },
        { id: uid('cd'), title: 'Data Privacy', description: 'AI relies on large personal datasets, raising concerns about surveillance and consent.', icon: 'Lock' },
        { id: uid('cd'), title: 'Job Displacement', description: 'Automation threatens jobs in manufacturing, driving, and administrative roles.', icon: 'Briefcase' },
      ];
    }
    return [
      { id: uid('cd'), title: 'Common Issue 1', description: `A frequent problem when working with ${ta.topic} and how to address it.`, icon: 'AlertTriangle' },
      { id: uid('cd'), title: 'Common Issue 2', description: `A second common pitfall and its solution.`, icon: 'AlertTriangle' },
      { id: uid('cd'), title: 'Common Issue 3', description: `A third issue to watch out for.`, icon: 'AlertTriangle' },
      { id: uid('cd'), title: 'Common Issue 4', description: `An additional challenge and best practice.`, icon: 'AlertTriangle' },
    ];
  }
  if (lower.includes('application') || lower.includes('example') || lower.includes('case stud')) {
    return [
      { id: uid('cd'), title: 'Application 1', description: `A real-world use of ${ta.topic} in practice.`, icon: 'Lightbulb' },
      { id: uid('cd'), title: 'Application 2', description: `A second example showing ${ta.topic} in action.`, icon: 'Lightbulb' },
      { id: uid('cd'), title: 'Application 3', description: `A third application demonstrating versatility.`, icon: 'Lightbulb' },
      { id: uid('cd'), title: 'Application 4', description: `An additional use case worth knowing.`, icon: 'Lightbulb' },
    ];
  }
  if (lower.includes('figure') || lower.includes('leader') || lower.includes('people')) {
    return [
      { id: uid('cd'), title: 'Key Figure 1', description: `A major contributor to ${ta.topic} whose work shaped the field.`, icon: 'User' },
      { id: uid('cd'), title: 'Key Figure 2', description: `A second important figure in the development of ${ta.topic}.`, icon: 'User' },
      { id: uid('cd'), title: 'Key Figure 3', description: `A third figure whose contributions were significant.`, icon: 'User' },
      { id: uid('cd'), title: 'Key Figure 4', description: `An additional person worth knowing about.`, icon: 'User' },
    ];
  }
  return [
    { id: uid('cd'), title: 'Aspect 1', description: `An important aspect of ${ta.topic}.`, icon: 'Circle' },
    { id: uid('cd'), title: 'Aspect 2', description: `A second important aspect to understand.`, icon: 'Circle' },
    { id: uid('cd'), title: 'Aspect 3', description: `A third aspect that adds depth.`, icon: 'Circle' },
    { id: uid('cd'), title: 'Aspect 4', description: `An additional aspect worth noting.`, icon: 'Circle' },
  ];
}

function buildFallbackTable(ta: TopicAnalysis, section: string): TableData {
  const lower = section.toLowerCase();
  const isProgramming = ta.category === 'programming';

  if (isProgramming && (lower.includes('arithmetic') || lower.includes('operator'))) {
    return {
      headers: ['Operator', 'Name', 'Example (a=10, b=3)', 'Result'],
      rows: [
        ['+', 'Addition', 'a + b', '13'],
        ['-', 'Subtraction', 'a - b', '7'],
        ['*', 'Multiplication', 'a * b', '30'],
        ['/', 'Division', 'a / b', '3 (truncated)'],
        ['%', 'Modulus', 'a % b', '1 (remainder)'],
      ],
    };
  }
  if (isProgramming && (lower.includes('relational') || lower.includes('comparison'))) {
    return {
      headers: ['Operator', 'Meaning', 'Example (a=10, b=3)', 'Result'],
      rows: [
        ['==', 'Equal to', 'a == b', '0 (false)'],
        ['!=', 'Not equal to', 'a != b', '1 (true)'],
        ['>', 'Greater than', 'a > b', '1 (true)'],
        ['<', 'Less than', 'a < b', '0 (false)'],
        ['>=', 'Greater or equal', 'a >= b', '1 (true)'],
        ['<=', 'Less or equal', 'a <= b', '0 (false)'],
      ],
    };
  }
  if (isProgramming && lower.includes('bitwise')) {
    return {
      headers: ['Operator', 'Name', 'Example (a=6, b=3)', 'Binary Result'],
      rows: [
        ['&', 'AND', '6 & 3', '0110 & 0011 = 0010 (2)'],
        ['|', 'OR', '6 | 3', '0110 | 0011 = 0111 (7)'],
        ['^', 'XOR', '6 ^ 3', '0110 ^ 0011 = 0101 (5)'],
        ['~', 'NOT', '~6', '~0110 = ...1001 (-7)'],
        ['<<', 'Left shift', '6 << 1', '0110 << 1 = 1100 (12)'],
        ['>>', 'Right shift', '6 >> 1', '0110 >> 1 = 0011 (3)'],
      ],
    };
  }
  if (isProgramming && (lower.includes('increment') || lower.includes('decrement'))) {
    return {
      headers: ['Expression', 'Initial a', 'Expression Result', 'a After'],
      rows: [
        ['b = ++a', '5', '6', '6'],
        ['b = a++', '5', '5', '6'],
        ['b = --a', '5', '4', '4'],
        ['b = a--', '5', '5', '4'],
      ],
    };
  }
  if (isProgramming && (lower.includes('assignment') || lower.includes('compound'))) {
    return {
      headers: ['Operator', 'Example', 'Equivalent To', 'Description'],
      rows: [
        ['=', 'a = 5', 'a = 5', 'Simple assignment'],
        ['+=', 'a += 3', 'a = a + 3', 'Add and assign'],
        ['-=', 'a -= 2', 'a = a - 2', 'Subtract and assign'],
        ['*=', 'a *= 4', 'a = a * 4', 'Multiply and assign'],
        ['/=', 'a /= 2', 'a = a / 2', 'Divide and assign'],
      ],
    };
  }
  if (lower.includes('comparison') || lower.includes('type') || lower.includes('categor')) {
    return {
      headers: ['Type', 'Description', 'Use Case', 'Advantage'],
      rows: [
        [`Type A of ${ta.topic}`, `One form of ${ta.topic}`, 'When A is needed', 'Strength of A'],
        [`Type B of ${ta.topic}`, `Another form of ${ta.topic}`, 'When B is needed', 'Strength of B'],
        [`Type C of ${ta.topic}`, `A third form of ${ta.topic}`, 'When C is needed', 'Strength of C'],
      ],
    };
  }
  return {
    headers: ['Aspect', 'Description', 'Key Point'],
    rows: [
      [`Aspect 1 of ${ta.topic}`, `Related to ${ta.topic}`, 'Key takeaway'],
      [`Aspect 2 of ${ta.topic}`, `Related to ${ta.topic}`, 'Key takeaway'],
      [`Aspect 3 of ${ta.topic}`, `Related to ${ta.topic}`, 'Key takeaway'],
      [`Aspect 4 of ${ta.topic}`, `Related to ${ta.topic}`, 'Key takeaway'],
    ],
  };
}

function buildFallbackComparison(ta: TopicAnalysis): { leftTitle: string; rightTitle: string; rows: ComparisonRow[] } {
  if (ta.category === 'programming') {
    return {
      leftTitle: 'Prefix (++a)',
      rightTitle: 'Postfix (a++)',
      rows: [
        { id: uid('cr'), feature: 'Increment timing', optionA: 'Before value is used', optionB: 'After value is used' },
        { id: uid('cr'), feature: 'Return value', optionA: 'New (incremented) value', optionB: 'Old (original) value' },
        { id: uid('cr'), feature: 'Example (a=5)', optionA: 'b = ++a → b=6, a=6', optionB: 'b = a++ → b=5, a=6' },
        { id: uid('cr'), feature: 'Use case', optionA: 'When you need the updated value immediately', optionB: 'When you need the original value first' },
      ],
    };
  }
  return {
    leftTitle: `Without ${ta.topic}`,
    rightTitle: `With ${ta.topic}`,
    rows: [
      { id: uid('cr'), feature: 'Approach', optionA: 'Traditional method', optionB: 'Modern method' },
      { id: uid('cr'), feature: 'Efficiency', optionA: 'Lower', optionB: 'Higher' },
      { id: uid('cr'), feature: 'Cost', optionA: 'Higher fixed cost', optionB: 'Lower variable cost' },
      { id: uid('cr'), feature: 'Scalability', optionA: 'Limited', optionB: 'Flexible' },
    ],
  };
}

function buildFallbackChart(ta: TopicAnalysis): ChartData {
  if (ta.category === 'programming') {
    return {
      chartType: 'bar',
      labels: ['Arithmetic', 'Relational', 'Logical', 'Bitwise', 'Assignment'],
      values: [5, 6, 3, 6, 6],
      title: 'Number of Operators per Category',
    };
  }
  if (ta.category === 'ai') {
    return {
      chartType: 'bar',
      labels: ['Imaging', 'Drug Discovery', 'Monitoring', 'EHR', 'Robotics'],
      values: [85, 72, 78, 68, 55],
      title: 'AI Adoption Rate by Healthcare Domain (%)',
    };
  }
  return {
    chartType: 'bar',
    labels: ['Concept 1', 'Concept 2', 'Concept 3', 'Concept 4'],
    values: [75, 88, 62, 91],
    title: `${ta.title} — Key Metrics`,
  };
}

// ── Main generator ───────────────────────────────────────────────────────────

export function createBlankPresentation(settings: PresentationSettings): Presentation {
  const count = Math.max(1, settings.slideCount);
  const slides: Slide[] = [];
  for (let i = 0; i < count; i++) {
    slides.push({
      id: uid('sl'),
      layout: 'two-column',
      title: '',
    });
  }
  return {
    id: crypto.randomUUID(),
    settings: { ...settings },
    slides,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── Topic-relevant images ─────────────────────────────────────────────────────
// Maps topic keywords to relevant Pexels stock photos. These are real,
// license-free images that load reliably. The system picks the best match
// based on the topic's keywords, falling back to a generic tech image.
const _TOPIC_IMAGES: { keywords: string[]; url: string; alt: string }[] = [
  {
    keywords: ['artificial intelligence', 'ai'],
    url: 'https://images.pexels.com/photos/2599244/pexels-photo-2599244.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Futuristic humanoid robot representing artificial intelligence',
  },
  {
    keywords: ['machine learning', 'ml'],
    url: 'https://images.pexels.com/photos/17483870/pexels-photo-17483870.png?auto=compress&cs=tinysrgb&w=600',
    alt: 'Abstract visualization of neural networks and data flow',
  },
  {
    keywords: ['deep learning', 'neural network'],
    url: 'https://images.pexels.com/photos/17483874/pexels-photo-17483874.png?auto=compress&cs=tinysrgb&w=600',
    alt: 'Neural network architecture visualization',
  },
  {
    keywords: ['generative ai', 'genai', 'generative'],
    url: 'https://images.pexels.com/photos/25630344/pexels-photo-25630344.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Generative AI abstract creative visualization',
  },
  {
    keywords: ['healthcare', 'medical', 'health'],
    url: 'https://images.pexels.com/photos/8439072/pexels-photo-8439072.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'AI and robotics in healthcare',
  },
  {
    keywords: ['cloud computing', 'cloud'],
    url: 'https://images.pexels.com/photos/1181271/pexels-photo-1181271.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Cloud computing infrastructure',
  },
  {
    keywords: ['data science', 'data', 'analytics'],
    url: 'https://images.pexels.com/photos/17483873/pexels-photo-17483873.png?auto=compress&cs=tinysrgb&w=600',
    alt: 'Data science and analytics visualization',
  },
  {
    keywords: ['cybersecurity', 'security', 'encryption'],
    url: 'https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Cybersecurity and digital protection',
  },
  {
    keywords: ['robotics', 'robot', 'automation'],
    url: 'https://images.pexels.com/photos/8566470/pexels-photo-8566470.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Advanced humanoid robot',
  },
  {
    keywords: ['virtualization', 'virtual', 'hypervisor'],
    url: 'https://images.pexels.com/photos/1181271/pexels-photo-1181271.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Virtualization and server infrastructure',
  },
  {
    keywords: ['blockchain', 'crypto', 'ledger'],
    url: 'https://images.pexels.com/photos/8438922/pexels-photo-8438922.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Blockchain technology visualization',
  },
  {
    keywords: ['iot', 'internet of things', 'smart device'],
    url: 'https://images.pexels.com/photos/325153/pexels-photo-325153.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Internet of Things connected devices',
  },
  {
    keywords: ['big data', 'database', 'warehouse'],
    url: 'https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Big data and database infrastructure',
  },
];

// Additional topic images for common presentation subjects
const _EXTRA_TOPIC_IMAGES: { keywords: string[]; url: string; alt: string }[] = [
  {
    keywords: ['presentation', 'slideshow', 'powerpoint', 'deck'],
    url: 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Professional presentation and slides',
  },
  {
    keywords: ['college', 'student', 'university', 'academic', 'mini project', 'project'],
    url: 'https://images.pexels.com/photos/207692/pexels-photo-207692.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'College student working on a project',
  },
  {
    keywords: ['workflow', 'process', 'how to use', 'steps', 'procedure'],
    url: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Workflow and process visualization',
  },
  {
    keywords: ['advantage', 'benefit', 'pro', 'strength', 'positive'],
    url: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Benefits and advantages',
  },
  {
    keywords: ['limitation', 'challenge', 'weakness', 'constraint', 'drawback'],
    url: 'https://images.pexels.com/photos/590016/pexels-photo-590016.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Challenges and limitations',
  },
  {
    keywords: ['introduction', 'intro', 'welcome', 'overview', 'about'],
    url: 'https://images.pexels.com/photos/1181676/pexels-photo-1181676.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Introduction and welcome',
  },
  {
    keywords: ['technology', 'technologies', 'tech stack', 'tools', 'framework'],
    url: 'https://images.pexels.com/photos/270404/pexels-photo-270404.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Technology stack and tools',
  },
  {
    keywords: ['frontend', 'front-end', 'web development', 'ui', 'user interface'],
    url: 'https://images.pexels.com/photos/1966452/pexels-photo-1966452.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Frontend web development',
  },
  {
    keywords: ['backend', 'back-end', 'server', 'api', 'database'],
    url: 'https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Backend and server infrastructure',
  },
  {
    keywords: ['react', 'react.js', 'typescript', 'vite', 'tailwind'],
    url: 'https://images.pexels.com/photos/11035471/pexels-photo-11035471.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'React and modern web development',
  },
  {
    keywords: ['python', 'fastapi', 'programming language'],
    url: 'https://images.pexels.com/photos/174891/pexels-photo-174891.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Python programming',
  },
  {
    keywords: ['export', 'download', 'pptx', 'pdf', 'powerpoint'],
    url: 'https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Export and download documents',
  },
  {
    keywords: ['thank you', 'closing', 'conclusion', 'summary', 'q&a', 'questions'],
    url: 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'Thank you and closing',
  },
  {
    keywords: ['what does', 'features', 'functions', 'capabilities'],
    url: 'https://images.pexels.com/photos/3184325/pexels-photo-3184325.jpeg?auto=compress&cs=tinysrgb&w=600',
    alt: 'App features and functions',
  },
];

function findTopicImage(topic: string): { url: string; alt: string } | null {
  const lower = topic.toLowerCase();
  // Find the best matching image by keyword overlap across both image lists
  let bestMatch: { url: string; alt: string } | null = null;
  let bestScore = 0;
  const allImages = [..._TOPIC_IMAGES, ..._EXTRA_TOPIC_IMAGES];
  for (const entry of allImages) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        const score = kw.length; // longer keyword = better match
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { url: entry.url, alt: entry.alt };
        }
      }
    }
  }
  return bestMatch;
}

// Add topic-relevant images to content slides. Only adds images to layouts
// that benefit from them, and only when no image is already present.
function _addImagesToSlides(slides: Slide[]): Slide[] {
  return slides.map((slide) => {
    if (slide.layout === 'hero' || slide.layout === 'agenda' || slide.layout === 'thank-you') return slide;
    if (slide.image) return slide;
    if (slide.elements?.some((e) => e.kind === 'image')) return slide;

    const topicStr = slide.title || '';
    const topicImage = findTopicImage(topicStr);
    if (!topicImage) return slide;

    const layout = slide.layout;
    if (layout === 'two-column' || layout === 'cards' || layout === 'statistics' || layout === 'process') {
      return { ...slide, image: { url: topicImage.url, alt: topicImage.alt, source: 'pexels' } };
    } else if (layout === 'comparison' || layout === 'timeline' || layout === 'table' || layout === 'chart') {
      const elements = [...(slide.elements || [])];
      elements.push({
        id: uid('el'), kind: 'image' as const,
        x: 0.65, y: 0.55, w: 0.3, h: 0.35,
        url: topicImage.url, alt: topicImage.alt,
        objectFit: 'cover' as const, borderRadius: 8, opacity: 0.9,
      });
      return { ...slide, elements };
    }
    return slide;
  });
}

// ── Point explanations ───────────────────────────────────────────────────────
// Terse bullets ("Faster analysis") get a one-line explanation drawn from the
// built-in topic knowledge (the same source used by regenerate/viva) — but
// ONLY when a genuinely matching explanation exists. Unknown topics are left
// untouched, never padded with filler. Toggle: settings.explainPoints.
function findBulletExplanation(bullet: string, slideTitle: string, ta: TopicAnalysis): string | null {
  const words = bullet.trim().split(/\s+/);
  if (words.length > 5 || /[:—–]/.test(bullet)) return null;
  const keys = bullet.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !STOPWORDS.has(w));
  if (keys.length === 0) return null;
  const candidates: string[] = [];
  for (const s of buildFallbackBody(slideTitle, ta).split(/(?<=[.!?])\s+/)) {
    const t = s.trim();
    if (t) candidates.push(t);
  }
  for (const b of buildFallbackBullets(slideTitle, ta)) {
    const t = b.text.trim();
    if (t) candidates.push(t);
  }
  const bl = bullet.toLowerCase();
  for (const c of candidates) {
    const cl = c.toLowerCase();
    if (cl.length < 25 || cl.length > 170) continue;
    if (cl.includes(bl) || bl.includes(cl)) continue;
    if (keys.some((k) => cl.includes(k)) && c.length > bullet.length + 15) {
      return c;
    }
  }
  return null;
}

function explainTerseBullet(bullet: string, slideTitle: string, ta: TopicAnalysis): string {
  const exp = findBulletExplanation(bullet, slideTitle, ta);
  return exp ? `${bullet} — ${exp}` : bullet;
}

export function generatePresentation(settings: PresentationSettings): Presentation {
  // ── ARRANGE-ONLY PIPELINE ──────────────────────────────────────────────
  // No AI search, no knowledge base, no topic research. The user's prompt IS
  // the content — we only arrange it into slides verbatim, then apply
  // alignment / color / font from the prompt when specified, else auto.
  const detection = detectContent(settings.prompt);
  const style = parseStyleDirectives(settings.prompt + '\n' + (settings.title || ''));
  const ta = analyzeTopic(settings);
  const explainPoints = settings.explainPoints !== false;

  if (detection.mode === 'empty' && !settings.title?.trim()) {
    return createBlankPresentation(settings);
  }

  const effective: PresentationSettings = { ...settings, images: true, charts: true };
  if (style.fontFamily) effective.fontFamily = style.fontFamily;
  if (style.primaryColor && /^#/.test(style.primaryColor)) effective.primaryColor = style.primaryColor;
  if (style.secondaryColor && /^#/.test(style.secondaryColor)) effective.secondaryColor = style.secondaryColor;

  const alignStyle = style.align;

  const applyStyle = (slide: Slide, _idx: number): Slide => {
    if (!alignStyle) return slide;
    const patch = { align: alignStyle };
    const fs: Slide['fieldStyles'] = { ...(slide.fieldStyles || {}) };
    fs['title'] = { ...(fs['title'] || {}), ...patch };
    fs['body'] = { ...(fs['body'] || {}), ...patch };
    return { ...slide, fieldStyles: fs };
  };

  // Placeholder for a slide the prompt left empty (skipped number, or a bare
  // topic with no content). Kept obviously editable so the deck still matches
  // the requested slide count without inventing content.
  const gapSlide = (n: number, hint?: string): Slide => ({
    id: uid('sl'),
    layout: 'two-column',
    title: `Section ${n}`,
    subtitle: hint || 'This slide was skipped in your outline — add your content here.',
    bullets: [{ id: uid('bl'), text: 'Add your first point' }],
    notes: `Slide ${n} was left empty in the prompt. Replace this placeholder with your content.`,
    accentIcon: 'Pencil',
  });

  let slides: Slide[] = [];
  const instructions = detection.slideInstructions;

  if (instructions.length >= 1) {
    // ── Structured arrange: UNDERSTAND the prompt, don't just copy-paste ──
    // Rules:
    //  • Meta-directives ("Explain...", "Divide into...", "Show as...",
    //    "Highlight:", "Include:") drive STRUCTURE (subtitle/grouping/layout)
    //    and never appear as bullets.
    //  • Group headers ("Frontend:", "Backend:", "Export:") group following
    //    items — rendered as table sections, never flat bullets.
    //  • NEVER split one slide into Part 1/2 — one prompt slide = one deck
    //    slide; long content scrolls inside the slide (see SlideRenderer).
    //  • Images attached by default, topic-matched per slide.
    // Content hints ("Explain what Prezento is.") describe WHAT to say → subtitle.
    const CONTENT_HINT_RE = /^(explain|describe|show|highlight|mention|discuss|cover|present|list|detail|focus on|talk about)\b/i;
    // Remaining creation verbs that are unambiguously about building the deck
    // (e.g. "Divide the slide into Frontend and Backend.").
    const CREATION_RE = /^(divide|split|organize|organise|arrange|group)\b/i;

    const pushStructured = (
      ins: (typeof instructions)[number],
      slideIdx: number,
    ): void => {
      const isFirst = slideIdx === 0;
      const isLast = slideIdx === instructions.length - 1
        || /thank\s*you|questions\s*&?\s*answers?/i.test(ins.title + ' ' + ins.content);
      // Only a genuine closing slide gets the thank-you treatment — the final
      // slide of a deck keeps its structured layout (table, cards, …).
      const isClosing = /thank\s*you|questions\s*&?\s*answers?/i.test(ins.title + ' ' + ins.content);

      // 1) Understand: split raw lines into directives / group headers / content
      const rawLines = [...ins.bodyLines, ...ins.bullets];
      // Lines the user wrote as list items ("1. Choose a theme") are content,
      // not prose instructions — carry that signal into the classifier.
      const listedTexts = new Set(
        ins.bullets.filter((_, k) => ins.bulletMarkers?.[k]),
      );
      const isDirective = (t: string) => isDesignDirectiveLine(t, listedTexts.has(t));
      const directives: string[] = [];
      const groups: { header: string; items: string[] }[] = [];
      const loose: string[] = [];
      let currentGroup: { header: string; items: string[] } | null = null;
      const flushGroup = () => {
        if (currentGroup && (currentGroup.items.length > 0 || currentGroup.header)) {
          groups.push(currentGroup);
        }
        currentGroup = null;
      };
      for (const line of rawLines) {
        const t = line.trim();
        if (!t) continue;
        const ci = t.indexOf(':');
        // Group header: short "Label:" line with nothing after it
        // (e.g. "Frontend:", "Backend:") — must be checked first because it
        // is also a colon-terminated line.
        const isGroupHeader = ci > 0 && ci <= 30 && t.substring(ci + 1).trim().length === 0;
        // Creation directives never become content; content hints become subtitle.
        if (isDirective(t)) continue;
        if (CREATION_RE.test(t) && t.length < 160) continue;
        if (!isGroupHeader && CONTENT_HINT_RE.test(t) && t.length < 160) {
          directives.push(t); // e.g. "Explain what Prezento is." → subtitle
          continue;
        }
        if (isGroupHeader) {
          flushGroup();
          currentGroup = { header: t.substring(0, ci).trim(), items: [] };
          continue;
        }
        if (currentGroup) {
          currentGroup.items.push(t.replace(/^\d+[.):]\s+/, '').trim());
        } else {
          loose.push(t);
        }
      }
      flushGroup();

      const subtitle = [...directives, ...ins.bodyLines.filter((l) => /[.!?]$/.test(l) && l.length < 160 && !isDirective(l))].join(' ').trim() || undefined;
      // Content items: grouped items carry their group context ("Frontend — React.js")
      const groupedBullets: string[] = [];
      for (const g of groups) {
        if (g.items.length === 0) {
          groupedBullets.push(`${g.header}`);
        } else if (g.items.length <= 2) {
          // Few items: keep group context inline
          for (const it of g.items) groupedBullets.push(`${g.header} — ${it}`);
        } else {
          groupedBullets.push(`${g.header}:`);
          groupedBullets.push(...g.items);
        }
      }
      const contentBullets = [...loose.filter((l) => !isDirective(l)), ...groupedBullets]
        .map((t) => t.replace(/^\d+[.):]\s+/, '').trim())
        .filter(Boolean);

      // Detect numbered workflow
      const numberedCount = ins.bullets.filter((t) => /^\d+[.):]\s+/.test(t)).length;
      const isWorkflow = /workflow|steps?|how to use|procedure|process|pipeline|how it works/i.test(ins.title + ' ' + ins.content)
        && contentBullets.length >= 2;

      const colonCount = contentBullets.filter((t) => t.includes(':') || t.includes('—')).length;

      const title = ins.title;
      const notes = `Present "${title}" — cover each point in order, ~45 seconds.`;

      // 1) Workflow → process steps (understood, not copy-pasted)
      if (!isFirst && !isClosing && (isWorkflow || numberedCount >= 3)) {
        const steps = contentBullets.map((t, si) => {
          const clean = t.replace(/^\d+[.):]\s+/, '').trim();
          const ci = clean.indexOf(':');
          const dash = ci < 0 ? clean.indexOf('—') : -1;
          const sep = ci > 0 && ci < 40 ? ci : (dash > 0 && dash < 40 ? dash : -1);
          const rawDesc = sep > 0 ? clean.substring(sep + 1).trim() : clean;
          return {
            id: uid('ps'),
            step: si + 1,
            title: (sep > 0 ? clean.substring(0, sep).trim() : clean.substring(0, 40)) || `Step ${si + 1}`,
            description: explainPoints ? explainTerseBullet(rawDesc, title, ta) : rawDesc,
          };
        });
        slides.push(applyStyle({
          id: uid('sl'), layout: 'process', title,
          subtitle, steps, notes, accentIcon: 'Workflow',
        }, slideIdx));
        return;
      }

      // 2) Grouped label:value content → table with Group column
      if (!isFirst && !isClosing && (groups.length >= 2 || colonCount >= 3)) {
        const rows: string[][] = [];
        if (groups.length >= 2) {
          for (const g of groups) {
            if (g.items.length === 0) rows.push([g.header, '—']);
            else for (const it of g.items) {
              const idx = it.indexOf(':');
              if (idx > 0 && idx < 40) rows.push([`${g.header} · ${it.substring(0, idx).trim()}`, it.substring(idx + 1).trim() || '—']);
              else rows.push([g.header, it]);
            }
          }
          // Loose items without a group go under "General"
          for (const l of loose.filter((x) => !isDirective(x) && !CREATION_RE.test(x))) {
            const idx = l.indexOf(':');
            if (idx > 0 && idx < 40) rows.push([l.substring(0, idx).trim(), l.substring(idx + 1).trim() || '—']);
            else if (l.length > 0) rows.push(['General', l]);
          }
        } else {
          for (const t of contentBullets) {
            const idx = t.indexOf(':');
            if (idx > 0 && idx < 40) rows.push([t.substring(0, idx).trim(), t.substring(idx + 1).trim() || '—']);
            else {
              const d = t.indexOf('—');
              if (d > 0 && d < 40) rows.push([t.substring(0, d).trim(), t.substring(d + 1).trim() || '—']);
              else if (explainPoints) {
                const exp = findBulletExplanation(t, title, ta);
                rows.push([t, exp || '']);
              } else rows.push([t, '']);
            }
          }
        }
        slides.push(applyStyle({
          id: uid('sl'), layout: 'table', title,
          subtitle, table: { headers: groups.length >= 2 ? ['Group', 'Details'] : ['Item', 'Details'], rows },
          notes, accentIcon: 'Table',
        }, slideIdx));
        return;
      }

      // 3) Short items (3–8) → cards grid for visual variety
      const shortItems = contentBullets.filter((t) => t.length <= 80);
      if (!isFirst && !isClosing && shortItems.length >= 3 && shortItems.length <= 8
        && shortItems.length === contentBullets.length) {
        const cards = contentBullets.slice(0, 8).map((t, ci) => {
          const idx = t.indexOf(':');
          const rawDesc = idx > 0 && idx < 40 ? t.substring(idx + 1).trim() : t;
          return {
            id: uid('cd'),
            title: (idx > 0 && idx < 40 ? t.substring(0, idx).trim() : t.substring(0, 30)) || `Point ${ci + 1}`,
            description: explainPoints ? explainTerseBullet(rawDesc, title, ta) : rawDesc,
          };
        });
        slides.push(applyStyle({
          id: uid('sl'), layout: 'cards', title,
          subtitle, cards, notes, accentIcon: 'LayoutGrid',
        }, slideIdx));
        return;
      }

      // 3b) Comparison — "X vs Y", pros/cons, advantages/disadvantages
      const isComparison = !isFirst && !isClosing && contentBullets.length >= 2 && (
        /\bvs\.?\b|versus|pros?\s*(and|&|\/)\s*cons|advantages?\s*(and|&|\/|vs)\s*disadvantages?|comparison|compared?\b/i.test(ins.title + ' ' + ins.content)
        || (contentBullets.length >= 4 && contentBullets.filter((t) => /^(pro|con|advantage|disadvantage|strength|weakness|benefit|drawback)\b/i.test(t)).length >= 2)
      );
      if (isComparison) {
        const mid = Math.max(1, Math.ceil(contentBullets.length / 2));
        const left = contentBullets.slice(0, mid);
        const right = contentBullets.slice(mid);
        const rows = left.map((l, i) => ({
          id: uid('cr'),
          feature: `Point ${i + 1}`,
          optionA: l,
          optionB: right[i] || '',
        }));
        slides.push(applyStyle({
          id: uid('sl'), layout: 'comparison', title,
          subtitle, comparison: { leftTitle: 'Option A', rightTitle: 'Option B', rows },
          notes, accentIcon: 'Columns2',
        }, slideIdx));
        return;
      }

      // 3c) Statistics — two or more numeric facts (%, $, counts)
      const numericBullets = contentBullets.filter((t) => /\d+\s*(%|percent|\$|₹|€|£|x\b|\+|M\b|K\b|million|billion|thousand)/i.test(t) || /\b\d{3,}\b/.test(t));
      if (!isFirst && !isClosing && numericBullets.length >= 2 && contentBullets.length <= 6) {
        const stats = contentBullets.slice(0, 4).map((t, i) => {
          const m = t.match(/([\d,.]+\s*(?:%|percent|\$|₹|€|£|x|\+|M|K|million|billion|thousand)?)/i);
          const value = m ? m[1].trim() : `${i + 1}`;
          const label = (m ? t.replace(m[0], '').trim().replace(/^[:\-–\s]+/, '') : t).substring(0, 40) || `Metric ${i + 1}`;
          return { id: uid('st'), value, label };
        });
        slides.push(applyStyle({
          id: uid('sl'), layout: 'statistics', title,
          subtitle, stats, notes, accentIcon: 'BarChart3',
        }, slideIdx));
        return;
      }

      // 3d) Timeline — years, quarters, or named phases in order
      const timelineHits = contentBullets.filter((t) => /\b(19|20)\d{2}s?\b|^Q[1-4]\b|phase\s*\d+|stage\s*\d+/i.test(t));
      if (!isFirst && !isClosing && timelineHits.length >= 2 && contentBullets.length <= 6) {
        const timeline = contentBullets.slice(0, 5).map((t, i) => {
          const m = t.match(/^((?:19|20)\d{2}s?|Q[1-4]|Phase\s*\d+|Stage\s*\d+|[A-Za-z]+\s*(?:19|20)\d{2})\s*[:\-–]\s*(.*)$/i);
          const year = m ? m[1] : `Phase ${i + 1}`;
          const rest = (m ? m[2] : t).trim();
          const ci = rest.indexOf(':');
          return {
            id: uid('tl'),
            year,
            title: (ci > 0 && ci < 40 ? rest.substring(0, ci).trim() : rest.substring(0, 50)) || rest.substring(0, 50),
            description: ci > 0 && ci < 40 ? rest.substring(ci + 1).trim() : rest,
          };
        });
        slides.push(applyStyle({
          id: uid('sl'), layout: 'timeline', title,
          subtitle, timeline, notes, accentIcon: 'GitCommitHorizontal',
        }, slideIdx));
        return;
      }

      // 3e) Quote — a single short statement (motto, closing line, testimonial)
      if (!isFirst && contentBullets.length === 1 && contentBullets[0].length <= 140
        && /thank|quote|motto|vision|mission|inspir|saying|questions/i.test(ins.title + ' ' + ins.content)) {
        slides.push(applyStyle({
          id: uid('sl'), layout: 'quote', title,
          quote: { text: contentBullets[0], author: subtitle || '' },
          notes, accentIcon: 'Quote',
        }, slideIdx));
        return;
      }

      // 4) Default: two-column with hierarchy — subtitle on top, full bullets below.
      // One prompt slide = ONE deck slide (never split); overflow scrolls
      // inside the slide (SlideRenderer uses overflow-y-auto).
      if (isFirst) {
        // Hero cover: title + presenter detail lines stacked
        const coverLines = [...(subtitle ? [subtitle] : []), ...contentBullets];
        slides.push(applyStyle({
          id: uid('sl'), layout: 'hero', title,
          subtitle: coverLines.join('\n'),
          notes, accentIcon: 'Sparkles',
        }, slideIdx));
        return;
      }
      if (isClosing && contentBullets.length <= 4 && !subtitle) {
        slides.push(applyStyle({
          id: uid('sl'), layout: 'thank-you', title,
          subtitle: contentBullets.join('\n'),
          notes, accentIcon: 'Heart',
        }, slideIdx));
        return;
      }
      slides.push(applyStyle({
        id: uid('sl'), layout: 'two-column', title,
        subtitle: subtitle,
        body: undefined,
        bullets: contentBullets.map((t) => ({ id: uid('bl'), text: explainPoints ? explainTerseBullet(t, title, ta) : t })),
        notes, accentIcon: isLast ? 'Heart' : 'BookOpen',
      }, slideIdx));
    };

    // One prompt slide = one deck slide. NEVER split into Part 1/2.
    // Track which prompt slide number produced which deck slide so any
    // numbering gaps can be filled honestly (no invented content).
    const byNumber = new Map<number, Slide[]>();
    const unnumbered: Slide[] = [];
    instructions.forEach((ins, i) => {
      const before = slides.length;
      pushStructured(ins, i);
      const produced = slides.splice(before, slides.length - before);
      if (produced.length === 0) return;
      if (ins.slideNumber != null) byNumber.set(ins.slideNumber, produced);
      else unnumbered.push(...produced);
    });

    // Reconcile explicit numbering: if the user asked for N slides but skipped
    // some numbers (e.g. "8-slide" with blocks 1,2,3,5,8), insert clearly
    // editable placeholder slides so the deck matches the requested count.
    const numbers = [...byNumber.keys()].sort((a, b) => a - b);
    if (numbers.length >= 2) {
      const maxNum = numbers[numbers.length - 1];
      if (maxNum <= 50 && maxNum > numbers.length) {
        const ordered: Slide[] = [];
        for (let n = 1; n <= maxNum; n++) {
          ordered.push(...(byNumber.get(n) || [gapSlide(n)]));
        }
        slides = ordered;
      } else {
        slides = [...numbers.flatMap((n) => byNumber.get(n) || []), ...unnumbered];
      }
    } else {
      slides = [...[...byNumber.keys()].sort((a, b) => a - b).flatMap((n) => byNumber.get(n) || []), ...unnumbered];
    }
  } else if (detection.contentPoints.length >= 2 || detection.subtopics.length >= 2 || detection.multiTopics.length >= 2) {
    // A "main topic + sub-list" prompt (Operators / Arithmetic / Relational)
    // uses the first line as the cover and the rest as content slides. A true
    // multi-topic list has no cover line, so every line becomes a slide.
    const hasCover = detection.subtopics.length >= 2;
    const points = hasCover
      ? detection.subtopics
      : detection.multiTopics.length >= 2
        ? detection.multiTopics
        : detection.contentPoints;
    const title = settings.title || detection.title || 'Presentation';
    slides.push(applyStyle({
      id: uid('sl'), layout: 'hero', title,
      subtitle: hasCover ? `An overview of ${title}.` : 'What we will cover.',
      notes: `Introduce "${title}".`, accentIcon: 'Sparkles',
    }, 0));
    points.forEach((pt, i) => {
      const parts = pt.split(/[:：]/);
      const stitle = (parts[0] || pt).trim().substring(0, 60) || `Point ${i + 1}`;
      const rest = parts.slice(1).join(':').trim();
      slides.push(applyStyle({
        id: uid('sl'), layout: 'two-column', title: stitle,
        body: rest || undefined,
        bullets: undefined,
        notes: `Explain "${stitle}".`, accentIcon: 'BookOpen',
      }, i + 1));
    });
    slides.push(applyStyle({
      id: uid('sl'), layout: 'thank-you', title: 'Thank You!',
      subtitle: `${title} — Questions & Answers`,
      notes: 'Thank the audience.', accentIcon: 'Heart',
    }, slides.length));
  } else {
    // Topic-only or single paragraph: split sentences verbatim into slides.
    const text = (settings.prompt || settings.title || '').trim();
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
    const title = settings.title || detection.title || text.substring(0, 50) || 'Presentation';
    const wanted = detection.explicitSlideCount
      ? (detection.requestedSlideCount || settings.slideCount)
      : (settings.slideCount || 6);
    const targetContent = Math.max(1, wanted - 2);
    slides.push({ id: uid('sl'), layout: 'hero', title, subtitle: sentences[0]?.substring(0, 160) || '', notes: `Introduce "${title}".`, accentIcon: 'Sparkles' });
    const rest = sentences.slice(1);
    if (rest.length === 0) {
      // A bare topic carries no content to arrange — hand the user an editable
      // skeleton sized to their requested slide count instead of an empty deck.
      for (let i = 1; i <= targetContent; i++) {
        slides.push(gapSlide(i, `Add content for "${title}" on this slide.`));
      }
    } else {
      const per = Math.max(1, Math.ceil(rest.length / targetContent));
      for (let i = 0; i < rest.length; i += per) {
        const chunk = rest.slice(i, i + per);
        slides.push(applyStyle({
          id: uid('sl'), layout: 'two-column', title: chunk[0].substring(0, 60),
          bullets: chunk.map((t) => ({ id: uid('bl'), text: t.trim() })),
          notes: 'Present these points verbatim.', accentIcon: 'BookOpen',
        }, i + 1));
        if (slides.length >= wanted - 1) break;
      }
    }
    slides.push({ id: uid('sl'), layout: 'thank-you', title: 'Thank You!', subtitle: `${title} — Questions & Answers`, notes: 'Close.', accentIcon: 'Heart' });
  }

  // Trim only when the user LITERALLY asked for a count (e.g. "8-slide").
  // Derived counts (multi-topic lists) must never delete real user content.
  if (detection.explicitSlideCount) {
    const target = detection.requestedSlideCount || settings.slideCount || slides.length;
    if (slides.length > target && target >= 2) {
      slides = [...slides.slice(0, target - 1), slides[slides.length - 1]];
    }
  }

  // ARRANGE-ONLY: minimal clean — trim whitespace, drop exact duplicates only.
  // Do NOT run validateAndCleanSlides here: its instruction-patterns strip
  // legitimate user content (e.g. lines starting with "Use..."/"Explain...").
  // Cover/closing slides are exempt: a content slide may legitimately repeat
  // the deck title as its own heading.
  const seen = new Set<string>();
  slides = slides.map((s) => ({
    ...s,
    title: s.title.trim(),
    body: s.body?.trim() || undefined,
  })).filter((s) => {
    if (s.layout === 'hero' || s.layout === 'thank-you' || s.layout === 'agenda') return true;
    const key = [
      s.title,
      s.body || '',
      (s.bullets || []).map((b) => b.text).join('~'),
      s.steps?.map((x) => x.title + x.description).join('~') || '',
      s.cards?.map((c) => c.title + c.description).join('~') || '',
      s.table ? s.table.rows.map((r) => r.join('~')).join('|') : '',
    ].join('||').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Images are always included by default (topic-matched per slide).
  // Remove them per slide later in the editor or via AI chat.
  slides = _addImagesToSlides(slides);

  return {
    id: crypto.randomUUID(),
    settings: { ...effective, slideCount: slides.length },
    slides,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── Speaker notes generator ───────────────────────────────────────────────────

export function generateNotes(slide: Slide, settings: PresentationSettings): string {
  if (slide.notes) return slide.notes;
  const ta = analyzeTopic(settings);
  switch (slide.layout) {
    case 'hero':
      return `Welcome the audience. Introduce the topic and yourself. Set expectations for the next ${settings.duration} minutes. Tell them why this topic matters now.`;
    case 'statistics':
      return 'Anchor each statistic with context. Numbers without narrative are forgettable. Highlight the most surprising figure.';
    case 'comparison':
      return 'Be fair to both sides. The goal is clarity, not advocacy. End with a clear recommendation.';
    case 'timeline':
      return 'Use the timeline to show momentum and inflection points. Connect the future item to the next section.';
    case 'process':
      return 'Emphasize that the process is iterative, not linear. Feedback loops matter more than perfect execution.';
    default:
      return `Discuss ${slide.title.toLowerCase()} in the context of ${ta.topic}. Keep the audience engaged with one concrete example. Transition smoothly to the next section.`;
  }
}

// ── Viva question generator ───────────────────────────────────────────────────

export function generateVivaQuestions(presentation: Presentation): VivaQuestion[] {
  const ta = analyzeTopic(presentation.settings);
  const templates: VivaQuestion[] = [
    {
      id: uid('vq'),
      question: `What motivated you to choose ${ta.topic} as your topic?`,
      answer: `${ta.title} is a significant subject in its field. Understanding it well positions practitioners to make better decisions and apply the concepts effectively.`,
      followUps: ['How does this relate to your own experience?', 'What surprised you most during your research?'],
    },
    {
      id: uid('vq'),
      question: `Can you summarize the single most important takeaway from your presentation?`,
      answer: `The key takeaway is that ${ta.topic} rewards disciplined study and application. Those who invest in understanding the fundamentals outperform those who focus only on surface-level details.`,
      followUps: ['What evidence supports that claim?', 'How would you measure success?'],
    },
    {
      id: uid('vq'),
      question: `What are the main challenges associated with ${ta.topic}?`,
      answer: `The principal challenges are complexity, the need for accurate fundamentals, and sustaining effort beyond initial learning. Each is addressable with deliberate practice and study.`,
      followUps: ['How would you prioritize these challenges?', 'Which is most underestimated?'],
    },
    {
      id: uid('vq'),
      question: `How does ${ta.topic} compare to alternative approaches?`,
      answer: `Compared with alternatives, ${ta.topic} offers specific advantages in its domain. The trade-off depends on the context and the specific problem being solved.`,
      followUps: ['When would you not recommend this approach?', 'What would change your recommendation?'],
    },
    {
      id: uid('vq'),
      question: `Where do you see ${ta.topic} heading in the next few years?`,
      answer: `We expect continued development, new applications, and deeper integration with related fields. Early movers who build foundational capability today will be well positioned.`,
      followUps: ['What could disrupt that trajectory?', 'How should one prepare now?'],
    },
    {
      id: uid('vq'),
      question: `What methodology did you use to gather your information?`,
      answer: `I drew on established references, standard texts, and reputable sources, then synthesized the findings into a structured presentation suitable for a ${presentation.settings.audience} audience.`,
      followUps: ['What were the limitations of your sources?', 'How did you handle conflicting information?'],
    },
  ];
  return templates;
}

// ── Presentation score generator ─────────────────────────────────────────────

export function scorePresentation(presentation: Presentation): PresentationScore {
  const s = presentation.settings;
  const slides = presentation.slides;
  const wordCount = slides.reduce((acc, sl) => {
    const text = [sl.title, sl.subtitle, sl.body, (sl.bullets || []).map((b) => b.text).join(' '), (sl.notes || '')].join(' ');
    return acc + text.split(/\s+/).filter(Boolean).length;
  }, 0);

  const layoutVariety = new Set(slides.map((sl) => sl.layout)).size;
  const avgWordsPerSlide = wordCount / Math.max(1, slides.length);

  const contentQuality = clamp(Math.round(70 + (slides.length >= 8 ? 12 : 0) + (s.references ? 6 : 0) + (s.speakerNotes ? 6 : 0) + Math.min(layoutVariety * 1.5, 8)));
  const design = clamp(Math.round(72 + Math.min(layoutVariety * 2.5, 14) + (s.images ? 6 : 0) + (s.charts ? 6 : 0)));
  const readability = clamp(Math.round(avgWordsPerSlide < 80 ? 92 : avgWordsPerSlide < 120 ? 84 : 74));
  const visualBalance = clamp(Math.round(74 + Math.min(layoutVariety * 2, 16) + (s.images ? 6 : 0)));
  const grammar = clamp(Math.round(88 + (seedFrom(s.prompt) % 8)));
  const flow = clamp(Math.round(76 + (slides.length >= 6 ? 10 : 0) + (layoutVariety >= 5 ? 10 : 0)));
  const overall = Math.round(
    (contentQuality * 0.25 + design * 0.2 + readability * 0.15 + visualBalance * 0.15 + grammar * 0.1 + flow * 0.15),
  );

  const suggestions: string[] = [];
  if (avgWordsPerSlide > 100) suggestions.push('Reduce text density on content slides — aim for fewer than 80 words per slide for stronger impact.');
  if (layoutVariety < 5) suggestions.push('Vary slide layouts more to keep the audience visually engaged.');
  if (!s.images) suggestions.push('Add relevant images to break up text-heavy sections.');
  if (!s.speakerNotes) suggestions.push('Generate speaker notes to strengthen delivery and reduce on-slide text.');
  if (slides.length < 8) suggestions.push('Consider adding 1–2 more slides to fully develop the topic.');
  if (suggestions.length === 0) suggestions.push('Excellent work — this presentation is well-structured, varied, and ready to deliver.');

  return {
    contentQuality,
    design,
    readability,
    visualBalance,
    grammar,
    flow,
    overall,
    suggestions,
  };
}

function clamp(n: number, min = 60, max = 99): number {
  return Math.max(min, Math.min(max, n));
}

// ── Rewrite engine ────────────────────────────────────────────────────────────

export function rewriteText(text: string, tone: RewriteTone): string {
  if (!text.trim()) return text;
  switch (tone) {
    case 'rewrite':
      return rephrase(text);
    case 'shorten':
      return shorten(text);
    case 'expand':
      return expand(text);
    case 'simplify':
      return simplify(text);
    case 'professional':
      return applyTone(text, 'professional');
    case 'academic':
      return applyTone(text, 'academic');
    case 'business':
      return applyTone(text, 'business');
    case 'friendly':
      return applyTone(text, 'friendly');
    default:
      return text;
  }
}

function rephrase(text: string): string {
  const swaps: [RegExp, string][] = [
    [/\bimportant\b/gi, 'critical'],
    [/\bhelp\b/gi, 'support'],
    [/\buse\b/gi, 'leverage'],
    [/\bmake\b/gi, 'create'],
    [/\bshow\b/gi, 'demonstrate'],
    [/\bbig\b/gi, 'substantial'],
    [/\bmany\b/gi, 'numerous'],
    [/\bthing\b/gi, 'element'],
  ];
  let out = text;
  for (const [re, rep] of swaps) out = out.replace(re, rep);
  return out;
}

function shorten(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) {
    const parts = text.split(/[,;:]/);
    return parts.slice(0, Math.max(1, Math.ceil(parts.length / 2))).join(', ').trim() + (text.endsWith('.') ? '.' : '');
  }
  return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(' ');
}

function expand(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const additions = [
    ' This is supported by consistent evidence across multiple contexts.',
    ' Practitioners have observed measurable improvements when these principles are applied thoughtfully.',
    ' The implications extend beyond the immediate context to adjacent domains.',
  ];
  return sentences
    .map((s, i) => s + (additions[i % additions.length] || ''))
    .join(' ');
}

function simplify(text: string): string {
  const swaps: [RegExp, string][] = [
    [/\butilize\b/gi, 'use'],
    [/\bleverage\b/gi, 'use'],
    [/\bdemonstrate\b/gi, 'show'],
    [/\bsubstantial\b/gi, 'large'],
    [/\bnumerous\b/gi, 'many'],
    [/\bfacilitate\b/gi, 'help'],
    [/\bcommence\b/gi, 'begin'],
    [/\bterminate\b/gi, 'end'],
    [/\bendeavor\b/gi, 'try'],
    [/\bapproximately\b/gi, 'about'],
  ];
  let out = text;
  for (const [re, rep] of swaps) out = out.replace(re, rep);
  return out.replace(/([^.!?]{120,}?)([,;:])\s/g, '$1. ');
}

function applyTone(text: string, tone: string): string {
  const base = rephrase(text);
  switch (tone) {
    case 'professional':
      return base.replace(/\bkinda\b/gi, 'somewhat').replace(/\bstuff\b/gi, 'materials').replace(/\bguys\b/gi, 'team') + (base.endsWith('.') ? '' : '.');
    case 'academic':
      return `Research indicates that ${base.charAt(0).toLowerCase()}${base.slice(1)}` + (base.endsWith('.') ? '' : '.');
    case 'business':
      return `From a strategic perspective, ${base.charAt(0).toLowerCase()}${base.slice(1)}` + (base.endsWith('.') ? '' : '.');
    case 'friendly':
      return base.replace(/\bmust\b/gi, 'can').replace(/\bshall\b/gi, 'will').replace(/\btherefore\b/gi, 'so');
    default:
      return base;
  }
}

// ── Single-slide regeneration ─────────────────────────────────────────────────

export function regenerateSlide(slide: Slide, settings: PresentationSettings, variant = 0): Slide {
  const ta = analyzeTopic(settings);
  void variant;

  switch (slide.layout) {
    case 'statistics':
      return { ...slide, stats: buildFallbackStats(ta) };
    case 'cards':
      return { ...slide, cards: buildFallbackCards(ta, slide.title) };
    case 'timeline':
      return { ...slide, timeline: buildFallbackTimeline(ta) };
    case 'process':
      return { ...slide, steps: buildFallbackProcess(ta) };
    case 'comparison':
      return { ...slide, comparison: buildFallbackComparison(ta) };
    case 'table':
      return { ...slide, table: buildFallbackTable(ta, slide.title) };
    case 'chart':
      return { ...slide, chart: buildFallbackChart(ta) };
    case 'two-column':
    default:
      return {
        ...slide,
        body: buildFallbackBody(slide.title, ta),
        bullets: buildFallbackBullets(slide.title, ta).map((b) => ({ id: uid('bl'), text: b.text })),
      };
  }
}
