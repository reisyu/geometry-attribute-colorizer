#!/usr/bin/env node
/*
 * 表示の言語(English)のテスト。
 *
 * 守ること:
 *   - 本体に日本語の文言を足したら、対応表にも足す(訳し忘れ)
 *   - 操作の案内は、全部の手が英語で出る
 *   - 利用者が付けた名前は訳さない。データの定数は日本語のまま
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) pass++;
  else { fail++; console.log("NG: " + msg); }
}

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/\r\n/g, "\n");
const mod = html.match(/<script id="i18n">([\s\S]*?)<\/script>/);
ok(!!mod, "<script id=\"i18n\"> がある");
const box = vm.createContext({});
vm.runInContext(mod[1] + "\nthis.I18N = I18N; this.TABLE = I18N_EN;", box);
const { I18N, TABLE } = box;
const en = (s) => I18N.translate(s);
const JA = /[぀-ヿ㐀-鿿]/;

/* ---------- 対応表そのもの ---------- */
const rows = TABLE.trim().split("\n").map((l) => [l.slice(0, l.indexOf("|")), l.slice(l.indexOf("|") + 1)]);
for (const [ja, e] of rows) {
  ok(!JA.test(e), "英語の側に日本語が残っていない: " + ja);
  const holes = (ja.match(/\{[=#]?\}/g) || []).length;
  const refs = [...e.matchAll(/\$(\d)|\{(\d)\|/g)].map((m) => Number(m[1] || m[2]));
  ok(refs.every((n) => n >= 1 && n <= holes), "English の $n が日本語の穴の数に収まる: " + ja);
}

/* ---------- 訳し忘れ ---------- */
const main = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).sort((a, b) => b.length - a.length)[0];
const code = main.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  .replace(/([;{}),\]\s])\/\/[ \t].*$/gm, "$1");
const keys = rows.map((r) => r[0]).join("\n");
/* 画面に出ない文言(データ・ファイル名) */
const NOT_SHOWN = ["台帳.csv", "作業データ.zip", "調査者", "(項目)"];
const missing = new Set();
for (const m of code.matchAll(/"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`((?:\\.|[^`\\])*)`/g)) {
  const s = (m[1] || m[2] || m[3] || "").replace(/\$\{[^}]*\}/g, "\u0001").replace(/<[^>]*>/g, "\u0001");
  if (NOT_SHOWN.includes(s)) continue;
  for (const piece of s.split(/\u0001|\\n/)) {
    for (const run of piece.match(/[぀-ヿ㐀-鿿]+/g) || []) {
      if (!keys.includes(run)) missing.add(run + "  ← " + s.slice(0, 60));
    }
  }
}
for (const x of missing) ok(false, "対応表に無い文言: " + x);
ok(missing.size === 0, "本体の日本語の文言は、どれも対応表にある");

const body = html.slice(html.indexOf("<body>"), html.indexOf("<script>", html.indexOf("<body>")))
  .replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
for (const m of body.matchAll(/>([^<]+)|\s(?:title|placeholder|aria-label|alt)="([^"]*)"/g)) {
  const s = (m[1] || m[2] || "").trim();
  if (!JA.test(s) || s === "日本語") continue;
  ok(!JA.test(en(s)), "画面の初めの文言が英語になる: " + s.slice(0, 50));
}

/* ---------- 操作の案内 ---------- */
const cut = (from, to) => main.slice(main.indexOf(from), main.indexOf(to, main.indexOf(from)));
const tours = vm.createContext({});
vm.runInContext(cut("const TOUR_STEPS = [", "const COLUMN_TOUR_STEPS") + "\nthis.a = TOUR_STEPS;", tours);
for (const name of ["COLUMN_TOUR_STEPS", "SURVEY_TOUR_STEPS"]) {
  const src = main.slice(main.indexOf("const " + name + " = ["));
  vm.runInContext(src.slice(0, src.indexOf("\n];") + 3) + "\nthis." + name + "_ = " + name + ";", tours);
}
const ctx = { col: "COL", value: "V", value2: "W" };
let steps = 0;
for (const list of [tours.a, tours.COLUMN_TOUR_STEPS_, tours.SURVEY_TOUR_STEPS_]) {
  for (const st of list) {
    steps++;
    for (const k of ["text", "textPhone", "hint"]) {
      if (!st[k]) continue;
      const s = typeof st[k] === "function" ? st[k](ctx) : st[k];
      ok(!JA.test(en(s)), "案内が英語になる: " + s.slice(0, 50));
    }
  }
}
ok(steps >= 25, "案内3本の手を全部見た");

/* ---------- 継ぎ足しで作る文 ---------- */
const same = (ja, e) => ok(en(ja) === e, ja + " → " + en(ja) + " (期待: " + e + ")");
same("Area(面積)  n=123", "Area  n=123");
same("前回:メモ", "Previous: Note");
same("履歴:記録の状況", "History: Record status");
same("前回のみ (4)", "Previous only (4)");
same("その他 3種 (12)", "Other: 3 kinds (12)");
same("1個にメモを書きました。\n作業データをZIPで保存しないと残りません。",
     "Note written to 1 stone.\nSave the project data as ZIP to keep it.");
same("作業データを開きました: 123 オブジェクト\n記録 5 行 / 2 ファイル",
     "Project data opened: 123 objects\nRecords: 5 rows / 2 files");
same("12行 / 属性2列", "12 rows / 2 attribute columns");
same("点検項目まとめ: ", "Inspection summary: ");

/* ---------- 利用者の名前は訳さない ---------- */
same("石種", "石種");
same("花崗岩", "花崗岩");
same("幅", "幅");
same("属性の列「石種」を作りました。", "Created attribute column \"石種\".");
same("本丸東面_2026", "本丸東面_2026");

/* ---------- データは日本語のまま ---------- */
for (const def of ['const NOTE_YES = "あり"', 'const HIT_COL = "点検項目まとめ"', 'const HIT_MULTI = "複数"',
                   'const REF_PREFIX = "前回:"', 'const SURVEYOR_COL = "点検者"', 'ZIP_LEDGER = "台帳.csv"']) {
  ok(main.includes(def), "データの定数は日本語のまま: " + def);
}
ok(!/(_COL|_PREFIX|NOTE_YES|HIT_MULTI)\s*=\s*I18N/.test(main), "列名・値に訳した文字を入れていない");

/* ---------- 最初に出す言語 ---------- */
ok(I18N.pickLang(null, null, "ja-JP") === "ja", "日本語のブラウザは日本語");
ok(I18N.pickLang(null, null, "fr-FR") === "en", "日本語以外のブラウザは英語");
ok(I18N.pickLang(null, "ja", "en-US") === "ja", "選んだ言語はブラウザの言語より優先");
ok(I18N.pickLang("en", "ja", "ja") === "en", "URLの ?lang= が最優先");
ok(I18N.pickLang(null, null, "") === "ja", "分からなければ日本語");

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
