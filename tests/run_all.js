#!/usr/bin/env node
/*
 * すべてのテストをまとめて実行する。
 *
 * 使い方:  node tests/run_all.js
 *
 * 冒頭で extract_for_tests.js を必ず実行し、index.html から
 * テスト対象の関数を抽出し直してから走らせる。
 * 以前は再生成を手動に任せていたため、index.html を壊しても
 * 古い extracted.js に対してテストが全て成功してしまう状態だった
 * (normalizeId を常に "BROKEN" を返すよう改変しても94件全て成功した)。
 * 自動化は必ず維持すること。
 */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path");

// --- テスト対象を index.html から抽出し直す(古いコードを検証しないため) ---
try {
  execFileSync("node", [path.join(__dirname, "..", "extract_for_tests.js")], { encoding: "utf8" });
} catch (e) {
  console.error("extracted.js の生成に失敗しました。index.html を確認してください。");
  console.error((e.stdout || "") + (e.stderr || ""));
  process.exit(1);
}

const TESTS = [
  ["test_version.js", "バージョン表記の一致"],
  ["test_suite.js", "幾何計算・色計算"],
  ["test_rectline.js", "傾きライン"],
  ["test_palette.js", "カテゴリ色パレット"],
  ["test_fitview.js", "全体表示のフィット"],
  ["test_winding.js", "GLB法線の巻き順"],
  ["test_adversarial.js", "異常入力への耐性"],
  ["test_badinput.js", "壊れた入力とメッセージ"],
  ["test_rhino_dxf.js", "Rhino形式DXF"],
  ["test_lwpolyline.js", "LWPOLYLINE形式DXF"],
  ["test_aspect.js", "アスペクト比"],
  ["test_zip.js", "ZIP書き出し"],
  ["test_thickline.js", "選択の輪郭線(太線)"],
  ["test_selection.js", "ブラシ選択の当たり判定"],
  ["test_classify.js", "分類の列(手入力)"],
  ["integration_test.js", "実データ統合"],
];

let failed = 0;
for (const [file, label] of TESTS) {
  process.stdout.write(`${label.padEnd(20, "　")} `);
  try {
    const out = execFileSync("node", [path.join(__dirname, file)], { encoding: "utf8" });
    const summary = out.trim().split("\n").filter((l) => l.includes("=====")).pop() || "完了";
    console.log(summary.replace(/=/g, "").trim());
  } catch (e) {
    failed++;
    console.log("失敗");
    // 失敗の詳細を表示する
    const out = (e.stdout || "") + (e.stderr || "");
    out.trim().split("\n").filter((l) => l.includes("NG") || l.includes("Error")).forEach((l) => {
      console.log(`    ${l.trim()}`);
    });
  }
}

console.log();
if (failed === 0) {
  console.log("すべてのテストが成功しました。");
} else {
  console.log(`${failed} 個のテストファイルが失敗しました。`);
  process.exit(1);
}
