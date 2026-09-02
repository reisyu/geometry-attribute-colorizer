#!/usr/bin/env node
/*
 * index.html から純粋関数を抽出して tests/extracted.js を生成する。
 *
 * テストは「実際のアプリコード」に対して行う必要があるため、
 * index.html の <script> から対象関数をそのまま切り出して
 * Node.js から require できる形にする。
 *
 * 使い方:  node extract_for_tests.js
 * （index.html を編集して計算ロジックを変えたら必ず実行する）
 */
"use strict";
const fs = require("fs");
const path = require("path");

// 抽出対象の関数（テストが参照するもの）
const FUNCS = [
  "normalizeId",
  "ocsToWcs",
  "parseDXF",
  "newellNormal",
  "convexHull2D",
  "minAreaRect2D",
  "computeContourAttributes",
  "hsvToRgb",
  "hexToRgb01",
  "lerpColor",
  "numericToColor",
  "isNumericColumn",
  "symmetricAngleColor",
  "csvEscape",
  "formatValue",
  "labelText",
  "categoryColorByIndex",
  "solveFitDistance",
  "solveFitOrtho",
  "flipTriangleWinding",
  "parseGLB",
  "crc32",
  "deflateRaw",
  "buildZip",
  "contourToSegments",
  "thickLineAttributes",
];

// 抽出対象の定数
const CONSTS = ["PALETTE", "NOTE_COL", "NOTE_LABEL_MAX"];

const root = __dirname;
const htmlPath = path.join(root, "index.html");
const outPath = path.join(root, "tests", "extracted.js");

const html = fs.readFileSync(htmlPath, "utf8");

// 最も長い <script> ブロック = メインスクリプト
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length === 0) {
  console.error("index.html に <script> が見つかりません");
  process.exit(1);
}
const src = scripts.reduce((a, b) => (a.length >= b.length ? a : b));

/* 波括弧の対応を数えて関数定義を丸ごと切り出す */
function extractFunction(name) {
  const key = `function ${name}(`;
  let start = src.indexOf(key);
  if (start < 0) throw new Error(`関数が見つかりません: ${name}`);
  // async 修飾子があれば含める
  if (src.slice(Math.max(0, start - 6), start).trim() === "async") {
    start = src.lastIndexOf("async", start);
  }
  let depth = 0;
  const open = src.indexOf("{", start);
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`関数の終端が見つかりません: ${name}`);
}

/* 定数を切り出す。配列 (const NAME = [ ... ];) と、1行で書かれた
   スカラー (const NAME = "x";) の両方に対応する */
function extractConst(name) {
  const arrStart = src.indexOf(`const ${name} = [`);
  if (arrStart >= 0) {
    const end = src.indexOf("];", arrStart);
    return src.slice(arrStart, end + 2);
  }
  const m = src.match(new RegExp(`^const ${name} = [^\\n;]+;`, "m"));
  if (!m) throw new Error(`定数が見つかりません: ${name}`);
  return m[0];
}

const parts = [
  "/* このファイルは extract_for_tests.js が index.html から自動生成します。",
  "   直接編集しないでください。 */",
  "",
  // parseDXF がブラウザのフレーム待ちを使うため、テスト用のスタブを置く
  "function nextFrame(){ return Promise.resolve(); }",
];

// HUE_RANGES は numericToColor が参照する定数
const hue = src.match(/const HUE_RANGES = [\s\S]*?;/);
if (hue) parts.push(hue[0]);

// CRC32_TABLE は crc32 が参照する(即時実行で作るため、配列形式の抽出では拾えない)
const crcStart = src.indexOf("const CRC32_TABLE =");
if (crcStart >= 0) {
  const crcEnd = src.indexOf("})();", crcStart);
  parts.push(src.slice(crcStart, crcEnd + 5));
}

for (const c of CONSTS) parts.push(extractConst(c));
for (const f of FUNCS) parts.push(extractFunction(f));

parts.push(`module.exports = { ${[...CONSTS, ...FUNCS].join(", ")} };`);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, parts.join("\n\n") + "\n");

console.log(`tests/extracted.js を生成しました（関数 ${FUNCS.length}件 / 定数 ${CONSTS.length}件）`);
console.log("続けてテストを実行してください:  cd tests && node test_suite.js");
