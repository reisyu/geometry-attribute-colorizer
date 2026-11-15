"use strict";
/*
 * 操作の案内(§10.10)。
 *
 * 案内は画面の部品を名前(id など)で指す。画面を組み直して部品の名前が変わると、
 * 案内はその部品を見つけられず、吹き出しだけが画面の中央に出る。
 * 動かしてみるまで気づけないので、**指す部品がすべて本体に実在するか**をここで確かめる。
 * (この数日でもツールバーは3回組み直した)
 *
 * 文面は作者が確かめたもの(2026-11-15)。変えるときは作者に見せること。
 */
const fs = require("fs");
const path = require("path");
const { TOUR_STEPS } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const body = html.slice(html.indexOf("<body"), html.indexOf("<script>"));

ok(Array.isArray(TOUR_STEPS) && TOUR_STEPS.length === 9, "案内は9手", String(TOUR_STEPS && TOUR_STEPS.length));

/* ---------- 指す部品が本体に実在する ---------- */
for (const [i, s] of TOUR_STEPS.entries()) {
  const sel = s.target;
  const ids = [...sel.matchAll(/#([\w-]+)/g)].map((m) => m[1]);
  const steps = [...sel.matchAll(/\[data-step="([\w-]+)"\]/g)].map((m) => m[1]);
  const classes = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const missing = [];
  for (const id of ids) if (!body.includes('id="' + id + '"')) missing.push("#" + id);
  for (const st of steps) if (!body.includes('data-step="' + st + '"')) missing.push('[data-step="' + st + '"]');
  for (const c of classes) if (!new RegExp('class="[^"]*\\b' + c + '\\b').test(body)) missing.push("." + c);
  // 石垣を指す手は、描画先(canvas)がビューの中にあること
  if (/\bcanvas\b/.test(sel)) {
    const wrapAt = body.indexOf('id="viewport-wrap"');
    if (wrapAt < 0 || body.indexOf("<canvas", wrapAt) < 0) missing.push("canvas");
  }
  ok(missing.length === 0, (i + 1) + "手目の指す部品が実在する: " + sel, missing.join(" "));
  if (s.open) ok(body.includes('data-step="' + s.open + '"'), (i + 1) + "手目で開くステップが実在する: " + s.open);
}

/* ---------- 文面 ---------- */
for (const [i, s] of TOUR_STEPS.entries()) {
  ok(typeof s.text === "string" && s.text.length > 0, (i + 1) + "手目に文面がある");
  // 「やると進む」手には、何をすればよいかの補足を付ける(無いと「次へ」が押せない理由が分からない)
  if (s.ok && i !== 1) ok(typeof s.hint === "string" && s.hint.length > 0, (i + 1) + "手目(やると進む)に補足がある");
}
ok(TOUR_STEPS[1].hint && TOUR_STEPS[1].hint.includes("Area"), "2手目の補足は、選ぶ項目を名指しする");

/* ---------- やると進む手 ---------- */
/* 作者と決めたのは2・4・6手目(属性を変える・石をタップする・見え方を正面にする) */
{
  const acts = TOUR_STEPS.map((s, i) => (s.ok ? i + 1 : null)).filter(Boolean);
  ok(JSON.stringify(acts) === "[2,4,6]", "**やると進む手は 2・4・6 手目**", JSON.stringify(acts));
}

/* ---------- 案内を始める入り口 ---------- */
ok(/new URLSearchParams\(location\.search\)\.get\("tour"\) === "1"/.test(html), "?tour=1 で案内を始められる(操作ガイドから開いたとき)");
ok(html.includes('e.data.type === "gac-start-tour"'), "操作ガイドからの合図で案内を始められる");
{
  const help = fs.readFileSync(path.join(__dirname, "..", "help.html"), "utf8");
  ok(help.includes("data-start-tour") && help.includes("gac-start-tour"), "操作ガイドに「案内を始める」がある");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
