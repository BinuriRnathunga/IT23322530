const { test } = require("@playwright/test");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const URL = "https://swifttranslator.com/";
const ORIGINAL_XLSX = "IT23322530-Assignment 1.xlsx";
const EXECUTED_XLSX = "IT23322530-Assignment 1_EXECUTED.xlsx";

// pick original excel first time, then use executed excel if it exists
function excelPaths() {
  const original = path.join(__dirname, "..", "test-data", ORIGINAL_XLSX);
  const executed = path.join(__dirname, "..", "test-data", EXECUTED_XLSX);
  return { inPath: fs.existsSync(executed) ? executed : original, outPath: executed };
}

// read sheet as grid + find header row + column indexes
function loadGrid(filePath) {
  const wb = XLSX.readFile(filePath);

  // choose sheet that looks like "testcases"
  const wsName =
    wb.SheetNames.find((n) => String(n).toLowerCase().replace(/\s+/g, "").includes("testcases")) ||
    wb.SheetNames[0];

  const ws = wb.Sheets[wsName];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const headerRowIndex = grid.findIndex((row) => row.some((c) => String(c).trim() === "TC ID"));
  if (headerRowIndex < 0) throw new Error("Header row with 'TC ID' not found");

  const header = grid[headerRowIndex].map((c) => String(c).trim());

  const col = {
    tcId: header.indexOf("TC ID"),
    input: header.indexOf("Input"),
    expected: header.indexOf("Expected output"),
    actual: header.indexOf("Actual output"),
    status: header.indexOf("Status"),
  };

  if (Object.values(col).some((v) => v < 0)) {
    throw new Error("Required columns not found in header");
  }

  return { wb, wsName, grid, headerRowIndex, col };
}

// extract test rows from the grid
function getRows(grid, headerRowIndex, col) {
  const rows = [];
  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const tc = String((grid[r] || [])[col.tcId] || "").trim();
    if (!tc) continue;

    const input = String((grid[r] || [])[col.input] || "");
    const expected = String((grid[r] || [])[col.expected] || "");
    rows.push({ r, tc, input, expected });
  }
  return rows;
}

// find first visible element among selectors
async function firstVisible(page, selectors, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      const ok =
        (await loc.count().catch(() => 0)) > 0 &&
        (await loc.isVisible().catch(() => false));
      if (ok) return loc;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

// find translator input field
async function findInput(page) {
  const inputSelectors = [
    "textarea:not([readonly]):not([disabled])",
    "textarea",
    "div[contenteditable='true']",
    "div[role='textbox'][contenteditable='true']",
    "input[type='text']",
  ];
  const input = await firstVisible(page, inputSelectors, 60000);
  if (!input) throw new Error("Input element not found");
  return input;
}

// clear input and type test sentence
async function clearAndType(page, input, text) {
  await input.click().catch(() => {});
  await page.keyboard.press("Meta+A").catch(async () => {
    await page.keyboard.press("Control+A").catch(() => {});
  });
  await page.keyboard.press("Backspace").catch(() => {});
  await input.fill("").catch(() => {});
  await input.type(String(text || ""), { delay: 5 }).catch(async () => {
    await input.fill(String(text || "")).catch(() => {});
  });
}

// scan page and return the best Sinhala-looking output text
async function scanBestOutput(page, inputText) {
  return await page.evaluate((inputText) => {
    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (!style || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return !!(r && r.width >= 2 && r.height >= 2);
    };

    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
    const hasSinhala = (s) => /[\u0D80-\u0DFF]/.test(s);

    const els = Array.from(document.querySelectorAll("textarea,input,div,span,p,pre,section,article"));
    const candidates = [];

    for (const el of els) {
      if (!isVisible(el)) continue;

      let t = "";
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input") t = el.value || "";
      else t = el.innerText || "";

      t = norm(t);
      if (!t) continue;

      // skip input text itself
      if (inputText && t.includes(norm(inputText))) continue;

      const sinCount = (t.match(/[\u0D80-\u0DFF]/g) || []).length;

      // small boosts if element looks like output area
      const role = (el.getAttribute("role") || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const cls = (el.className || "").toString().toLowerCase();
      const id = (el.id || "").toLowerCase();

      let boost = 0;
      if (role === "alert") boost += 10;
      if (cls.includes("output") || cls.includes("result") || cls.includes("translate")) boost += 6;
      if (id.includes("output") || id.includes("result") || id.includes("translate")) boost += 6;
      if (aria.includes("output") || aria.includes("result") || aria.includes("translation") || aria.includes("sinhala")) boost += 6;

      const score = sinCount * 10 + boost + Math.min(40, t.length / 12);
      candidates.push({ t, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    // choose best Sinhala text
    const bestSinhala = candidates.find((c) => hasSinhala(c.t));
    if (bestSinhala) return bestSinhala.t;

    return candidates[0] ? candidates[0].t : "";
  }, String(inputText || ""));
}

// wait until output becomes stable (same value few times)
async function waitForStableOutput(page, inputText, maxMs) {
  const start = Date.now();
  let last = "";
  let stable = 0;

  while (Date.now() - start < maxMs) {
    const cur = String(await scanBestOutput(page, inputText) || "").trim();
    if (cur && cur === last) stable += 1;
    else stable = 0;
    last = cur;

    if (stable >= 4) return cur;
    await page.waitForTimeout(250);
  }

  return String(await scanBestOutput(page, inputText) || "").trim();
}

test.describe.configure({ mode: "serial" });

test.describe("IT23322530 - Assignment 1 Automation (SwiftTranslator)", () => {
  const updates = [];
  let outPath = "";

  test.beforeAll(() => {
    outPath = excelPaths().outPath;
  });

  // save updated excel after all tests
  test.afterAll(() => {
    if (!updates.length) return;
    const p = excelPaths();
    const { wb, wsName, grid } = loadGrid(p.inPath);
    wb.Sheets[wsName] = XLSX.utils.aoa_to_sheet(grid);
    XLSX.writeFile(wb, outPath);
    console.log(`Updated Excel saved: ${outPath}`);
  });

  const { inPath } = excelPaths();
  const { grid, headerRowIndex, col } = loadGrid(inPath);

  // run only Pos_Fun / Neg_Fun / Pos_UI rows
  const cases = getRows(grid, headerRowIndex, col).filter(
    (x) => x.tc.startsWith("Pos_Fun") || x.tc.startsWith("Neg_Fun") || x.tc.startsWith("Pos_UI")
  );

  for (const c of cases) {
    test(`${c.tc} | ROW_${c.r + 1}`, async ({ page }) => {
      test.setTimeout(120000);

      await page.goto(URL, { waitUntil: "domcontentloaded" });

      const input = await findInput(page);
      await clearAndType(page, input, c.input);

      const actual = await waitForStableOutput(page, c.input, 60000);

      const exp = String(c.expected || "").trim();
      const act = String(actual || "").trim();

      // Pos_UI: output should contain Sinhala
      // Others: output must equal expected to be Pass
      let status = "Fail";
      if (c.tc.startsWith("Pos_UI")) {
        status = /[\u0D80-\u0DFF]/.test(act) ? "Pass" : "Fail";
      } else {
        status = exp && act === exp ? "Pass" : "Fail";
      }

      // write back to grid
      updates.push({ r: c.r, actual, status });
      grid[c.r][col.actual] = actual;
      grid[c.r][col.status] = status;
    });
  }
});