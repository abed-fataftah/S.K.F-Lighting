import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 0027 AC-10: an unexpected failure goes through `reportError` (src/server/monitoring/), which
// writes the log line and sends it to Sentry. Anywhere else in src/, `console.error` would log a
// failure Sentry never hears about. Client code reports with `Sentry.captureException`.

const srcDir = join(process.cwd(), "src");
const ALLOWED_DIR = "server/monitoring/";
const CONSOLE_ERROR = /console\.error\s*\(/;

function sourceFiles(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const toPosix = (path: string) => path.split(sep).join("/");

describe("monitoring rules", () => {
  it("catches a planted console.error", () => {
    expect(CONSOLE_ERROR.test(`console.err` + `or("x")`)).toBe(true);
    expect(CONSOLE_ERROR.test(`console.err` + `or ("x")`)).toBe(true);
    expect(CONSOLE_ERROR.test(`console.info("x")`)).toBe(false);
  });

  it("finds no console.error outside src/server/monitoring/", () => {
    const files = sourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(10);
    const found = files
      .map((file) => toPosix(relative(srcDir, file)))
      .filter((path) => !path.startsWith(ALLOWED_DIR))
      .filter((path) => CONSOLE_ERROR.test(readFileSync(join(srcDir, path), "utf8")));
    expect(found).toEqual([]);
  });
});
