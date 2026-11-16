// Turns Stryker's JSON report into the markdown posted to the run summary and the weekly issue.
// Usage: node scripts/mutation-summary.mjs <mutation.json> [run-url]
import {readFileSync} from "node:fs";

const MAX_FILE_ROWS = 40;
const MAX_MUTANTS_PER_FILE = 5;
// GitHub rejects issue bodies over 65,536 characters; leave room for the footer.
const MAX_BODY_CHARS = 60_000;

const DETECTED = new Set(["Killed", "Timeout"]);
const UNDETECTED = new Set(["Survived", "NoCoverage"]);

function scoreFile([path, file]) {
  const detected = file.mutants.filter((m) => DETECTED.has(m.status)).length;
  const undetected = file.mutants.filter((m) => UNDETECTED.has(m.status));
  const valid = detected + undetected.length;
  return {path, detected, undetected, valid, score: valid === 0 ? 100 : (detected / valid) * 100};
}

function percent(detected, valid) {
  return valid === 0 ? "n/a" : `${((detected / valid) * 100).toFixed(2)}%`;
}

function fileTable(weakFiles) {
  const rows = weakFiles.slice(0, MAX_FILE_ROWS).map((f) => `| \`${f.path}\` | ${f.score.toFixed(2)}% | ${f.undetected.length} |`);
  const hidden = weakFiles.length - rows.length;
  return [
    "| File | Score | Undetected mutants |",
    "|---|---|---|",
    ...rows,
    ...(hidden > 0 ? [`\n…and ${hidden} more files in the HTML report.`] : []),
  ].join("\n");
}

function mutantList(file) {
  const items = file.undetected.slice(0, MAX_MUTANTS_PER_FILE).map((m) => {
    const {line, column} = m.location.start;
    const replacement = (m.replacement ?? "").replaceAll("`", "'").replaceAll("\n", " ").slice(0, 80);
    const reason = m.status === "NoCoverage" ? "no test runs this line" : "tests still pass";
    return `- L${line}:${column} ${m.mutatorName} → \`${replacement}\` (${reason})`;
  });
  return [`#### \`${file.path}\``, ...items].join("\n");
}

const [reportPath, runUrl] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const files = Object.entries(report.files).map(scoreFile);
const detected = files.reduce((sum, f) => sum + f.detected, 0);
const valid = files.reduce((sum, f) => sum + f.valid, 0);
const weakFiles = files.filter((f) => f.undetected.length > 0).toSorted((a, b) => a.score - b.score);

const sections = [
  `**Mutation score: ${percent(detected, valid)}** (${detected} of ${valid} mutants detected, ${files.length} files). Thresholds: high ${report.thresholds.high}%, low ${report.thresholds.low}%.`,
  weakFiles.length === 0 ? "Every mutant was detected." : `### Files with undetected mutants, weakest first\n\n${fileTable(weakFiles)}`,
  weakFiles.length === 0
    ? ""
    : `### Undetected mutants\n\nAdd an assertion that fails for each change below, or delete the code if no test needs it.\n\n${weakFiles.map(mutantList).join("\n\n")}`,
];
const footer = runUrl ? `\n\nFull HTML report: the \`mutation-report\` artifact on ${runUrl}` : "";

let body = sections.filter(Boolean).join("\n\n");
if (body.length > MAX_BODY_CHARS) {
  body = `${body.slice(0, MAX_BODY_CHARS)}\n\n…truncated; see the HTML report.`;
}
process.stdout.write(`${body}${footer}\n`);
