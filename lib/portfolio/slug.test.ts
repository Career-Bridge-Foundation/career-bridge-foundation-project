/**
 * Hand-rolled tests for slugifyName.
 * Run with: npx tsx lib/portfolio/slug.test.ts
 *
 * Exits with code 1 if any test fails, 0 if all pass.
 * No test runner — keeps dependencies minimal for MVP.
 */

import { slugifyName } from './slug';

interface TestCase {
  name: string;
  input: string;
  expected: string;
}

const cases: TestCase[] = [
  // Spec examples
  { name: 'simple name', input: 'Jane Doe', expected: 'jane-doe' },
  { name: 'apostrophe stripped without hyphen', input: "O'Connor", expected: 'oconnor' },
  { name: 'accented chars transliterated', input: 'José García', expected: 'jose-garcia' },

  // Whitespace and underscore handling
  { name: 'multiple spaces collapse to single hyphen', input: 'Jane    Doe', expected: 'jane-doe' },
  { name: 'underscores become hyphens', input: 'jane_doe_smith', expected: 'jane-doe-smith' },
  { name: 'mixed underscores and spaces', input: 'jane_doe smith', expected: 'jane-doe-smith' },
  { name: 'leading/trailing whitespace trimmed', input: '  Jane Doe  ', expected: 'jane-doe' },

  // Punctuation
  { name: 'curly quotes stripped', input: 'Jane ‘Janie’ Doe', expected: 'jane-janie-doe' },
  { name: 'punctuation stripped', input: 'Jane Doe, PhD!', expected: 'jane-doe-phd' },
  { name: 'hyphenated names preserved', input: 'Mary-Anne Smith', expected: 'mary-anne-smith' },
  { name: 'consecutive hyphens collapsed', input: 'Jane--Doe', expected: 'jane-doe' },

  // Accents — common European
  { name: 'umlaut', input: 'Müller', expected: 'muller' },
  { name: 'cedilla', input: 'François', expected: 'francois' },
  { name: 'acute and grave', input: 'André Bélanger', expected: 'andre-belanger' },
  { name: 'tilde', input: 'João', expected: 'joao' },

  // Edge cases
  { name: 'empty string', input: '', expected: '' },
  { name: 'whitespace only', input: '   ', expected: '' },
  { name: 'punctuation only', input: '!!!', expected: '' },
  { name: 'all-CJK falls through to empty', input: '田中太郎', expected: '' },
  { name: 'mixed CJK and Latin keeps Latin', input: 'Tanaka 田中', expected: 'tanaka' },

  // Length truncation (45 char base limit)
  {
    name: 'long name truncated to 45 chars',
    input: 'Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa Bbbb',
    expected: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // 45 a's
  },
  {
    name: 'truncation respects hyphen boundary if it lands on one',
    input: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbb', // hyphen at pos 45
    expected: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // trailing hyphen trimmed
  },

  // Numbers
  { name: 'numbers preserved', input: 'Jane Doe 2', expected: 'jane-doe-2' },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const tc of cases) {
  const actual = slugifyName(tc.input);
  if (actual === tc.expected) {
    passed++;
    console.log(`✓ ${tc.name}`);
  } else {
    failed++;
    const msg = `✗ ${tc.name}\n    input:    ${JSON.stringify(tc.input)}\n    expected: ${JSON.stringify(tc.expected)}\n    actual:   ${JSON.stringify(actual)}`;
    failures.push(msg);
    console.error(msg);
  }
}

console.log(`\n${passed}/${passed + failed} passed`);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}

process.exit(0);
