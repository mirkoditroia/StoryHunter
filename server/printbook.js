import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roman(number) {
  const map = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = Number(number) || 0;
  let out = "";
  for (const [value, glyph] of map) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out || String(number);
}

function prose(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${esc(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function findBrowser() {
  const local = process.env.LOCALAPPDATA || "";
  const candidates = [
    process.env.STORYHUNTER_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(local, "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((file) => existsSync(file)) || "";
}

export function pdfFilename(book) {
  const title = String(book.closing?.book_title || "Storyhunter")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
  return `${title || "Storyhunter"}.pdf`;
}

export function bookDocument(book) {
  const closing = book.closing || {};
  const name = book.book_config?.protagonist?.name || "";
  const chapters = (book.days || [])
    .map(
      (entry) => `
      <section class="chapter">
        <p class="index">Capitolo ${roman(entry.day)}</p>
        <h2>${esc(entry.chapter?.chapter_title || "")}</h2>
        ${
          entry.chapter?.chapter_subtitle
            ? `<p class="subtitle">${esc(entry.chapter.chapter_subtitle)}</p>`
            : ""
        }
        <div class="prose">${prose(entry.chapter?.chapter_text)}</div>
      </section>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <title>${esc(closing.book_title || "Storyhunter")}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,560;0,9..144,640;1,9..144,560&amp;display=swap" rel="stylesheet" />
    <style>
      @page { size: A4; margin: 18mm 17mm 18mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; background: white; color: #1e1412; }
      body { font-family: Fraunces, Palatino, "Palatino Linotype", serif; font-size: 12.5pt; line-height: 1.5; }
      .cover { min-height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; break-after: page; }
      h1 { margin: 0; font-size: 36pt; font-weight: 640; letter-spacing: -0.04em; line-height: 0.98; max-width: 14ch; }
      .cover .subtitle { margin: 8mm 0 0; max-width: 28ch; color: #6e625c; font-size: 14pt; }
      .epigraph { margin: 10mm 0 0; max-width: 34ch; font-style: italic; color: #3d2c28; }
      .by { margin: 16mm 0 0; letter-spacing: 0.22em; text-transform: uppercase; font-size: 9pt; color: #8a5348; }
      .chapter { break-before: page; }
      .index { margin: 0 0 4mm; letter-spacing: 0.22em; text-transform: uppercase; font-size: 8.5pt; color: #8a5348; }
      h2 { margin: 0 0 3mm; font-size: 24pt; font-weight: 640; letter-spacing: -0.03em; line-height: 1.05; }
      .subtitle { margin: 0 0 7mm; font-style: italic; color: #6e625c; }
      .prose p { margin: 0 0 4.2mm; }
      .prose p:first-of-type::first-letter { float: left; font-size: 3em; line-height: 0.8; padding: 0.06em 0.12em 0 0; }
      .back { break-before: page; }
      .back .index { margin-bottom: 8mm; }
    </style>
  </head>
  <body>
    <section class="cover">
      <h1>${esc(closing.book_title || "")}</h1>
      ${closing.subtitle ? `<p class="subtitle">${esc(closing.subtitle)}</p>` : ""}
      ${closing.epigraph ? `<p class="epigraph">${esc(closing.epigraph)}</p>` : ""}
      <p class="by">${esc(name)}</p>
    </section>
    ${chapters}
    <section class="back">
      <p class="index">Quarta di copertina</p>
      <div class="prose">${prose(closing.back_cover)}</div>
    </section>
  </body>
</html>`;
}

export async function renderBookPdf(pageUrl) {
  const browser = findBrowser();
  if (!browser) {
    const error = new Error("Per il PDF serve Chrome o Edge su questo computer.");
    error.status = 500;
    throw error;
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "storyhunter-"));
  const file = path.join(dir, "libro.pdf");
  try {
    await execFileAsync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--no-pdf-header-footer",
        "--hide-scrollbars",
        "--virtual-time-budget=8000",
        `--user-data-dir=${path.join(dir, "profile")}`,
        `--print-to-pdf=${file}`,
        pageUrl,
      ],
      { timeout: 45000, windowsHide: true }
    );
    return await fs.readFile(file);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
