"use strict";
/*
 * バージョン表記の一致検証。
 *
 * バージョンは以下の4箇所に重複して書かれている:
 *   index.html       APP_VERSION      (画面表示・SVG出力の刻印に使われる)
 *   help.html        HELP_VERSION     (操作ガイドの見出し・フッター)
 *   SPECIFICATION.md 対象バージョン
 *   CHANGELOG.md     最新の見出し
 *
 * 1箇所にまとめたいところだが、「index.html 1つで完結」(SPECIFICATION §2)を
 * 崩さないため、共通ファイル化もビルド導入もしない。
 * 代わりにここで一致を機械的に検証する。
 *
 * 実際にv1.1.0のとき仕様書だけ1.0.0のまま取り残された事故があったため、
 * このチェックは外さないこと。
 */
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`  ${c ? "OK" : "NG!!"}: ${n}`); };

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const pick = (f, re) => { const m = read(f).match(re); return m ? m[1] : null; };

const found = {
  "index.html (APP_VERSION)": pick("index.html", /APP_VERSION\s*=\s*"([^"]+)"/),
  "help.html (HELP_VERSION)": pick("help.html", /HELP_VERSION\s*=\s*"([^"]+)"/),
  "SPECIFICATION.md (対象バージョン)": pick("SPECIFICATION.md", /対象バージョン:\s*v([0-9]+\.[0-9]+\.[0-9]+)/),
  "CHANGELOG.md (最新の見出し)": pick("CHANGELOG.md", /##\s*\[([0-9]+\.[0-9]+\.[0-9]+)\]/),
};

for (const [where, v] of Object.entries(found)) {
  ok(v !== null, `${where} からバージョンを読み取れる`);
}

const values = Object.values(found).filter((v) => v !== null);
const unique = [...new Set(values)];
if (unique.length !== 1) {
  console.log("  検出値:");
  for (const [where, v] of Object.entries(found)) console.log(`    ${String(v).padEnd(10)} ${where}`);
}
ok(unique.length === 1, `4箇所のバージョンが一致する${unique.length === 1 ? ` (${unique[0]})` : ""}`);

// セマンティックバージョニングの形式(メジャー.マイナー.パッチ)
ok(values.every((v) => /^[0-9]+\.[0-9]+\.[0-9]+$/.test(v)), "すべて メジャー.マイナー.パッチ 形式");

// CHANGELOGの見出しが新しい順に並んでいるか(古い版を上に足す事故を防ぐ)
const order = [...read("CHANGELOG.md").matchAll(/##\s*\[([0-9]+\.[0-9]+\.[0-9]+)\]/g)].map((m) => m[1]);
const cmp = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
  return 0;
};
const sorted = [...order].sort(cmp);
ok(order.length > 0, `CHANGELOGに版の見出しがある (${order.length}件)`);
ok(order.join(",") === sorted.join(","), "CHANGELOGが新しい順に並んでいる");

console.log(`\n===== ${pass}成功 / ${fail}失敗 =====`);
process.exit(fail ? 1 : 0);
