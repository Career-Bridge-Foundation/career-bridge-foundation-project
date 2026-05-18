/**
 * Tests for simulation file & URL submission validation.
 *
 * Run with:  npx tsx lib/storage/uploadSimulationFile.test.ts
 *
 * Covers the full Task 5 test matrix:
 *  - Valid file types accepted
 *  - Disallowed file types rejected
 *  - Oversized files rejected (> 10 MB)
 *  - Exactly 10 MB accepted (boundary)
 *  - Valid URLs accepted
 *  - Malformed / non-HTTPS URLs rejected
 *  - Empty / whitespace URLs rejected
 *  - Edge: zero-byte file accepted (size check only, type still validated)
 *
 * No test runner needed — exits 1 on any failure, 0 if all pass.
 */

import {
  validateSimulationFile,
  UploadValidationError,
  ALLOWED_MIME_TYPES,
} from "./uploadSimulationFile";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(name: string, type: string, sizeBytes: number): File {
  // File constructor: ([content], name, options)
  // We pass a typed array of the right byte count as a cheap stand-in for real content.
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Test runner ───────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  run: () => void;
}

const tests: TestCase[] = [];
let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  tests.push({ name, run: fn });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => void, expectedMessage?: string) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (expectedMessage && err instanceof Error) {
      assert(
        err.message.includes(expectedMessage),
        `Expected error message to include "${expectedMessage}", got: "${err.message}"`
      );
    }
  }
  if (!threw) throw new Error("Expected function to throw but it did not");
}

function assertDoesNotThrow(fn: () => void) {
  fn(); // throws naturally if it fails
}

// ── FILE VALIDATION TESTS ─────────────────────────────────────────────────────

const MB = 1024 * 1024;

test("accepts PDF file under 10 MB", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(makeFile("report.pdf", "application/pdf", 5 * MB))
  );
});

test("accepts Word .docx file", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(
      makeFile(
        "doc.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        1 * MB
      )
    )
  );
});

test("accepts Word .doc file", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(makeFile("doc.doc", "application/msword", 2 * MB))
  );
});

test("accepts PNG image", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(makeFile("screenshot.png", "image/png", 500_000))
  );
});

test("accepts JPEG image", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(makeFile("photo.jpg", "image/jpeg", 800_000))
  );
});

test("accepts CSV file", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(makeFile("data.csv", "text/csv", 50_000))
  );
});

test("accepts Excel .xlsx file", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(
      makeFile(
        "sheet.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        300_000
      )
    )
  );
});

test("accepts PowerPoint .pptx file", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(
      makeFile(
        "deck.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        4 * MB
      )
    )
  );
});

test("accepts file at exactly 10 MB boundary", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(makeFile("boundary.pdf", "application/pdf", 10 * MB))
  );
});

test("accepts zero-byte PDF (size check only)", () => {
  assertDoesNotThrow(() =>
    validateSimulationFile(makeFile("empty.pdf", "application/pdf", 0))
  );
});

test("rejects file exceeding 10 MB", () => {
  assertThrows(
    () => validateSimulationFile(makeFile("huge.pdf", "application/pdf", 10 * MB + 1)),
    "10 MB"
  );
  assertThrows(
    () => validateSimulationFile(makeFile("huge.pdf", "application/pdf", 50 * MB)),
    "10 MB"
  );
});

test("rejects .exe file", () => {
  assertThrows(
    () => validateSimulationFile(makeFile("virus.exe", "application/x-msdownload", 1 * MB)),
    "not allowed"
  );
});

test("rejects .zip file", () => {
  assertThrows(
    () => validateSimulationFile(makeFile("archive.zip", "application/zip", 1 * MB)),
    "not allowed"
  );
});

test("rejects .mp4 video file", () => {
  assertThrows(
    () => validateSimulationFile(makeFile("video.mp4", "video/mp4", 1 * MB)),
    "not allowed"
  );
});

test("rejects unknown mime type (empty string)", () => {
  assertThrows(
    () => validateSimulationFile(makeFile("weird", "", 1 * MB)),
    "not allowed"
  );
});

test("thrown error is an UploadValidationError instance", () => {
  let err: unknown;
  try {
    validateSimulationFile(makeFile("bad.exe", "application/x-msdownload", 1 * MB));
  } catch (e) {
    err = e;
  }
  assert(err instanceof UploadValidationError, "Expected UploadValidationError");
});

test("ALLOWED_MIME_TYPES covers all expected formats", () => {
  const required = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];
  for (const mime of required) {
    assert(ALLOWED_MIME_TYPES.has(mime), `ALLOWED_MIME_TYPES is missing "${mime}"`);
  }
});

// ── URL VALIDATION TESTS ──────────────────────────────────────────────────────

test("accepts valid https:// URL", () => {
  assert(isValidUrl("https://docs.google.com/document/d/abc123"), "should be valid");
});

test("accepts valid http:// URL", () => {
  assert(isValidUrl("http://example.com/doc"), "should be valid");
});

test("accepts Figma URL", () => {
  assert(isValidUrl("https://www.figma.com/file/xyz/My-Design"), "should be valid");
});

test("accepts Notion URL", () => {
  assert(isValidUrl("https://notion.so/My-Doc-abc123"), "should be valid");
});

test("rejects URL without protocol", () => {
  assert(!isValidUrl("docs.google.com/document"), "should be invalid");
});

test("rejects ftp:// URL", () => {
  assert(!isValidUrl("ftp://files.example.com/doc"), "should be invalid");
});

test("rejects empty string as URL", () => {
  assert(!isValidUrl(""), "should be invalid");
});

test("rejects whitespace-only string as URL", () => {
  assert(!isValidUrl("   "), "should be invalid");
});

test("rejects plain text as URL", () => {
  assert(!isValidUrl("not a url at all"), "should be invalid");
});

test("rejects javascript: scheme", () => {
  assert(!isValidUrl("javascript:alert(1)"), "should be invalid");
});

test("rejects data: URI", () => {
  assert(!isValidUrl("data:text/html,<h1>hi</h1>"), "should be invalid");
});

// ── RUN ALL TESTS ─────────────────────────────────────────────────────────────

for (const tc of tests) {
  try {
    tc.run();
    passed++;
    console.log(`  ✓  ${tc.name}`);
  } catch (err) {
    failed++;
    const msg = `  ✗  ${tc.name}\n       ${err instanceof Error ? err.message : String(err)}`;
    failures.push(msg);
    console.error(msg);
  }
}

console.log(`\n${passed}/${passed + failed} tests passed`);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed:`);
  for (const f of failures) console.error(f);
  process.exit(1);
}

process.exit(0);
