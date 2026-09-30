// ─────────────────────────────────────────────────────────────────────────────
// Topic knowledge base for the local AI generator.
//
// Each entry provides a topic-specific outline (section titles), per-section
// content (body text, bullets, examples, code snippets, tables, etc.), and
// metadata about the category (technical, science, history, business, etc.).
//
// The generator uses this to build a presentation that is genuinely about the
// user's topic — never a generic template.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SlideLayout,
  TimelineItem,
  ProcessStep,
  StatItem,
  CardItem,
  ComparisonRow,
  TableData,
  ChartData,
} from '../types';
import { uid } from './id';

export type TopicCategory =
  | 'programming'
  | 'cs'
  | 'science'
  | 'biology'
  | 'history'
  | 'business'
  | 'math'
  | 'ai'
  | 'cloud'
  | 'general';

export interface SlideContent {
  title: string;
  layout: SlideLayout;
  subtitle?: string;
  body?: string;
  bullets?: { text: string }[];
  timeline?: TimelineItem[];
  steps?: ProcessStep[];
  stats?: StatItem[];
  cards?: CardItem[];
  comparison?: { leftTitle: string; rightTitle: string; rows: ComparisonRow[] };
  table?: TableData;
  chart?: ChartData;
  quote?: { text: string; author: string };
  image?: { url: string; alt: string; source?: string };
  sectionNumber?: string;
  notes?: string;
  accentIcon?: string;
}

export interface TopicEntry {
  /** Lowercase match keys. */
  keys: string[];
  category: TopicCategory;
  /** Display title. */
  title: string;
  /** Short topic noun. */
  topic: string;
  /** Build the full slide content list. */
  build: () => SlideContent[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bl(text: string) {
  return { id: uid('bl'), text };
}

function st(value: string, label: string, description?: string): StatItem {
  return { id: uid('st'), value, label, description };
}

function tl(year: string, title: string, description: string): TimelineItem {
  return { id: uid('tl'), year, title, description };
}

function ps(step: number, title: string, description: string): ProcessStep {
  return { id: uid('ps'), step, title, description };
}

function cd(title: string, description: string, icon: string): CardItem {
  return { id: uid('cd'), title, description, icon };
}

// ── Knowledge entries ─────────────────────────────────────────────────────────

const ENTRIES: TopicEntry[] = [];

function entry(e: TopicEntry) {
  ENTRIES.push(e);
}

// ── Programming: Operators in C ────────────────────────────────────────────────

entry({
  keys: ['operators in c', 'c operators', 'operators in c programming', 'c programming operators'],
  category: 'programming',
  title: 'Operators in C Programming',
  topic: 'C operators',
  build: () => [
    {
      title: 'Operators in C Programming',
      layout: 'hero',
      subtitle: 'Symbols that tell the compiler to perform mathematical, relational, logical, and bitwise operations on operands.',
      body: 'A complete walkthrough of every operator category in C, with syntax, examples, and precedence rules.',
      notes: 'Welcome the audience. Explain that operators are the building blocks of every C expression. Set expectations: we will cover arithmetic, relational, logical, assignment, bitwise, increment/decrement, conditional, and precedence — with code examples for each.',
      accentIcon: 'Code2',
    },
    {
      title: 'Agenda',
      layout: 'agenda',
      subtitle: 'What we will cover',
      bullets: [
        bl('Introduction to Operators'),
        bl('Arithmetic Operators'),
        bl('Relational Operators'),
        bl('Logical Operators'),
        bl('Assignment Operators'),
        bl('Bitwise Operators'),
        bl('Increment & Decrement Operators'),
        bl('Conditional (Ternary) Operator'),
        bl('Operator Precedence & Associativity'),
        bl('Summary & Best Practices'),
      ],
      notes: 'Walk through the agenda. Tell the audience we will go category by category with code examples, then finish with precedence rules and best practices.',
      accentIcon: 'ListOrdered',
    },
    {
      title: 'Introduction to Operators',
      layout: 'two-column',
      subtitle: 'What operators are and why they matter',
      body: 'An operator is a symbol that operates on one or more operands to produce a result. In C, operators are classified by the number of operands (unary, binary, ternary) and by the type of operation they perform.',
      bullets: [
        bl('Unary operators — act on one operand (e.g., ++, --, !, ~)'),
        bl('Binary operators — act on two operands (e.g., +, -, *, /, ==)'),
        bl('Ternary operator — acts on three operands (?:)'),
        bl('Operands can be variables, constants, or expressions'),
      ],
      notes: 'Define operators clearly. Distinguish unary, binary, and ternary by operand count. Give a one-line example of each before moving on.',
      accentIcon: 'BookOpen',
    },
    {
      title: 'Arithmetic Operators',
      layout: 'two-column',
      subtitle: 'Mathematical operations on numeric operands',
      body: 'Arithmetic operators perform mathematical computations. The division operator behaves differently for integers (truncates) versus floats. The modulus operator % works only on integers and returns the remainder.',
      bullets: [
        bl('+ (Addition): a + b'),
        bl('- (Subtraction): a - b'),
        bl('* (Multiplication): a * b'),
        bl('/ (Division): a / b — integer division truncates'),
        bl('% (Modulus): a % b — remainder, integers only'),
      ],
      table: {
        headers: ['Operator', 'Name', 'Example (a=10, b=3)', 'Result'],
        rows: [
          ['+', 'Addition', 'a + b', '13'],
          ['-', 'Subtraction', 'a - b', '7'],
          ['*', 'Multiplication', 'a * b', '30'],
          ['/', 'Division', 'a / b', '3'],
          ['%', 'Modulus', 'a % b', '1'],
        ],
      },
      notes: 'Walk through each operator with the example values a=10, b=3. Emphasize that 10/3 gives 3 (not 3.33) because of integer truncation. The modulus operator is the remainder — 10 % 3 = 1.',
      accentIcon: 'Calculator',
    },
    {
      title: 'Relational Operators',
      layout: 'two-column',
      subtitle: 'Comparing two values',
      body: 'Relational operators compare two operands and return 1 (true) or 0 (false). In C, there is no native boolean type — true is any non-zero value and false is zero.',
      bullets: [
        bl('== (Equal to): a == b'),
        bl('!= (Not equal to): a != b'),
        bl('> (Greater than): a > b'),
        bl('< (Less than): a < b'),
        bl('>= (Greater or equal): a >= b'),
        bl('<= (Less or equal): a <= b'),
      ],
      table: {
        headers: ['Operator', 'Meaning', 'Example (a=10, b=3)', 'Result'],
        rows: [
          ['==', 'Equal to', 'a == b', '0 (false)'],
          ['!=', 'Not equal to', 'a != b', '1 (true)'],
          ['>', 'Greater than', 'a > b', '1 (true)'],
          ['<', 'Less than', 'a < b', '0 (false)'],
          ['>=', 'Greater or equal', 'a >= b', '1 (true)'],
          ['<=', 'Less or equal', 'a <= b', '0 (false)'],
        ],
      },
      notes: 'Explain that relational operators return 1 or 0. A common mistake is using = (assignment) instead of == (comparison). Highlight this explicitly.',
      accentIcon: 'GitCompare',
    },
    {
      title: 'Logical Operators',
      layout: 'two-column',
      subtitle: 'Combining boolean conditions',
      body: 'Logical operators combine multiple conditions. They use short-circuit evaluation: && stops if the left operand is false; || stops if the left operand is true.',
      bullets: [
        bl('&& (Logical AND): true if both operands are true'),
        bl('|| (Logical OR): true if at least one operand is true'),
        bl('! (Logical NOT): reverses the truth value'),
        bl('Short-circuit: && stops on false, || stops on true'),
      ],
      table: {
        headers: ['Operator', 'Name', 'Example (a=1, b=0)', 'Result'],
        rows: [
          ['&&', 'Logical AND', 'a && b', '0 (false)'],
          ['||', 'Logical OR', 'a || b', '1 (true)'],
          ['!', 'Logical NOT', '!b', '1 (true)'],
        ],
      },
      notes: 'Explain short-circuit evaluation with an example: if (ptr != NULL && ptr->value > 0) — the second check is skipped if ptr is NULL, preventing a crash.',
      accentIcon: 'Merge',
    },
    {
      title: 'Assignment Operators',
      layout: 'two-column',
      subtitle: 'Assigning and updating values',
      body: 'The simple assignment operator = stores a value in a variable. Compound assignment operators combine an arithmetic or bitwise operation with assignment in a single concise statement.',
      bullets: [
        bl('= (Simple assignment): a = 5'),
        bl('+= (Add and assign): a += 3 is a = a + 3'),
        bl('-= (Subtract and assign): a -= 2 is a = a - 2'),
        bl('*= (Multiply and assign): a *= 4 is a = a * 4'),
        bl('/= (Divide and assign): a /= 2 is a = a / 2'),
        bl('%= (Modulus and assign): a %= 3 is a = a % 3'),
      ],
      notes: 'Show how compound operators are shorthand. For example, a += 5 is exactly equivalent to a = a + 5 but more concise and less error-prone.',
      accentIcon: 'ArrowRightToLine',
    },
    {
      title: 'Bitwise Operators',
      layout: 'two-column',
      subtitle: 'Operating on individual bits',
      body: 'Bitwise operators work on the binary representation of integers. They are essential for low-level programming, device drivers, flags, and embedded systems where individual bits carry meaning.',
      bullets: [
        bl('& (Bitwise AND): sets bit to 1 only if both bits are 1'),
        bl('| (Bitwise OR): sets bit to 1 if at least one bit is 1'),
        bl('^ (Bitwise XOR): sets bit to 1 if bits differ'),
        bl('~ (Bitwise NOT): inverts every bit (one\'s complement)'),
        bl('<< (Left shift): shifts bits left, equivalent to *2^n'),
        bl('>> (Right shift): shifts bits right, equivalent to /2^n'),
      ],
      table: {
        headers: ['Operator', 'Name', 'Example (a=6, b=3)', 'Binary Result'],
        rows: [
          ['&', 'AND', '6 & 3', '0110 & 0011 = 0010 (2)'],
          ['|', 'OR', '6 | 3', '0110 | 0011 = 0111 (7)'],
          ['^', 'XOR', '6 ^ 3', '0110 ^ 0011 = 0101 (5)'],
          ['~', 'NOT', '~6', '~0110 = ...1001 (-7)'],
          ['<<', 'Left shift', '6 << 1', '0110 << 1 = 1100 (12)'],
          ['>>', 'Right shift', '6 >> 1', '0110 >> 1 = 0011 (3)'],
        ],
      },
      notes: 'Walk through the binary math. 6 is 0110, 3 is 0011. AND gives 0010 (2). OR gives 0111 (7). XOR gives 0101 (5). Left shift by 1 doubles the value; right shift by 1 halves it.',
      accentIcon: 'Binary',
    },
    {
      title: 'Increment & Decrement Operators',
      layout: 'two-column',
      subtitle: 'Adding or subtracting 1',
      body: 'The ++ and -- operators add or subtract 1 from a variable. The prefix form (++a) increments before the value is used; the postfix form (a++) increments after the value is used in the expression.',
      bullets: [
        bl('++a (Prefix): increment first, then use the new value'),
        bl('a++ (Postfix): use the current value, then increment'),
        bl('--a (Prefix): decrement first, then use the new value'),
        bl('a-- (Postfix): use the current value, then decrement'),
      ],
      table: {
        headers: ['Expression', 'Initial a', 'Result of expression', 'Value of a after'],
        rows: [
          ['b = ++a', '5', '6', '6'],
          ['b = a++', '5', '5', '6'],
          ['b = --a', '5', '4', '4'],
          ['b = a--', '5', '5', '4'],
        ],
      },
      notes: 'This is a classic exam question. Prefix changes the value first, then returns it. Postfix returns the old value first, then changes it. Show the table clearly.',
      accentIcon: 'TrendingUp',
    },
    {
      title: 'Conditional (Ternary) Operator',
      layout: 'two-column',
      subtitle: 'A shorthand for if-else',
      body: 'The conditional operator ?: is the only ternary operator in C. It evaluates a condition and returns one of two values depending on the result. It is a concise alternative to a simple if-else statement.',
      bullets: [
        bl('Syntax: condition ? expression_if_true : expression_if_false'),
        bl('Example: max = (a > b) ? a : b;'),
        bl('Nesting is possible but reduces readability'),
        bl('Use for simple assignments, not complex logic'),
      ],
      notes: 'Show the syntax clearly. The example max = (a > b) ? a : b assigns the larger of a and b to max. Mention that nested ternaries are hard to read and should be avoided.',
      accentIcon: 'HelpCircle',
    },
    {
      title: 'Operator Precedence & Associativity',
      layout: 'table',
      subtitle: 'Which operators bind tighter',
      body: 'Operator precedence determines the order in which operators are evaluated in an expression. Associativity determines the direction (left-to-right or right-to-left) when operators share the same precedence level.',
      table: {
        headers: ['Category', 'Operators', 'Precedence', 'Associativity'],
        rows: [
          ['Postfix', '() [] -> . ++ --', 'Highest', 'Left to right'],
          ['Unary', '! ~ ++ -- + - * & sizeof', 'High', 'Right to left'],
          ['Multiplicative', '* / %', 'High', 'Left to right'],
          ['Additive', '+ -', 'Medium', 'Left to right'],
          ['Relational', '< <= > >=', 'Medium', 'Left to right'],
          ['Equality', '== !=', 'Medium', 'Left to right'],
          ['Bitwise AND', '&', 'Low', 'Left to right'],
          ['Bitwise XOR', '^', 'Low', 'Left to right'],
          ['Bitwise OR', '|', 'Low', 'Left to right'],
          ['Logical AND', '&&', 'Lower', 'Left to right'],
          ['Logical OR', '||', 'Lower', 'Left to right'],
          ['Conditional', '?:', 'Low', 'Right to left'],
          ['Assignment', '= += -= *= /= %= etc.', 'Lowest', 'Right to left'],
        ],
      },
      notes: 'Walk through the table top to bottom. Emphasize that multiplication binds tighter than addition, so a + b * c is a + (b * c). Use parentheses to make intent explicit and avoid bugs.',
      accentIcon: 'ListOrdered',
    },
    {
      title: 'Best Practices',
      layout: 'cards',
      subtitle: 'Writing clean, bug-free operator expressions',
      cards: [
        cd('Use Parentheses', 'Make evaluation order explicit even when you know the precedence rules. It prevents bugs and aids readability.', 'Parentheses'),
        cd('Avoid = vs ==', 'Using = (assignment) where == (comparison) is intended is a classic C bug. Some programmers write if (5 == x) so the compiler catches the mistake.', 'AlertTriangle'),
        cd('Watch Integer Division', '10 / 3 gives 3, not 3.33. Cast to float if you need a decimal result: (float)10 / 3.', 'Calculator'),
        cd('Beware Side Effects', 'Avoid expressions like a[i] = i++ where the order of evaluation is undefined. The result varies by compiler.', 'AlertTriangle'),
        cd('Use Compound Operators', 'a += 5 is clearer and safer than a = a + 5, especially with long variable names.', 'ArrowRightToLine'),
        cd('Check Shift Bounds', 'Shifting by a value >= the bit width of the type is undefined behavior. Always validate shift counts.', 'Binary'),
      ],
      notes: 'Walk through each card. The = vs == bug is the most important — it has caused real security vulnerabilities. Integer division is the second most common source of confusion.',
      accentIcon: 'ShieldCheck',
    },
    {
      title: 'Summary',
      layout: 'two-column',
      subtitle: 'Key takeaways',
      body: 'C provides a rich set of operators grouped by function: arithmetic, relational, logical, assignment, bitwise, increment/decrement, and conditional. Understanding precedence and associativity is essential for writing correct expressions.',
      bullets: [
        bl('Operators are classified by operand count and operation type'),
        bl('Arithmetic, relational, and logical operators are the most commonly used'),
        bl('Bitwise operators are essential for low-level and embedded programming'),
        bl('Precedence and associativity determine evaluation order'),
        bl('Use parentheses to make intent explicit and avoid bugs'),
      ],
      notes: 'Recap the categories. Remind the audience that precedence and the = vs == distinction are the two most exam-relevant points. Invite questions.',
      accentIcon: 'CheckCircle2',
    },
    {
      title: 'Thank You',
      layout: 'thank-you',
      subtitle: 'Questions, comments, and discussion welcome.',
      body: 'Operators in C Programming',
      notes: 'Close confidently. Thank the audience. Restate the key takeaway: operators are the foundation of every C expression, and precedence rules govern their behavior. Open the floor for questions.',
      accentIcon: 'Heart',
    },
  ],
});

// ── Programming: Pointers in C ─────────────────────────────────────────────────

entry({
  keys: ['pointers in c', 'c pointers', 'pointers in c programming', 'pointers'],
  category: 'programming',
  title: 'Pointers in C Programming',
  topic: 'C pointers',
  build: () => [
    {
      title: 'Pointers in C Programming',
      layout: 'hero',
      subtitle: 'Variables that store the memory address of another variable — the foundation of dynamic memory, arrays, and efficient function calls in C.',
      body: 'A complete guide to declaring, using, and managing pointers, including pointer arithmetic, arrays, functions, and dynamic memory allocation.',
      notes: 'Welcome the audience. Explain that pointers are one of the most powerful and dangerous features of C. Set expectations: we will cover declaration, dereferencing, arithmetic, arrays, functions, dynamic memory, and common pitfalls.',
      accentIcon: 'Code2',
    },
    {
      title: 'Agenda',
      layout: 'agenda',
      subtitle: 'What we will cover',
      bullets: [
        bl('What is a Pointer?'),
        bl('Declaring and Initializing Pointers'),
        bl('Dereferencing and the & Operator'),
        bl('Pointer Arithmetic'),
        bl('Pointers and Arrays'),
        bl('Pointers and Functions'),
        bl('Dynamic Memory Allocation'),
        bl('Pointers to Pointers'),
        bl('Common Pitfalls'),
        bl('Summary'),
      ],
      notes: 'Walk through the agenda. Tell the audience this is a structured journey from basics to advanced usage.',
      accentIcon: 'ListOrdered',
    },
    {
      title: 'What is a Pointer?',
      layout: 'two-column',
      subtitle: 'The core concept',
      body: 'A pointer is a variable that stores the memory address of another variable. Every variable in C resides at a specific location in memory, and a pointer lets you access and manipulate that location directly.',
      bullets: [
        bl('A pointer stores an address, not a value'),
        bl('The address tells you where the data lives in memory'),
        bl('Pointers enable dynamic memory, arrays, and efficient passing'),
        bl('The size of a pointer depends on the system (4 bytes on 32-bit, 8 on 64-bit)'),
      ],
      notes: 'Use the analogy of a house address. The address is not the house, but it tells you where the house is. A pointer is the address; the variable is the house.',
      accentIcon: 'MapPin',
    },
    {
      title: 'Declaring and Initializing Pointers',
      layout: 'two-column',
      subtitle: 'Syntax and the & operator',
      body: 'A pointer is declared with a base type and the * operator. The address-of operator & retrieves the memory address of a variable. A pointer must always be initialized before use — an uninitialized pointer points to an unpredictable location.',
      bullets: [
        bl('Declaration: int *ptr; — ptr is a pointer to int'),
        bl('Initialization: ptr = &var; — store address of var'),
        bl('Combined: int *ptr = &var;'),
        bl('NULL pointer: int *ptr = NULL; — points to nothing'),
      ],
      notes: 'Show the declaration and initialization syntax. Emphasize that * in declaration means "this is a pointer", while * in usage means "dereference".',
      accentIcon: 'Code2',
    },
    {
      title: 'Dereferencing and the * Operator',
      layout: 'two-column',
      subtitle: 'Accessing the value at an address',
      body: 'The dereference operator * accesses the value stored at the address a pointer holds. You can read or write through a pointer: *ptr = 10 assigns 10 to the location ptr points to.',
      bullets: [
        bl('*ptr — read the value at the address stored in ptr'),
        bl('*ptr = 10 — write 10 to that address'),
        bl('&var — get the address of var'),
        bl('ptr = &var — store that address in ptr'),
      ],
      notes: 'Walk through the relationship: & gets the address, * reads or writes the value at an address. They are inverses of each other.',
      accentIcon: 'ArrowLeftRight',
    },
    {
      title: 'Pointer Arithmetic',
      layout: 'two-column',
      subtitle: 'Moving through memory',
      body: 'You can perform limited arithmetic on pointers: increment, decrement, and adding/subtracting integers. The pointer moves by the size of the base type, not by one byte. This makes pointer arithmetic type-aware.',
      bullets: [
        bl('ptr++ — moves to the next element (advances by sizeof(type))'),
        bl('ptr-- — moves to the previous element'),
        bl('ptr + n — moves forward by n elements'),
        bl('ptr - n — moves backward by n elements'),
        bl('ptr2 - ptr1 — gives the number of elements between them'),
      ],
      notes: 'Emphasize that ptr++ on an int pointer moves 4 bytes (on most systems), not 1. The compiler knows the base type and scales the step automatically.',
      accentIcon: 'Calculator',
    },
    {
      title: 'Pointers and Arrays',
      layout: 'two-column',
      subtitle: 'Two views of the same memory',
      body: 'In C, the name of an array decays into a pointer to its first element in most contexts. This means arr and &arr[0] are often interchangeable, and you can use pointer arithmetic to traverse an array.',
      bullets: [
        bl('arr[i] is equivalent to *(arr + i)'),
        bl('arr decays to &arr[0] in most expressions'),
        bl('You can iterate with a pointer instead of an index'),
        bl('sizeof(arr) gives total size; sizeof(ptr) gives pointer size'),
      ],
      notes: 'Show that arr[3] and *(arr + 3) are the same. This equivalence is one of the most important ideas in C and explains why array indexing works.',
      accentIcon: 'Layers',
    },
    {
      title: 'Pointers and Functions',
      layout: 'two-column',
      subtitle: 'Passing by reference',
      body: 'C passes arguments by value, so a function cannot modify the caller\'s variables directly. Pointers solve this: pass the address, and the function can modify the original through dereferencing. This is how scanf and swap functions work.',
      bullets: [
        bl('Pass by value: the function gets a copy, cannot modify the original'),
        bl('Pass by reference: pass the address, modify through *ptr'),
        bl('Example: void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }'),
        bl('Call: swap(&x, &y);'),
      ],
      notes: 'Show the classic swap function. Without pointers, swap would only swap local copies. With pointers, the caller\'s variables are actually modified.',
      accentIcon: 'ArrowLeftRight',
    },
    {
      title: 'Dynamic Memory Allocation',
      layout: 'two-column',
      subtitle: 'malloc, calloc, realloc, free',
      body: 'The <stdlib.h> library provides functions to allocate memory at runtime. malloc allocates uninitialized bytes, calloc allocates and zeroes, realloc resizes, and free releases the memory back to the system.',
      bullets: [
        bl('malloc(size) — allocate size bytes (uninitialized)'),
        bl('calloc(n, size) — allocate n * size bytes, zeroed'),
        bl('realloc(ptr, size) — resize a previously allocated block'),
        bl('free(ptr) — release the memory back to the system'),
        bl('Always check the return value for NULL'),
      ],
      table: {
        headers: ['Function', 'Purpose', 'Example', 'Notes'],
        rows: [
          ['malloc', 'Allocate raw memory', 'int *p = malloc(10 * sizeof(int));', 'Uninitialized'],
          ['calloc', 'Allocate + zero', 'int *p = calloc(10, sizeof(int));', 'Zeroed memory'],
          ['realloc', 'Resize a block', 'p = realloc(p, 20 * sizeof(int));', 'May move the block'],
          ['free', 'Release memory', 'free(p);', 'Set p = NULL after'],
        ],
      },
      notes: 'Walk through each function. Emphasize the golden rule: every malloc/calloc must have a matching free. Memory leaks come from missing free calls.',
      accentIcon: 'Database',
    },
    {
      title: 'Pointers to Pointers',
      layout: 'two-column',
      subtitle: 'Multiple levels of indirection',
      body: 'A pointer to a pointer stores the address of another pointer. This is used for 2D arrays, dynamic arrays of strings, and functions that need to modify a pointer in the caller (like allocating memory inside a function).',
      bullets: [
        bl('Declaration: int **pptr; — pointer to a pointer to int'),
        bl('Access: **pptr — the final int value'),
        bl('Used for 2D dynamic arrays and arrays of strings'),
        bl('Each * adds one level of indirection'),
      ],
      notes: 'Explain that each * adds a level of indirection. **pptr means "go to the address, get another address, go there, get the value".',
      accentIcon: 'Layers',
    },
    {
      title: 'Common Pitfalls',
      layout: 'cards',
      subtitle: 'Mistakes to avoid',
      cards: [
        cd('Uninitialized Pointers', 'Using a pointer before assigning it an address causes undefined behavior. Always initialize to NULL or a valid address.', 'AlertTriangle'),
        cd('Dangling Pointers', 'After free(ptr), the pointer still holds the old address. Set it to NULL to avoid accidental use.', 'AlertTriangle'),
        cd('Memory Leaks', 'Forgetting to free allocated memory causes leaks. Every malloc/calloc needs a matching free.', 'Droplet'),
        cd('Buffer Overruns', 'Writing past the end of an allocated block corrupts memory. Always check bounds.', 'AlertTriangle'),
        cd('Double Free', 'Calling free twice on the same pointer corrupts the heap. Set the pointer to NULL after freeing.', 'AlertTriangle'),
        cd('Wrong Dereference', 'Dereferencing a NULL or freed pointer crashes the program. Always check before dereferencing.', 'AlertTriangle'),
      ],
      notes: 'Walk through each pitfall. Memory leaks and dangling pointers are the two most common real-world issues. Double free and buffer overruns cause security vulnerabilities.',
      accentIcon: 'ShieldAlert',
    },
    {
      title: 'Summary',
      layout: 'two-column',
      subtitle: 'Key takeaways',
      body: 'Pointers are variables that store memory addresses. They enable dynamic memory, efficient function calls, array traversal, and complex data structures. Mastering pointers requires understanding declaration, dereferencing, arithmetic, and memory management.',
      bullets: [
        bl('A pointer stores an address; * dereferences; & takes an address'),
        bl('Pointer arithmetic is scaled by the base type'),
        bl('Arrays and pointers are closely related'),
        bl('Dynamic memory requires malloc/calloc/realloc/free discipline'),
        bl('Always initialize, always check for NULL, always free'),
      ],
      notes: 'Recap the key ideas. Remind the audience that pointers are powerful but require discipline. Invite questions.',
      accentIcon: 'CheckCircle2',
    },
    {
      title: 'Thank You',
      layout: 'thank-you',
      subtitle: 'Questions, comments, and discussion welcome.',
      body: 'Pointers in C Programming',
      notes: 'Close confidently. Thank the audience. Restate the key takeaway: pointers are the foundation of C\'s power and its danger. Open the floor for questions.',
      accentIcon: 'Heart',
    },
  ],
});

// ── AI: Machine Learning ──────────────────────────────────────────────────────

entry({
  keys: ['machine learning', 'ml', 'machine learning basics', 'introduction to machine learning'],
  category: 'ai',
  title: 'Machine Learning',
  topic: 'machine learning',
  build: () => [
    {
      title: 'Machine Learning',
      layout: 'hero',
      subtitle: 'The science of enabling computers to learn patterns from data and make decisions without being explicitly programmed.',
      body: 'A comprehensive introduction to machine learning: types, algorithms, workflow, evaluation, and real-world applications.',
      notes: 'Welcome the audience. Explain that machine learning is behind recommendation systems, spam filters, voice assistants, and self-driving cars. Set expectations for the session.',
      accentIcon: 'BrainCircuit',
    },
    {
      title: 'Agenda',
      layout: 'agenda',
      subtitle: 'What we will cover',
      bullets: [
        bl('What is Machine Learning?'),
        bl('Types of Machine Learning'),
        bl('Supervised Learning'),
        bl('Unsupervised Learning'),
        bl('Reinforcement Learning'),
        bl('The ML Workflow'),
        bl('Common Algorithms'),
        bl('Model Evaluation'),
        bl('Applications'),
        bl('Summary'),
      ],
      notes: 'Walk through the agenda. Tell the audience we will cover the three main types, the workflow, key algorithms, and real-world applications.',
      accentIcon: 'ListOrdered',
    },
    {
      title: 'What is Machine Learning?',
      layout: 'two-column',
      subtitle: 'The core idea',
      body: 'Machine learning is a subset of artificial intelligence where systems learn from data, identify patterns, and make decisions with minimal human intervention. Instead of writing explicit rules, we feed data to algorithms that infer the rules themselves.',
      bullets: [
        bl('A branch of artificial intelligence'),
        bl('Learns from data instead of explicit programming'),
        bl('Improves performance as exposure to data increases'),
        bl('Powers recommendations, search, vision, and language systems'),
      ],
      notes: 'Use the contrast: traditional programming gives rules + data = answers. Machine learning gives data + answers = rules. This is the fundamental shift.',
      accentIcon: 'BrainCircuit',
    },
    {
      title: 'Types of Machine Learning',
      layout: 'cards',
      subtitle: 'Three main paradigms',
      cards: [
        cd('Supervised Learning', 'Trained on labeled data. The model learns to map inputs to known outputs. Used for classification and regression.', 'Target'),
        cd('Unsupervised Learning', 'Finds patterns in unlabeled data. Used for clustering, dimensionality reduction, and association.', 'Layers'),
        cd('Reinforcement Learning', 'An agent learns by interacting with an environment and receiving rewards or penalties. Used in robotics and games.', 'Gamepad2'),
      ],
      notes: 'Walk through each card. Supervised needs labels, unsupervised finds structure, reinforcement learns by trial and error with feedback.',
      accentIcon: 'LayoutGrid',
    },
    {
      title: 'Supervised Learning',
      layout: 'two-column',
      subtitle: 'Learning from labeled examples',
      body: 'In supervised learning, the model is trained on a dataset where each example has an input and a known output (label). The model learns the mapping from inputs to outputs and can then predict outputs for new, unseen inputs.',
      bullets: [
        bl('Classification — predict a category (spam or not spam)'),
        bl('Regression — predict a continuous value (house price)'),
        bl('Requires labeled training data'),
        bl('Examples: linear regression, logistic regression, decision trees, neural networks'),
      ],
      notes: 'Give concrete examples: email spam detection (classification) and house price prediction (regression). Both are supervised because we have labeled examples.',
      accentIcon: 'Target',
    },
    {
      title: 'Unsupervised Learning',
      layout: 'two-column',
      subtitle: 'Finding structure in unlabeled data',
      body: 'Unsupervised learning works on data without labels. The goal is to discover hidden patterns, groupings, or structure. It is used when labeling data is expensive or impractical.',
      bullets: [
        bl('Clustering — group similar items (customer segmentation)'),
        bl('Dimensionality reduction — compress data while preserving structure (PCA)'),
        bl('Association — discover rules that link variables (market basket)'),
        bl('Examples: k-means, hierarchical clustering, PCA, Apriori'),
      ],
      notes: 'Give the example of customer segmentation: you have purchase data but no labels, and the algorithm groups customers by behavior.',
      accentIcon: 'Layers',
    },
    {
      title: 'Reinforcement Learning',
      layout: 'two-column',
      subtitle: 'Learning by trial and error',
      body: 'An agent takes actions in an environment, receives rewards or penalties, and learns a policy that maximizes cumulative reward over time. It is the closest paradigm to how humans and animals learn.',
      bullets: [
        bl('Agent — the learner or decision maker'),
        bl('Environment — the world the agent interacts with'),
        bl('Actions — choices the agent can make'),
        bl('Rewards — feedback signal (positive or negative)'),
        bl('Policy — the strategy the agent learns'),
      ],
      notes: 'Use the analogy of training a dog: the dog (agent) tries actions, gets treats (rewards) or nothing, and learns which actions pay off. AlphaGo and self-driving cars use this paradigm.',
      accentIcon: 'Gamepad2',
    },
    {
      title: 'The ML Workflow',
      layout: 'process',
      subtitle: 'From data to deployed model',
      steps: [
        ps(1, 'Data Collection', 'Gather relevant data from sources. Quality and quantity of data directly determine model performance.'),
        ps(2, 'Data Preprocessing', 'Clean, normalize, handle missing values, and split into training and test sets.'),
        ps(3, 'Feature Engineering', 'Select, transform, and create features that help the model learn the underlying patterns.'),
        ps(4, 'Model Training', 'Feed training data to an algorithm so it can learn the mapping between inputs and outputs.'),
        ps(5, 'Evaluation', 'Test the model on unseen data using metrics like accuracy, precision, recall, and F1 score.'),
        ps(6, 'Deployment', 'Deploy the model to production and monitor its performance over time for drift and degradation.'),
      ],
      notes: 'Walk through each step. Emphasize that data preparation typically takes 60-80% of the effort. A model is only as good as its data.',
      accentIcon: 'Workflow',
    },
    {
      title: 'Common Algorithms',
      layout: 'table',
      subtitle: 'Key algorithms at a glance',
      table: {
        headers: ['Algorithm', 'Type', 'Use Case', 'Strength'],
        rows: [
          ['Linear Regression', 'Supervised', 'Predicting a number', 'Simple, interpretable'],
          ['Logistic Regression', 'Supervised', 'Binary classification', 'Probabilistic output'],
          ['Decision Tree', 'Supervised', 'Classification / regression', 'Interpretable, handles mixed data'],
          ['Random Forest', 'Supervised', 'Classification / regression', 'Robust, reduces overfitting'],
          ['k-Means', 'Unsupervised', 'Clustering', 'Fast, scales well'],
          ['PCA', 'Unsupervised', 'Dimensionality reduction', 'Compresses features'],
          ['Neural Network', 'Supervised', 'Complex patterns', 'Highly flexible'],
          ['Q-Learning', 'Reinforcement', 'Sequential decisions', 'Learns optimal policies'],
        ],
      },
      notes: 'Walk through the table. Highlight that simpler algorithms (linear/logistic regression) are often strong baselines, and neural networks shine on complex, high-dimensional data.',
      accentIcon: 'Table',
    },
    {
      title: 'Model Evaluation',
      layout: 'two-column',
      subtitle: 'Measuring how well a model performs',
      body: 'Evaluation metrics depend on the task. For classification, we use accuracy, precision, recall, and F1 score. For regression, we use mean squared error and R-squared. A confusion matrix gives a detailed view of classification performance.',
      bullets: [
        bl('Accuracy — fraction of correct predictions'),
        bl('Precision — of predicted positives, how many are correct'),
        bl('Recall — of actual positives, how many we caught'),
        bl('F1 score — harmonic mean of precision and recall'),
        bl('MSE / RMSE — average squared error for regression'),
      ],
      notes: 'Explain the trade-off between precision and recall. A spam filter should favor precision (avoid false positives); a cancer detector should favor recall (catch every case).',
      accentIcon: 'BarChart3',
    },
    {
      title: 'Real-World Applications',
      layout: 'cards',
      subtitle: 'Where machine learning is used today',
      cards: [
        cd('Recommendation Systems', 'Netflix, Amazon, and Spotify use ML to suggest content and products based on your behavior.', 'ThumbsUp'),
        cd('Natural Language Processing', 'Chatbots, translation, and sentiment analysis understand and generate human language.', 'MessageSquare'),
        cd('Computer Vision', 'Face recognition, medical imaging, and self-driving cars interpret visual data.', 'Eye'),
        cd('Fraud Detection', 'Banks flag suspicious transactions in real time by learning normal spending patterns.', 'ShieldAlert'),
        cd('Healthcare', 'Disease prediction, drug discovery, and personalized treatment plans.', 'HeartPulse'),
        cd('Autonomous Systems', 'Drones, robots, and self-driving vehicles navigate and decide using ML.', 'Car'),
      ],
      notes: 'Walk through each application. Ask the audience which ones they have interacted with today — most will say recommendation systems and search.',
      accentIcon: 'LayoutGrid',
    },
    {
      title: 'Challenges & Future',
      layout: 'two-column',
      subtitle: 'Open problems and directions',
      body: 'Machine learning faces challenges in data quality, bias, interpretability, and computational cost. The field is moving toward federated learning, self-supervised learning, and more efficient models that need less data and energy.',
      bullets: [
        bl('Data quality and bias — models inherit the biases in their training data'),
        bl('Interpretability — complex models are hard to explain'),
        bl('Computational cost — training large models requires significant resources'),
        bl('Privacy — learning from sensitive data raises ethical concerns'),
        bl('Future: federated learning, self-supervised learning, efficient models'),
      ],
      notes: 'Discuss bias as a critical issue: a hiring model trained on biased historical data will reproduce that bias. Interpretability matters in healthcare and finance where decisions affect lives.',
      accentIcon: 'TrendingUp',
    },
    {
      title: 'Summary',
      layout: 'two-column',
      subtitle: 'Key takeaways',
      body: 'Machine learning enables computers to learn from data. The three main types are supervised, unsupervised, and reinforcement learning. The workflow spans data collection, preprocessing, training, evaluation, and deployment. Applications span nearly every industry.',
      bullets: [
        bl('ML learns patterns from data without explicit programming'),
        bl('Three paradigms: supervised, unsupervised, reinforcement'),
        bl('The workflow: data, features, training, evaluation, deployment'),
        bl('Algorithm choice depends on the problem and data'),
        bl('Applications are everywhere — from recommendations to healthcare'),
      ],
      notes: 'Recap the three types and the workflow. Remind the audience that data quality is the single biggest determinant of success. Invite questions.',
      accentIcon: 'CheckCircle2',
    },
    {
      title: 'Thank You',
      layout: 'thank-you',
      subtitle: 'Questions, comments, and discussion welcome.',
      body: 'Machine Learning',
      notes: 'Close confidently. Thank the audience. Restate the key takeaway: machine learning turns data into decisions. Open the floor for questions.',
      accentIcon: 'Heart',
    },
  ],
});

// ── AI: Artificial Intelligence ───────────────────────────────────────────────

entry({
  keys: ['artificial intelligence', 'ai', 'what is ai', 'introduction to ai', 'ai basics'],
  category: 'ai',
  title: 'Artificial Intelligence',
  topic: 'artificial intelligence',
  build: () => [
    {
      title: 'Artificial Intelligence',
      layout: 'hero',
      subtitle: 'The field of building systems that can perform tasks normally requiring human intelligence — reasoning, learning, perception, and language.',
      body: 'A complete introduction to AI: its branches, history, techniques, applications, and ethical considerations.',
      notes: 'Welcome the audience. Explain that AI is no longer science fiction — it is in our phones, cars, and hospitals. Set expectations for the session.',
      accentIcon: 'BrainCircuit',
    },
    {
      title: 'Agenda',
      layout: 'agenda',
      subtitle: 'What we will cover',
      bullets: [
        bl('What is Artificial Intelligence?'),
        bl('Branches of AI'),
        bl('A Brief History'),
        bl('Machine Learning'),
        bl('Deep Learning'),
        bl('Natural Language Processing'),
        bl('Computer Vision'),
        bl('Applications'),
        bl('Ethics & Challenges'),
        bl('Summary'),
      ],
      notes: 'Walk through the agenda. Tell the audience we will cover the branches, history, key techniques, applications, and ethics.',
      accentIcon: 'ListOrdered',
    },
    {
      title: 'What is Artificial Intelligence?',
      layout: 'two-column',
      subtitle: 'The core definition',
      body: 'Artificial intelligence is the science and engineering of building systems that perform tasks that normally require human intelligence. These include reasoning, learning, perceiving, understanding language, and making decisions.',
      bullets: [
        bl('Systems that mimic human cognitive functions'),
        bl('Includes reasoning, learning, perception, and language'),
        bl('Narrow AI — specialized for one task (today\'s AI)'),
        bl('General AI — human-level intelligence across tasks (future)'),
      ],
      notes: 'Distinguish narrow AI (what we have today — Siri, ChatGPT, Tesla) from general AI (science fiction for now). All current AI is narrow.',
      accentIcon: 'BrainCircuit',
    },
    {
      title: 'Branches of AI',
      layout: 'cards',
      subtitle: 'The major subfields',
      cards: [
        cd('Machine Learning', 'Systems that learn from data instead of explicit rules. The most commercially impactful branch of AI today.', 'BrainCircuit'),
        cd('Deep Learning', 'Neural networks with many layers. Powers breakthroughs in vision, language, and speech.', 'Network'),
        cd('Natural Language Processing', 'Understanding and generating human language. Powers chatbots, translation, and search.', 'MessageSquare'),
        cd('Computer Vision', 'Interpreting visual data from images and video. Powers face recognition and self-driving cars.', 'Eye'),
        cd('Robotics', 'Physical agents that perceive and act in the real world. Combines AI with mechanical engineering.', 'Bot'),
        cd('Expert Systems', 'Rule-based systems that emulate human expert decisions in specific domains like medicine.', 'Stethoscope'),
      ],
      notes: 'Walk through each branch. Machine learning and deep learning are the engines behind most modern AI breakthroughs.',
      accentIcon: 'LayoutGrid',
    },
    {
      title: 'A Brief History',
      layout: 'timeline',
      subtitle: 'Key milestones in AI',
      timeline: [
        tl('1950', 'The Turing Test', 'Alan Turing proposes a test for machine intelligence: can a machine fool a human into thinking it is human?'),
        tl('1956', 'The Dartmouth Conference', 'The term "artificial intelligence" is coined at Dartmouth College, marking the birth of AI as a field.'),
        tl('1980s', 'Expert Systems', 'Rule-based systems achieve commercial success in medicine and finance, driving an AI boom.'),
        tl('1997', 'Deep Blue Beats Kasparov', 'IBM\'s Deep Blue defeats world chess champion Garry Kasparov, a landmark for game-playing AI.'),
        tl('2012', 'Deep Learning Breakthrough', 'AlexNet wins the ImageNet competition by a wide margin, launching the deep learning era.'),
        tl('2022', 'ChatGPT Launches', 'OpenAI releases ChatGPT, bringing large language models to hundreds of millions of users.'),
      ],
      notes: 'Walk through the timeline. Emphasize the 2012 deep learning breakthrough and the 2022 ChatGPT moment — these two events define modern AI.',
      accentIcon: 'GitCommitHorizontal',
    },
    {
      title: 'Machine Learning',
      layout: 'two-column',
      subtitle: 'Learning from data',
      body: 'Machine learning is the core of modern AI. Instead of programming explicit rules, we feed data to algorithms that learn patterns. The three main types are supervised, unsupervised, and reinforcement learning.',
      bullets: [
        bl('Supervised — learn from labeled examples (classification, regression)'),
        bl('Unsupervised — find patterns in unlabeled data (clustering)'),
        bl('Reinforcement — learn by trial and error with rewards'),
        bl('Powers recommendations, search, ads, and autonomous systems'),
      ],
      notes: 'Explain that machine learning is the engine behind most AI products today. The three types cover most real-world use cases.',
      accentIcon: 'BrainCircuit',
    },
    {
      title: 'Deep Learning',
      layout: 'two-column',
      subtitle: 'Neural networks at scale',
      body: 'Deep learning uses artificial neural networks with many layers to learn hierarchical representations of data. It powers the most impressive recent AI breakthroughs: image generation, language models, and game-playing agents.',
      bullets: [
        bl('Neural networks with many layers (deep architectures)'),
        bl('Learns hierarchical features automatically'),
        bl('CNNs for images, RNNs/Transformers for sequences'),
        bl('Requires large data and significant compute (GPUs)'),
      ],
      notes: 'Explain that deep learning automates feature engineering — earlier ML required manual feature design, deep networks learn features themselves from raw data.',
      accentIcon: 'Network',
    },
    {
      title: 'Natural Language Processing',
      layout: 'two-column',
      subtitle: 'Understanding human language',
      body: 'NLP enables machines to read, understand, and generate human language. Modern NLP is dominated by transformer-based large language models like GPT, BERT, and LLaMA, which can translate, summarize, answer questions, and converse.',
      bullets: [
        bl('Text classification — spam detection, sentiment analysis'),
        bl('Machine translation — Google Translate, DeepL'),
        bl('Question answering — chatbots, virtual assistants'),
        bl('Text generation — ChatGPT, Claude, Gemini'),
        bl('Speech recognition — Siri, Alexa, dictation'),
      ],
      notes: 'Mention that transformers (2017) revolutionized NLP. Before transformers, models struggled with long-range dependencies in text.',
      accentIcon: 'MessageSquare',
    },
    {
      title: 'Computer Vision',
      layout: 'two-column',
      subtitle: 'Seeing and understanding images',
      body: 'Computer vision enables machines to interpret visual data. Convolutional neural networks (CNNs) revolutionized the field, achieving superhuman performance on some image recognition tasks. Applications span medical imaging, autonomous driving, and security.',
      bullets: [
        bl('Image classification — what is in this image?'),
        bl('Object detection — locate and identify multiple objects'),
        bl('Face recognition — identify people from faces'),
        bl('Image segmentation — pixel-level labeling'),
        bl('Autonomous driving — perceive the road and obstacles'),
      ],
      notes: 'Mention that CNNs (2012, AlexNet) were the breakthrough. Today, vision transformers are challenging CNNs on many tasks.',
      accentIcon: 'Eye',
    },
    {
      title: 'Applications',
      layout: 'cards',
      subtitle: 'AI in the real world',
      cards: [
        cd('Healthcare', 'Disease diagnosis, drug discovery, personalized treatment, and medical imaging analysis.', 'HeartPulse'),
        cd('Finance', 'Fraud detection, algorithmic trading, credit scoring, and risk assessment.', 'DollarSign'),
        cd('Transportation', 'Self-driving cars, route optimization, and traffic prediction.', 'Car'),
        cd('Entertainment', 'Content recommendations on Netflix, Spotify, and YouTube.', 'Play'),
        cd('Education', 'Personalized tutoring, automated grading, and adaptive learning.', 'GraduationCap'),
        cd('Manufacturing', 'Predictive maintenance, quality inspection, and supply chain optimization.', 'Factory'),
      ],
      notes: 'Walk through each application. Ask the audience which ones they have used today — most will say entertainment recommendations and search.',
      accentIcon: 'LayoutGrid',
    },
    {
      title: 'Ethics & Challenges',
      layout: 'two-column',
      subtitle: 'The responsibilities of building AI',
      body: 'AI raises significant ethical questions: bias and fairness, transparency, privacy, job displacement, and the concentration of power. Responsible AI development requires deliberate governance, diverse teams, and ongoing evaluation.',
      bullets: [
        bl('Bias — models can inherit and amplify biases in training data'),
        bl('Transparency — deep models are hard to interpret ("black boxes")'),
        bl('Privacy — learning from personal data raises consent concerns'),
        bl('Employment — automation may displace certain jobs'),
        bl('Safety — autonomous systems must be reliable and secure'),
      ],
      notes: 'Discuss bias with a concrete example: a hiring model trained on historical data may disadvantage underrepresented groups. Transparency matters in high-stakes decisions.',
      accentIcon: 'Scale',
    },
    {
      title: 'Summary',
      layout: 'two-column',
      subtitle: 'Key takeaways',
      body: 'Artificial intelligence builds systems that perform tasks requiring human intelligence. Its branches include machine learning, deep learning, NLP, and computer vision. AI is already embedded in countless products and raises important ethical questions.',
      bullets: [
        bl('AI builds systems that mimic human cognitive functions'),
        bl('Major branches: ML, deep learning, NLP, computer vision'),
        bl('Deep learning and transformers drive recent breakthroughs'),
        bl('Applications span healthcare, finance, transport, and more'),
        bl('Ethics — bias, transparency, privacy — must be taken seriously'),
      ],
      notes: 'Recap the branches and the ethical dimension. Remind the audience that AI is a tool, and its impact depends on how we build and govern it. Invite questions.',
      accentIcon: 'CheckCircle2',
    },
    {
      title: 'Thank You',
      layout: 'thank-you',
      subtitle: 'Questions, comments, and discussion welcome.',
      body: 'Artificial Intelligence',
      notes: 'Close confidently. Thank the audience. Restate the key takeaway: AI is transforming how we live and work, and responsible development is everyone\'s job. Open the floor for questions.',
      accentIcon: 'Heart',
    },
  ],
});

// ── Cloud: Cloud Computing ────────────────────────────────────────────────────

entry({
  keys: ['cloud computing', 'cloud', 'what is cloud computing', 'introduction to cloud computing'],
  category: 'cloud',
  title: 'Cloud Computing',
  topic: 'cloud computing',
  build: () => [
    {
      title: 'Cloud Computing',
      layout: 'hero',
      subtitle: 'On-demand delivery of compute, storage, databases, and software over the internet — pay as you go, scale as you need.',
      body: 'A complete introduction to cloud computing: service models, deployment models, benefits, providers, and use cases.',
      notes: 'Welcome the audience. Explain that cloud computing is how most modern applications are built and delivered. Set expectations for the session.',
      accentIcon: 'Cloud',
    },
    {
      title: 'Agenda',
      layout: 'agenda',
      subtitle: 'What we will cover',
      bullets: [
        bl('What is Cloud Computing?'),
        bl('Service Models: IaaS, PaaS, SaaS'),
        bl('Deployment Models'),
        bl('Key Characteristics'),
        bl('Benefits'),
        bl('Major Cloud Providers'),
        bl('Common Use Cases'),
        bl('Challenges & Considerations'),
        bl('Summary'),
      ],
      notes: 'Walk through the agenda. Tell the audience we will cover the service and deployment models, benefits, providers, and challenges.',
      accentIcon: 'ListOrdered',
    },
    {
      title: 'What is Cloud Computing?',
      layout: 'two-column',
      subtitle: 'The core concept',
      body: 'Cloud computing is the on-demand delivery of IT resources — servers, storage, databases, networking, software — over the internet with pay-as-you-go pricing. Instead of buying and maintaining physical hardware, you rent what you need from a cloud provider.',
      bullets: [
        bl('On-demand, self-service access to computing resources'),
        bl('Pay-as-you-go pricing — no upfront hardware investment'),
        bl('Resources are accessed over the internet'),
        bl('Elastic — scale up or down as demand changes'),
      ],
      notes: 'Use the electricity analogy: you don\'t build a power plant to use electricity; you plug in and pay for what you use. Cloud is computing as a utility.',
      accentIcon: 'Cloud',
    },
    {
      title: 'Service Models',
      layout: 'cards',
      subtitle: 'IaaS, PaaS, SaaS',
      cards: [
        cd('IaaS', 'Infrastructure as a Service. You rent virtual machines, storage, and networking. You manage the OS and applications. Example: AWS EC2.', 'Server'),
        cd('PaaS', 'Platform as a Service. The provider manages the runtime, and you focus on your code. Example: Google App Engine, Heroku.', 'Layers'),
        cd('SaaS', 'Software as a Service. Fully managed applications delivered over the internet. Example: Gmail, Salesforce, Microsoft 365.', 'AppWindow'),
      ],
      notes: 'Walk through each model. IaaS gives you the most control, SaaS the least. The trade-off is control vs. convenience.',
      accentIcon: 'LayoutGrid',
    },
    {
      title: 'Deployment Models',
      layout: 'two-column',
      subtitle: 'Public, private, hybrid, multi-cloud',
      body: 'Cloud resources can be deployed in different ways depending on security, compliance, and cost requirements. The four main deployment models offer different trade-offs between control, cost, and flexibility.',
      bullets: [
        bl('Public cloud — resources owned and operated by a provider (AWS, Azure, GCP)'),
        bl('Private cloud — resources used by one organization, on-premises or hosted'),
        bl('Hybrid cloud — combines public and private, with data and workload portability'),
        bl('Multi-cloud — uses services from multiple public cloud providers'),
      ],
      notes: 'Explain the trade-offs: public cloud is cheapest and most elastic, private cloud is most secure and controlled, hybrid combines both.',
      accentIcon: 'Network',
    },
    {
      title: 'Key Characteristics',
      layout: 'two-column',
      subtitle: 'What defines cloud computing',
      body: 'The NIST definition of cloud computing identifies five essential characteristics that distinguish it from traditional hosting: on-demand self-service, broad network access, resource pooling, rapid elasticity, and measured service.',
      bullets: [
        bl('On-demand self-service — provision resources without human interaction'),
        bl('Broad network access — access from anywhere via the internet'),
        bl('Resource pooling — multi-tenant, shared infrastructure'),
        bl('Rapid elasticity — scale up or down quickly'),
        bl('Measured service — pay only for what you use'),
      ],
      notes: 'Walk through each characteristic. On-demand self-service and measured service are the two that most distinguish cloud from traditional hosting.',
      accentIcon: 'Settings',
    },
    {
      title: 'Benefits',
      layout: 'cards',
      subtitle: 'Why organizations move to the cloud',
      cards: [
        cd('Cost Efficiency', 'No upfront capital expenditure. Pay-as-you-go converts fixed costs to variable costs.', 'DollarSign'),
        cd('Scalability', 'Scale resources up or down in minutes to match demand. No over-provisioning.', 'Maximize'),
        cd('Reliability', 'Cloud providers offer high availability through multiple data centers and redundancy.', 'ShieldCheck'),
        cd('Speed', 'Provision resources in minutes, not weeks. Accelerates development and innovation.', 'Zap'),
        cd('Global Reach', 'Deploy in dozens of regions worldwide to serve users with low latency.', 'Globe'),
        cd('Security', 'Providers invest heavily in security certifications and tools that most organizations cannot match.', 'Lock'),
      ],
      notes: 'Walk through each benefit. Cost efficiency and scalability are the two most commonly cited reasons for cloud adoption.',
      accentIcon: 'TrendingUp',
    },
    {
      title: 'Major Cloud Providers',
      layout: 'table',
      subtitle: 'The leading platforms',
      table: {
        headers: ['Provider', 'Launch', 'Strength', 'Market Share'],
        rows: [
          ['Amazon Web Services (AWS)', '2006', 'Broadest service catalog, market leader', '~32%'],
          ['Microsoft Azure', '2010', 'Strong enterprise integration, hybrid cloud', '~23%'],
          ['Google Cloud Platform (GCP)', '2008', 'Data, AI/ML, and open-source leadership', '~10%'],
          ['Alibaba Cloud', '2009', 'Dominant in China and Asia-Pacific', '~4%'],
          ['IBM Cloud', '2013', 'Enterprise, mainframe, and hybrid cloud', '~3%'],
          ['Oracle Cloud', '2016', 'Database and enterprise applications', '~2%'],
        ],
      },
      notes: 'Walk through the table. AWS is the pioneer and market leader, Azure is strong in enterprise, GCP leads in data and AI.',
      accentIcon: 'Table',
    },
    {
      title: 'Common Use Cases',
      layout: 'cards',
      subtitle: 'How organizations use the cloud',
      cards: [
        cd('Web Applications', 'Host websites and web apps with auto-scaling and global content delivery.', 'Globe'),
        cd('Data Storage & Backup', 'Store and back up data durably with multi-region replication.', 'Database'),
        cd('Big Data & Analytics', 'Process large datasets with managed services like BigQuery and EMR.', 'BarChart3'),
        cd('AI & Machine Learning', 'Train and deploy ML models with managed services like SageMaker and Vertex AI.', 'BrainCircuit'),
        cd('Disaster Recovery', 'Replicate workloads across regions for business continuity.', 'ShieldCheck'),
        cd('DevOps & CI/CD', 'Automate build, test, and deployment pipelines with managed services.', 'Workflow'),
      ],
      notes: 'Walk through each use case. Web hosting and data storage are the most common starting points; AI/ML and big data are the fastest growing.',
      accentIcon: 'LayoutGrid',
    },
    {
      title: 'Challenges & Considerations',
      layout: 'two-column',
      subtitle: 'What to watch out for',
      body: 'Cloud computing is not without challenges. Cost management, security, vendor lock-in, compliance, and the skills gap are common concerns. A successful cloud strategy addresses these proactively rather than reactively.',
      bullets: [
        bl('Cost management — easy to overspend without monitoring and governance'),
        bl('Security — shared responsibility; you must secure your data and access'),
        bl('Vendor lock-in — proprietary services make switching providers hard'),
        bl('Compliance — data residency and regulatory requirements vary by region'),
        bl('Skills gap — cloud expertise is in high demand and short supply'),
      ],
      notes: 'Discuss cost management as the most common surprise: cloud is cheap to start but expensive at scale without discipline. Vendor lock-in is the second most cited concern.',
      accentIcon: 'AlertTriangle',
    },
    {
      title: 'Summary',
      layout: 'two-column',
      subtitle: 'Key takeaways',
      body: 'Cloud computing delivers IT resources on demand over the internet with pay-as-you-go pricing. The three service models (IaaS, PaaS, SaaS) and four deployment models (public, private, hybrid, multi-cloud) offer flexibility. Benefits include cost efficiency, scalability, and global reach.',
      bullets: [
        bl('Cloud = on-demand IT resources over the internet, pay-as-you-go'),
        bl('Service models: IaaS, PaaS, SaaS'),
        bl('Deployment models: public, private, hybrid, multi-cloud'),
        bl('Major providers: AWS, Azure, GCP'),
        bl('Benefits: cost, scale, speed, global reach — with challenges to manage'),
      ],
      notes: 'Recap the service and deployment models. Remind the audience that cloud is a tool, not a destination — strategy matters. Invite questions.',
      accentIcon: 'CheckCircle2',
    },
    {
      title: 'Thank You',
      layout: 'thank-you',
      subtitle: 'Questions, comments, and discussion welcome.',
      body: 'Cloud Computing',
      notes: 'Close confidently. Thank the audience. Restate the key takeaway: cloud computing is the default way to build and deliver modern applications. Open the floor for questions.',
      accentIcon: 'Heart',
    },
  ],
});

// ── Science: Solar System ─────────────────────────────────────────────────────

entry({
  keys: ['solar system', 'the solar system', 'planets', 'our solar system'],
  category: 'science',
  title: 'The Solar System',
  topic: 'the solar system',
  build: () => [
    {
      title: 'The Solar System',
      layout: 'hero',
      subtitle: 'The Sun and the eight planets, dwarf planets, moons, asteroids, and comets bound by gravity — our cosmic neighborhood.',
      body: 'A complete tour of the solar system: the Sun, the eight planets, dwarf planets, small bodies, and the structure of our planetary system.',
      notes: 'Welcome the audience. Explain that the solar system is our home in the universe and has been studied for thousands of years. Set expectations for the tour.',
      accentIcon: 'Sun',
    },
    {
      title: 'Agenda',
      layout: 'agenda',
      subtitle: 'What we will cover',
      bullets: [
        bl('Introduction to the Solar System'),
        bl('The Sun'),
        bl('The Inner Planets'),
        bl('The Outer Planets'),
        bl('Dwarf Planets'),
        bl('Small Bodies: Asteroids, Comets, Meteoroids'),
        bl('The Kuiper Belt & Oort Cloud'),
        bl('Formation of the Solar System'),
        bl('Summary'),
      ],
      notes: 'Walk through the agenda. Tell the audience we will take a tour from the Sun outward, then cover small bodies and formation.',
      accentIcon: 'ListOrdered',
    },
    {
      title: 'Introduction to the Solar System',
      layout: 'two-column',
      subtitle: 'An overview',
      body: 'The solar system formed about 4.6 billion years ago from a giant cloud of gas and dust called the solar nebula. It consists of the Sun at the center and everything bound to it by gravity: eight planets, dozens of moons, and countless small bodies.',
      bullets: [
        bl('Formed ~4.6 billion years ago from the solar nebula'),
        bl('The Sun holds 99.86% of the system\'s mass'),
        bl('Eight planets: four inner (rocky) and four outer (gas/ice giants)'),
        bl('Contains dwarf planets, asteroids, comets, and moons'),
      ],
      notes: 'Give the scale: light from the Sun takes 8 minutes to reach Earth and about 5.5 hours to reach Neptune. The solar system is enormous but tiny compared to the galaxy.',
      accentIcon: 'Sun',
    },
    {
      title: 'The Sun',
      layout: 'two-column',
      subtitle: 'The star at the center',
      body: 'The Sun is a G-type main-sequence star (G2V) at the center of the solar system. It is a giant ball of hot plasma, generating energy through nuclear fusion of hydrogen into helium in its core. It accounts for 99.86% of the system\'s mass.',
      bullets: [
        bl('A G2V main-sequence star (yellow dwarf)'),
        bl('Diameter ~1.39 million km (109 Earths)'),
        bl('Surface temperature ~5,500°C; core ~15 million °C'),
        bl('Energy from nuclear fusion: hydrogen → helium'),
        bl('Holds 99.86% of the solar system\'s mass'),
      ],
      stats: [
        st('1.39M km', 'Diameter', '109 times the diameter of Earth'),
        st('5,500°C', 'Surface Temp', 'The photosphere temperature'),
        st('15M °C', 'Core Temp', 'Where nuclear fusion occurs'),
        st('4.6B yrs', 'Age', 'About halfway through its life'),
      ],
      notes: 'Explain that the Sun is a typical star but special to us. It has enough hydrogen to burn for another 5 billion years, after which it will become a red giant.',
      accentIcon: 'Sun',
    },
    {
      title: 'The Inner Planets',
      layout: 'cards',
      subtitle: 'The four rocky terrestrial planets',
      cards: [
        cd('Mercury', 'The smallest planet and closest to the Sun. No atmosphere, extreme temperature swings, heavily cratered surface.', 'Circle'),
        cd('Venus', 'The hottest planet due to a thick CO2 atmosphere causing runaway greenhouse effect. Similar in size to Earth.', 'Circle'),
        cd('Earth', 'The only known planet with life. Liquid water, protective atmosphere, and a magnetic field. Our home.', 'Circle'),
        cd('Mars', 'The Red Planet, colored by iron oxide. Has the largest volcano (Olympus Mons) and evidence of past water.', 'Circle'),
      ],
      notes: 'Walk through each planet. Mercury is extreme, Venus is the hottest (not Mercury), Earth is unique, and Mars is the most explored and studied for potential life.',
      accentIcon: 'Circle',
    },
    {
      title: 'The Outer Planets',
      layout: 'cards',
      subtitle: 'The four gas and ice giants',
      cards: [
        cd('Jupiter', 'The largest planet, a gas giant with a Great Red Spot storm and 95+ moons including the four Galilean moons.', 'Circle'),
        cd('Saturn', 'Famous for its spectacular ring system made of ice and rock. A gas giant with 145+ moons including Titan.', 'Circle'),
        cd('Uranus', 'An ice giant that rotates on its side (98° axial tilt). Colored blue-green by methane in its atmosphere.', 'Circle'),
        cd('Neptune', 'The farthest planet, an ice giant with the strongest winds in the solar system (up to 2,100 km/h).', 'Circle'),
      ],
      notes: 'Walk through each planet. Jupiter and Saturn are gas giants (mostly hydrogen and helium); Uranus and Neptune are ice giants (water, ammonia, methane ices).',
      accentIcon: 'Circle',
    },
    {
      title: 'Planet Comparison',
      layout: 'table',
      subtitle: 'Key facts side by side',
      table: {
        headers: ['Planet', 'Diameter (vs Earth)', 'Distance from Sun', 'Moons', 'Day Length'],
        rows: [
          ['Mercury', '0.38x', '57.9M km', '0', '59 Earth days'],
          ['Venus', '0.95x', '108.2M km', '0', '243 Earth days'],
          ['Earth', '1.00x', '149.6M km', '1', '24 hours'],
          ['Mars', '0.53x', '227.9M km', '2', '24.6 hours'],
          ['Jupiter', '11.2x', '778.5M km', '95+', '9.9 hours'],
          ['Saturn', '9.4x', '1.43B km', '145+', '10.7 hours'],
          ['Uranus', '4.0x', '2.87B km', '28', '17.2 hours'],
          ['Neptune', '3.9x', '4.50B km', '16', '16.1 hours'],
        ],
      },
      notes: 'Walk through the table. Highlight that Jupiter is 11 times wider than Earth and has the shortest day. Venus has the longest day — longer than its year.',
      accentIcon: 'Table',
    },
    {
      title: 'Dwarf Planets',
      layout: 'two-column',
      subtitle: 'Pluto and its companions',
      body: 'Dwarf planets are round objects that orbit the Sun but have not cleared their orbital neighborhood of other debris. The IAU reclassified Pluto as a dwarf planet in 2006, joining Ceres, Haumea, Makemake, and Eris.',
      bullets: [
        bl('Pluto — the most famous dwarf planet, reclassified in 2006'),
        bl('Ceres — in the asteroid belt, the only dwarf planet in the inner system'),
        bl('Haumea — elongated, rapidly rotating, in the Kuiper Belt'),
        bl('Makemake — in the Kuiper Belt, discovered in 2005'),
        bl('Eris — slightly more massive than Pluto, triggered the reclassification'),
      ],
      notes: 'Explain the 2006 IAU definition: a planet must orbit the Sun, be round, and have cleared its orbit. Pluto failed the third criterion, so it was reclassified.',
      accentIcon: 'Circle',
    },
    {
      title: 'Small Bodies',
      layout: 'cards',
      subtitle: 'Asteroids, comets, and meteoroids',
      cards: [
        cd('Asteroids', 'Rocky bodies mostly found in the asteroid belt between Mars and Jupiter. Range from small rocks to dwarf-planet-sized objects like Ceres.', 'Asteroid'),
        cd('Comets', 'Icy bodies that develop glowing tails of gas and dust when they approach the Sun. Famous example: Halley\'s Comet, visible every 76 years.', 'Snowflake'),
        cd('Meteoroids', 'Small rocky or metallic bodies in space. When they enter Earth\'s atmosphere they become meteors ("shooting stars"); those that land are meteorites.', 'Sparkles'),
        cd('Kuiper Belt', 'A region beyond Neptune containing icy bodies including Pluto. Source of short-period comets.', 'Circle'),
      ],
      notes: 'Walk through each category. The asteroid belt is between Mars and Jupiter; the Kuiper Belt is beyond Neptune. Comets come from the Kuiper Belt and the more distant Oort Cloud.',
      accentIcon: 'LayoutGrid',
    },
    {
      title: 'Formation of the Solar System',
      layout: 'process',
      subtitle: 'How it all began',
      steps: [
        ps(1, 'Solar Nebula', 'A giant cloud of gas and dust begins to collapse under gravity about 4.6 billion years ago.'),
        ps(2, 'Spinning Disk', 'As the cloud collapses, it spins and flattens into a disk with a dense, hot center.'),
        ps(3, 'Sun Ignites', 'Pressure and temperature in the center become high enough for nuclear fusion — the Sun is born.'),
        ps(4, 'Planet Formation', 'Dust and gas in the disk clump together through accretion, forming planetesimals and then planets.'),
        ps(5, 'Differentiation', 'Inner planets lose light gases due to the Sun\'s heat; outer planets retain them, becoming gas giants.'),
        ps(6, 'Clearing', 'Planets sweep up or eject most remaining debris, leaving the solar system largely as we see it today.'),
      ],
      notes: 'Walk through the process. The solar nebula theory explains why all planets orbit in the same direction and nearly the same plane.',
      accentIcon: 'Workflow',
    },
    {
      title: 'Key Facts',
      layout: 'statistics',
      subtitle: 'The solar system by the numbers',
      stats: [
        st('4.6B', 'Age (years)', 'Estimated age of the solar system'),
        st('8', 'Planets', 'Four terrestrial, four gas/ice giants'),
        st('5', 'Dwarf Planets', 'Officially recognized by the IAU'),
        st('200+', 'Moons', 'Confirmed moons across all planets'),
        st('99.86%', 'Sun\'s Mass', 'Of the total solar system mass'),
        st('4.5B km', 'To Neptune', 'Farthest planet from the Sun'),
      ],
      notes: 'Walk through the numbers. The Sun\'s mass dominance is striking — everything else combined is just 0.14% of the system.',
      accentIcon: 'BarChart3',
    },
    {
      title: 'Summary',
      layout: 'two-column',
      subtitle: 'Key takeaways',
      body: 'The solar system consists of the Sun, eight planets, dwarf planets, and countless small bodies. It formed 4.6 billion years ago from a collapsing cloud of gas and dust. The inner planets are rocky; the outer planets are gas and ice giants.',
      bullets: [
        bl('The Sun holds 99.86% of the system\'s mass'),
        bl('Eight planets: four rocky inner, four gas/ice outer'),
        bl('Pluto is a dwarf planet, reclassified in 2006'),
        bl('The asteroid belt lies between Mars and Jupiter'),
        bl('The Kuiper Belt and Oort Cloud are sources of comets'),
      ],
      notes: 'Recap the structure. Remind the audience that the solar system is vast but just a tiny corner of our galaxy. Invite questions.',
      accentIcon: 'CheckCircle2',
    },
    {
      title: 'Thank You',
      layout: 'thank-you',
      subtitle: 'Questions, comments, and discussion welcome.',
      body: 'The Solar System',
      notes: 'Close confidently. Thank the audience. Restate the key takeaway: the solar system is our cosmic neighborhood, diverse and dynamic. Open the floor for questions.',
      accentIcon: 'Heart',
    },
  ],
});

// ── Biology: Human Digestive System ────────────────────────────────────────────

entry({
  keys: ['human digestive system', 'digestive system', 'digestion', 'human digestion'],
  category: 'biology',
  title: 'The Human Digestive System',
  topic: 'the human digestive system',
  build: () => [
    {
      title: 'The Human Digestive System',
      layout: 'hero',
      subtitle: 'The group of organs that break down food into nutrients the body can absorb and use for energy, growth, and repair.',
      body: 'A complete tour of the digestive system: the alimentary canal, accessory organs, the process of digestion, and nutrient absorption.',
      notes: 'Welcome the audience. Explain that digestion is how our body converts food into the nutrients that power every cell. Set expectations for the tour.',
      accentIcon: 'Activity',
    },
    {
      title: 'Agenda',
      layout: 'agenda',
      subtitle: 'What we will cover',
      bullets: [
        bl('Introduction to Digestion'),
        bl('The Mouth'),
        bl('The Esophagus'),
        bl('The Stomach'),
        bl('The Small Intestine'),
        bl('The Large Intestine'),
        bl('Accessory Organs'),
        bl('The Digestive Process'),
        bl('Common Disorders'),
        bl('Summary'),
      ],
      notes: 'Walk through the agenda. Tell the audience we will follow food on its journey through the body.',
      accentIcon: 'ListOrdered',
    },
    {
      title: 'Introduction to Digestion',
      layout: 'two-column',
      subtitle: 'What digestion is and why it matters',
      body: 'Digestion is the process of breaking down food into smaller molecules that the body can absorb and use. It involves both mechanical breakdown (chewing, churning) and chemical breakdown (enzymes, acids). The digestive tract is about 9 meters long in an adult.',
      bullets: [
        bl('Breaks food into nutrients the body can absorb'),
        bl('Two types: mechanical (physical) and chemical (enzymatic)'),
        bl('The digestive tract is ~9 meters long'),
        bl('Takes 24-72 hours for food to pass completely'),
      ],
      notes: 'Give the scale: the digestive tract is about 9 meters long, and food takes 24-72 hours to travel from mouth to anus. Digestion is both mechanical and chemical.',
      accentIcon: 'Activity',
    },
    {
      title: 'The Mouth',
      layout: 'two-column',
      subtitle: 'Where digestion begins',
      body: 'Digestion begins in the mouth. Teeth mechanically break food into smaller pieces (mastication), while saliva — produced by the salivary glands — contains the enzyme amylase that begins the chemical breakdown of starches into sugars.',
      bullets: [
        bl('Teeth perform mechanical breakdown (mastication)'),
        bl('Saliva moistens food and contains amylase'),
        bl('Amylase begins breaking down starch into sugars'),
        bl('The tongue forms food into a bolus for swallowing'),
      ],
      notes: 'Explain that the mouth does both mechanical (teeth) and chemical (saliva/amylase) digestion. The bolus is the soft ball of food ready to swallow.',
      accentIcon: 'Smile',
    },
    {
      title: 'The Esophagus',
      layout: 'two-column',
      subtitle: 'The food pipe',
      body: 'The esophagus is a muscular tube that connects the mouth to the stomach. Food moves through it by peristalsis — rhythmic, wave-like muscle contractions that push the bolus downward. A sphincter at the bottom prevents stomach acid from flowing back up.',
      bullets: [
        bl('A muscular tube ~25 cm long connecting mouth to stomach'),
        bl('Food moves by peristalsis (wave-like muscle contractions)'),
        bl('The lower esophageal sphincter prevents acid reflux'),
        bl('Takes about 6-8 seconds for food to reach the stomach'),
      ],
      notes: 'Explain peristalsis with the analogy of squeezing toothpaste from a tube. The lower esophageal sphincter is the valve that prevents heartburn.',
      accentIcon: 'ArrowDownToLine',
    },
    {
      title: 'The Stomach',
      layout: 'two-column',
      subtitle: 'The chemical processing tank',
      body: 'The stomach is a muscular sac that churns food and mixes it with gastric juices. These juices contain hydrochloric acid (HCl) and the enzyme pepsin, which begins the digestion of proteins. The result is a semi-liquid mixture called chyme.',
      bullets: [
        bl('A muscular sac that holds ~1.5 liters of food'),
        bl('Secretes gastric juice: HCl (pH ~2) and pepsin'),
        bl('HCl kills bacteria and activates pepsin'),
        bl('Pepsin begins protein digestion'),
        bl('Food becomes a semi-liquid called chyme'),
      ],
      notes: 'Emphasize the extreme acidity (pH ~2) that kills bacteria and activates pepsin. The stomach lining protects itself with a thick mucus layer.',
      accentIcon: 'FlaskConical',
    },
    {
      title: 'The Small Intestine',
      layout: 'two-column',
      subtitle: 'Where most digestion and absorption happen',
      body: 'The small intestine is about 6 meters long and is where most chemical digestion and nearly all nutrient absorption occur. It has three parts: the duodenum, jejunum, and ileum. Its inner surface is covered in villi and microvilli that vastly increase absorption area.',
      bullets: [
        bl('~6 meters long, three parts: duodenum, jejunum, ileum'),
        bl('Most chemical digestion happens here'),
        bl('Villi and microvilli increase surface area ~600x'),
        bl('Absorbs nutrients into the bloodstream'),
        bl('Receives enzymes from the pancreas and bile from the liver'),
      ],
      notes: 'Emphasize the villi and microvilli — they give the small intestine a surface area of about 250 square meters, the size of a tennis court. This is why absorption is so efficient.',
      accentIcon: 'Layers',
    },
    {
      title: 'The Large Intestine',
      layout: 'two-column',
      subtitle: 'Water absorption and waste formation',
      body: 'The large intestine (colon) is about 1.5 meters long. Its main job is to absorb water and electrolytes from the remaining indigestible food matter, forming solid waste (feces). It also hosts billions of beneficial bacteria that produce some vitamins.',
      bullets: [
        bl('~1.5 meters long, wider than the small intestine'),
        bl('Absorbs water and electrolytes'),
        bl('Forms and stores feces'),
        bl('Hosts beneficial gut bacteria that make vitamins K and some B'),
        bl('Waste exits through the rectum and anus'),
      ],
      notes: 'Explain that the large intestine is shorter but wider. The gut bacteria here are important for health — they make vitamin K and some B vitamins.',
      accentIcon: 'Droplet',
    },
    {
      title: 'Accessory Organs',
      layout: 'cards',
      subtitle: 'Organs that help digestion but food does not pass through',
      cards: [
        cd('Liver', 'Produces bile, which emulsifies fats. Also processes absorbed nutrients and detoxifies chemicals. The largest internal organ.', 'FlaskConical'),
        cd('Gallbladder', 'Stores and concentrates bile from the liver, releasing it into the small intestine when fat is present.', 'Droplet'),
        cd('Pancreas', 'Produces digestive enzymes (amylase, lipase, proteases) and bicarbonate, releasing them into the small intestine.', 'FlaskConical'),
        cd('Salivary Glands', 'Produce saliva, which moistens food and contains amylase to begin starch digestion in the mouth.', 'Droplet'),
      ],
      notes: 'Walk through each organ. Food does not pass through these organs, but they produce substances essential for digestion. The liver and pancreas are the most important.',
      accentIcon: 'LayoutGrid',
    },
    {
      title: 'The Digestive Process',
      layout: 'process',
      subtitle: 'Step by step',
      steps: [
        ps(1, 'Ingestion', 'Food enters the mouth. Teeth and saliva begin mechanical and chemical breakdown.'),
        ps(2, 'Propulsion', 'Swallowing moves food into the esophagus. Peristalsis pushes it to the stomach.'),
        ps(3, 'Digestion', 'Stomach acid and enzymes break down proteins. The small intestine continues with enzymes from the pancreas and bile from the liver.'),
        ps(4, 'Absorption', 'Nutrients pass through the intestinal wall into the bloodstream in the small intestine. Water is absorbed in the large intestine.'),
        ps(5, 'Elimination', 'Indigestible waste is formed into feces and eliminated through the rectum and anus.'),
      ],
      notes: 'Walk through each step. Emphasize that digestion and absorption are separate — digestion breaks down, absorption takes in. Most absorption is in the small intestine.',
      accentIcon: 'Workflow',
    },
    {
      title: 'Common Disorders',
      layout: 'cards',
      subtitle: 'When digestion goes wrong',
      cards: [
        cd('GERD', 'Gastroesophageal reflux disease. Stomach acid flows back into the esophagus, causing heartburn. Caused by a weak lower esophageal sphincter.', 'Flame'),
        cd('Peptic Ulcer', 'Sores in the stomach or duodenum lining, often caused by H. pylori bacteria or long-term NSAID use.', 'AlertCircle'),
        cd('Irritable Bowel Syndrome', 'A disorder causing abdominal pain, bloating, and changes in bowel habits. Managed through diet and stress reduction.', 'Activity'),
        cd('Celiac Disease', 'An immune reaction to gluten that damages the small intestine lining, reducing nutrient absorption.', 'ShieldAlert'),
        cd('Constipation', 'Infrequent or difficult bowel movements, often caused by low fiber intake or dehydration.', 'Droplet'),
        cd('Diarrhea', 'Frequent loose or watery stools, often caused by infection, food poisoning, or dietary issues.', 'Droplet'),
      ],
      notes: 'Walk through each disorder. GERD and IBS are very common. Celiac disease is increasingly diagnosed and requires a strict gluten-free diet.',
      accentIcon: 'ShieldAlert',
    },
    {
      title: 'Key Facts',
      layout: 'statistics',
      subtitle: 'The digestive system by the numbers',
      stats: [
        st('9 m', 'Tract Length', 'Total length of the digestive tract'),
        st('6 m', 'Small Intestine', 'Where most absorption happens'),
        st('1.5 L', 'Stomach Capacity', 'How much the stomach can hold'),
        st('pH 2', 'Stomach Acid', 'Strong enough to kill bacteria'),
        st('250 m²', 'Absorption Area', 'Surface area of the small intestine'),
        st('24-72 hr', 'Transit Time', 'Total time food takes to pass through'),
      ],
      notes: 'Walk through the numbers. The 250 square meter absorption area is the most striking — the size of a tennis court, inside your gut.',
      accentIcon: 'BarChart3',
    },
    {
      title: 'Summary',
      layout: 'two-column',
      subtitle: 'Key takeaways',
      body: 'The digestive system breaks down food into nutrients the body can absorb. It consists of the alimentary canal (mouth to anus) and accessory organs (liver, gallbladder, pancreas, salivary glands). Most digestion and absorption happen in the small intestine.',
      bullets: [
        bl('Digestion is both mechanical and chemical'),
        bl('The tract runs from mouth to anus (~9 meters)'),
        bl('The stomach uses acid and pepsin to digest proteins'),
        bl('The small intestine absorbs most nutrients'),
        bl('The large intestine absorbs water and forms waste'),
      ],
      notes: 'Recap the journey. Remind the audience that the small intestine is the star of the show — most digestion and absorption happen there. Invite questions.',
      accentIcon: 'CheckCircle2',
    },
    {
      title: 'Thank You',
      layout: 'thank-you',
      subtitle: 'Questions, comments, and discussion welcome.',
      body: 'The Human Digestive System',
      notes: 'Close confidently. Thank the audience. Restate the key takeaway: the digestive system converts food into the nutrients that power every cell. Open the floor for questions.',
      accentIcon: 'Heart',
    },
  ],
});

// ── History: Indian Freedom Movement ──────────────────────────────────────────

entry({
  keys: ['indian freedom movement', 'indian independence', 'indian freedom struggle', 'india independence'],
  category: 'history',
  title: 'The Indian Freedom Movement',
  topic: 'the Indian freedom movement',
  build: () => [
    {
      title: 'The Indian Freedom Movement',
      layout: 'hero',
      subtitle: 'The century-long struggle that ended British colonial rule in India and led to independence on 15 August 1947.',
      body: 'A historical overview of the Indian freedom movement: key events, leaders, movements, and the path to independence.',
      notes: 'Welcome the audience. Explain that the Indian freedom movement is one of the most remarkable non-violent struggles in history. Set expectations for the session.',
      accentIcon: 'Flag',
    },
    {
      title: 'Agenda',
      layout: 'agenda',
      subtitle: 'What we will cover',
      bullets: [
        bl('Introduction'),
        bl('The Revolt of 1857'),
        bl('Birth of the Indian National Congress'),
        bl('The Gandhian Era'),
        bl('Non-Cooperation Movement'),
        bl('Civil Disobedience Movement'),
        bl('Quit India Movement'),
        bl('Key Leaders'),
        bl('Partition & Independence'),
        bl('Summary'),
      ],
      notes: 'Walk through the agenda. Tell the audience we will follow the timeline from 1857 to 1947, covering key events and leaders.',
      accentIcon: 'ListOrdered',
    },
    {
      title: 'Introduction',
      layout: 'two-column',
      subtitle: 'The scope of the struggle',
      body: 'The Indian freedom movement spanned nearly a century, from the Revolt of 1857 to independence on 15 August 1947. It involved armed resistance, constitutional reform, mass non-violent civil disobedience, and the leadership of figures like Mahatma Gandhi, Jawaharlal Nehru, and Sardar Patel.',
      bullets: [
        bl('Spanned ~90 years (1857-1947)'),
        bl('Combined armed and non-violent resistance'),
        bl('Led by the Indian National Congress and other groups'),
        bl('Culminated in independence on 15 August 1947'),
      ],
      notes: 'Give the scope: nearly a century of struggle, combining armed and non-violent methods, led by many organizations but most prominently the Indian National Congress.',
      accentIcon: 'Flag',
    },
    {
      title: 'The Revolt of 1857',
      layout: 'two-column',
      subtitle: 'The first war of independence',
      body: 'The Revolt of 1857, also called the First War of Independence or the Sepoy Mutiny, was a major but ultimately unsuccessful uprising against the British East India Company. It began among Indian soldiers (sepoys) and spread across northern and central India. It marked the end of Company rule and the beginning of direct British Crown rule.',
      bullets: [
        bl('Began on 10 May 1857 in Meerut'),
        bl('Sparked by cartridges greased with animal fat'),
        bl('Led by sepoys (Indian soldiers) and local rulers'),
        bl('Key figures: Mangal Pandey, Rani Lakshmibai, Bahadur Shah Zafar'),
        bl('Ended in 1858 — led to direct British Crown rule'),
      ],
      notes: 'Explain the immediate cause (greased cartridges that offended both Hindu and Muslim soldiers) and the deeper causes (economic exploitation, political annexation). The revolt failed but shook British confidence.',
      accentIcon: 'Sword',
    },
    {
      title: 'Birth of the Indian National Congress',
      layout: 'two-column',
      subtitle: 'The political platform',
      body: 'The Indian National Congress (INC) was founded in 1885 by A.O. Hume, a retired British civil servant, with the aim of providing a platform for educated Indians to voice their political concerns. In its early years it sought reform within the British Empire, but under the leadership of figures like Dadabhai Naoroji, Bal Gangadhar Tilak, and later Gandhi, it became the engine of the independence movement.',
      bullets: [
        bl('Founded in 1885 in Bombay by A.O. Hume'),
        bl('First president: Womesh Chunder Bonnerjee'),
        bl('Early goal: reform within the British Empire'),
        bl('Became the main vehicle for independence under Gandhi'),
        bl('Dadabhai Naoroji articulated the "drain of wealth" theory'),
      ],
      notes: 'Explain the shift from moderate reform (1885-1905) to more assertive demands under Tilak and the extremists, and finally to mass movement under Gandhi.',
      accentIcon: 'Users',
    },
    {
      title: 'The Gandhian Era',
      layout: 'two-column',
      subtitle: 'Non-violent mass struggle',
      body: 'Mahatma Gandhi returned to India from South Africa in 1915 and transformed the freedom movement into a mass movement. His philosophy of satyagraha (truth-force) and ahimsa (non-violence) led to campaigns of civil disobedience that mobilized millions of ordinary Indians — peasants, workers, women, and students — for the first time.',
      bullets: [
        bl('Gandhi returned from South Africa in 1915'),
        bl('Philosophy: satyagraha (truth-force) and ahimsa (non-violence)'),
        bl('Transformed elite movement into mass movement'),
        bl('Key campaigns: Non-Cooperation, Civil Disobedience, Quit India'),
        bl('Mobilized peasants, women, and workers for the first time'),
      ],
      notes: 'Emphasize the shift: before Gandhi, the movement was elite and constitutional. After Gandhi, it became a mass movement involving ordinary people across class, gender, and region.',
      accentIcon: 'Dove',
    },
    {
      title: 'Key Events Timeline',
      layout: 'timeline',
      subtitle: 'Milestones on the road to freedom',
      timeline: [
        tl('1857', 'Revolt of 1857', 'The First War of Independence. Though unsuccessful, it ended Company rule and began direct Crown rule.'),
        tl('1885', 'INC Founded', 'The Indian National Congress is established, providing a political platform for educated Indians.'),
        tl('1919', 'Jallianwala Bagh Massacre', 'British troops fire on unarmed civilians in Amritsar, killing hundreds and galvanizing the freedom movement.'),
        tl('1920', 'Non-Cooperation Movement', 'Gandhi launches a nationwide non-violent campaign of boycotting British institutions and goods.'),
        tl('1930', 'Dandi Salt March', 'Gandhi marches 240 miles to the sea to make salt, defying the British salt tax. A defining act of civil disobedience.'),
        tl('1942', 'Quit India Movement', 'Gandhi calls for "Do or Die." Mass protests sweep the country, demanding immediate British withdrawal.'),
        tl('1947', 'Independence', 'India gains independence on 15 August 1947. Partition creates India and Pakistan as separate nations.'),
      ],
      notes: 'Walk through the timeline. The 1919 Jallianwala Bagh massacre was a turning point that turned many moderate Indians against British rule. The 1930 Salt March made Gandhi internationally famous.',
      accentIcon: 'GitCommitHorizontal',
    },
    {
      title: 'Key Leaders',
      layout: 'cards',
      subtitle: 'Figures who shaped the movement',
      cards: [
        cd('Mahatma Gandhi', 'Leader of the non-violent movement. His philosophy of satyagraha mobilized millions and inspired civil rights movements worldwide.', 'Dove'),
        cd('Jawaharlal Nehru', 'India\'s first Prime Minister. A socialist and modernist who shaped the vision of independent India.', 'Flag'),
        cd('Sardar Patel', 'The "Iron Man of India." Unified over 500 princely states into the new Indian republic.', 'Shield'),
        cd('Subhas Chandra Bose', 'Leader of the Indian National Army (INA) who took the armed route to freedom, allied with the Axis powers in WWII.', 'Sword'),
        cd('Bhagat Singh', 'A revolutionary socialist who became a martyr at age 23, inspiring youth across India.', 'Flame'),
        cd('Rani Lakshmibai', 'Queen of Jhansi and a leading figure of the 1857 revolt. A symbol of resistance and courage.', 'Crown'),
      ],
      notes: 'Walk through each leader. Gandhi and Nehru led the non-violent mainstream; Bose and Bhagat Singh represent the revolutionary stream. Both contributed to the final outcome.',
      accentIcon: 'Users',
    },
    {
      title: 'Partition & Independence',
      layout: 'two-column',
      subtitle: 'Freedom and its cost',
      body: 'On 15 August 1947, India gained independence from British rule. However, the country was partitioned into two dominions — Hindu-majority India and Muslim-majority Pakistan — based on the two-nation theory advocated by the Muslim League. Partition triggered massive communal violence and one of the largest mass migrations in history.',
      bullets: [
        bl('Independence on 15 August 1947'),
        bl('Partition into India and Pakistan'),
        bl('Driven by the two-nation theory of the Muslim League'),
        bl('Triggered massive communal violence and migration'),
        bl('10-12 million people displaced; ~1 million killed'),
      ],
      notes: 'Explain that independence came at a terrible cost. The partition violence remains one of the most traumatic events in modern South Asian history. The scars persist today.',
      accentIcon: 'Flag',
    },
    {
      title: 'Legacy',
      layout: 'two-column',
      subtitle: 'The movement\'s lasting impact',
      body: 'The Indian freedom movement inspired anti-colonial and civil rights movements around the world. Gandhi\'s philosophy of non-violent resistance influenced Martin Luther King Jr., Nelson Mandela, and many others. The movement also established democratic institutions and a constitution that guides the world\'s largest democracy.',
      bullets: [
        bl('Inspired anti-colonial movements worldwide'),
        bl('Gandhi\'s non-violence influenced Martin Luther King Jr. and Nelson Mandela'),
        bl('Established democratic institutions and a constitution'),
        bl('India became the world\'s largest democracy'),
        bl('Demonstrated the power of mass non-violent resistance'),
      ],
      notes: 'Discuss the global legacy. Gandhi\'s influence on Martin Luther King Jr. is well documented — King visited India in 1959 and called Gandhi\'s philosophy "the only morally and practically sound method open to oppressed people."',
      accentIcon: 'Globe',
    },
    {
      title: 'Summary',
      layout: 'two-column',
      subtitle: 'Key takeaways',
      body: 'The Indian freedom movement spanned nearly a century, from the 1857 revolt to independence in 1947. It combined armed and non-violent resistance, was led by the Indian National Congress and many other groups, and was transformed into a mass movement by Mahatma Gandhi. Independence came with the tragic cost of partition.',
      bullets: [
        bl('Spanned ~90 years (1857-1947)'),
        bl('Combined armed and non-violent methods'),
        bl('Gandhi transformed it into a mass movement'),
        bl('Independence on 15 August 1947'),
        bl('Partition created India and Pakistan at great human cost'),
      ],
      notes: 'Recap the timeline and the key figures. Remind the audience that the movement combined many streams — constitutional, non-violent, and revolutionary. Invite questions.',
      accentIcon: 'CheckCircle2',
    },
    {
      title: 'Thank You',
      layout: 'thank-you',
      subtitle: 'Questions, comments, and discussion welcome.',
      body: 'The Indian Freedom Movement',
      notes: 'Close confidently. Thank the audience. Restate the key takeaway: the Indian freedom movement is a testament to the power of mass non-violent resistance. Open the floor for questions.',
      accentIcon: 'Heart',
    },
  ],
});

// ── Lookup function ───────────────────────────────────────────────────────────

/**
 * Find the best matching topic entry for a given prompt.
 * Returns null if no specific entry matches.
 */
export function findTopicEntry(prompt: string): TopicEntry | null {
  const lower = prompt.toLowerCase().trim();

  // Try exact key match first
  for (const e of ENTRIES) {
    for (const key of e.keys) {
      if (lower === key) return e;
    }
  }

  // Try "contains" match — but only for keys with at least 3 significant words
  // to avoid false positives (e.g., "ai" matching everything)
  for (const e of ENTRIES) {
    for (const key of e.keys) {
      if (key.length >= 4 && lower.includes(key)) return e;
    }
  }

  // Try word overlap — require at least 2 overlapping significant words
  const promptWords = lower.split(/\s+/).filter((w) => w.length > 2);
  for (const e of ENTRIES) {
    for (const key of e.keys) {
      const keyWords = key.split(/\s+/).filter((w) => w.length > 2);
      if (keyWords.length === 0) continue;
      const overlap = keyWords.filter((kw) => promptWords.includes(kw));
      if (overlap.length >= 2 && overlap.length >= Math.ceil(keyWords.length * 0.6)) {
        return e;
      }
    }
  }

  return null;
}

/**
 * Detect the category of a topic from the prompt, for fallback generation.
 */
export function detectCategory(prompt: string): TopicCategory {
  const lower = prompt.toLowerCase();

  const programmingIndicators = [
    'c programming', 'c++', 'java', 'python', 'javascript', 'programming',
    'operator', 'pointer', 'function', 'array', 'loop', 'variable', 'class',
    'object', 'inheritance', 'polymorphism', 'recursion', 'sorting', 'data structure',
    'algorithm', 'compiler', 'syntax', 'code', 'debugging',
  ];
  const csIndicators = [
    'operating system', 'database', 'networking', 'computer network', 'data structure',
    'algorithm', 'software engineering', 'compiler', 'computer architecture',
    'microprocessor', 'cyber security', 'cryptography',
  ];
  const aiIndicators = [
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
    'natural language processing', 'computer vision', 'data mining', 'ai',
  ];
  const cloudIndicators = [
    'cloud computing', 'aws', 'azure', 'docker', 'kubernetes', 'devops',
    'microservices', 'containerization', 'virtualization',
  ];
  const scienceIndicators = [
    'physics', 'chemistry', 'biology', 'solar system', 'atom', 'molecule',
    'energy', 'force', 'motion', 'electricity', 'magnetism', 'thermodynamics',
    'photosynthesis', 'ecosystem', 'evolution', 'genetics', 'cell',
  ];
  const biologyIndicators = [
    'human body', 'digestive system', 'respiratory system', 'nervous system',
    'circulatory system', 'heart', 'brain', 'kidney', 'liver', 'cell',
    'photosynthesis', 'ecosystem', 'evolution', 'genetics', 'dna',
  ];
  const historyIndicators = [
    'history', 'freedom movement', 'independence', 'revolution', 'war',
    'civilization', 'empire', 'dynasty', 'ancient', 'medieval', 'modern history',
  ];
  const businessIndicators = [
    'business', 'marketing', 'finance', 'startup', 'entrepreneurship',
    'accounting', 'economics', 'management', 'strategy', 'investment',
    'supply chain', 'hr', 'human resource',
  ];
  const mathIndicators = [
    'mathematics', 'algebra', 'geometry', 'calculus', 'trigonometry',
    'statistics', 'probability', 'matrix', 'differential', 'integration',
  ];

  if (programmingIndicators.some((i) => lower.includes(i))) return 'programming';
  if (aiIndicators.some((i) => lower.includes(i))) return 'ai';
  if (cloudIndicators.some((i) => lower.includes(i))) return 'cloud';
  if (csIndicators.some((i) => lower.includes(i))) return 'cs';
  if (biologyIndicators.some((i) => lower.includes(i))) return 'biology';
  if (scienceIndicators.some((i) => lower.includes(i))) return 'science';
  if (historyIndicators.some((i) => lower.includes(i))) return 'history';
  if (businessIndicators.some((i) => lower.includes(i))) return 'business';
  if (mathIndicators.some((i) => lower.includes(i))) return 'math';

  return 'general';
}
