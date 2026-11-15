"use strict";
/*
 * 操作の案内(§10.10、§10.10.1)。
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
const { TOUR_STEPS, COLUMN_TOUR_STEPS } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const body = html.slice(html.indexOf("<body"), html.indexOf("<script>"));

/* 文面の {列} {値} は関数で書く。利用者が入れた名前を渡して文字にする */
const SAMPLE_CTX = { col: "石種", value: "砂岩" };
const asText = (v) => (typeof v === "function" ? v(SAMPLE_CTX) : v);

/* ---------- 指す部品が本体に実在する(両方の案内) ---------- */
function checkTargets(label, steps) {
  for (const [i, s] of steps.entries()) {
    const sel = s.target;
    const ids = [...sel.matchAll(/#([\w-]+)/g)].map((m) => m[1]);
    const stepIds = [...sel.matchAll(/\[data-step="([\w-]+)"\]/g)].map((m) => m[1]);
    const classes = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
    const missing = [];
    for (const id of ids) if (!body.includes('id="' + id + '"')) missing.push("#" + id);
    for (const st of stepIds) if (!body.includes('data-step="' + st + '"')) missing.push('[data-step="' + st + '"]');
    for (const c of classes) if (!new RegExp('class="[^"]*\\b' + c + '\\b').test(body)) missing.push("." + c);
    // 石垣を指す手は、描画先(canvas)がビューの中にあること
    if (/\bcanvas\b/.test(sel)) {
      const wrapAt = body.indexOf('id="viewport-wrap"');
      if (wrapAt < 0 || body.indexOf("<canvas", wrapAt) < 0) missing.push("canvas");
    }
    ok(missing.length === 0, label + (i + 1) + "手目の指す部品が実在する: " + sel, missing.join(" "));
    if (s.open) ok(body.includes('data-step="' + s.open + '"'), label + (i + 1) + "手目で開くステップが実在する: " + s.open);
  }
}
/* 文面と、「やると進む」手の補足 */
function checkTexts(label, steps) {
  for (const [i, s] of steps.entries()) {
    const t = asText(s.text);
    ok(typeof t === "string" && t.length > 0, label + (i + 1) + "手目に文面がある");
    // 「やると進む」手には、何をすればよいかの補足を付ける(無いと「次へ」が押せない理由が分からない)
    if (s.ok) {
      const h = asText(s.hint);
      ok(typeof h === "string" && h.length > 0, label + (i + 1) + "手目(やると進む)に補足がある");
    }
  }
}

/* ===== 1本目: 基本の操作 ===== */
console.log("--- 1本目(基本の操作) ---");
ok(Array.isArray(TOUR_STEPS) && TOUR_STEPS.length === 9, "案内は9手", String(TOUR_STEPS && TOUR_STEPS.length));
checkTargets("1本目 ", TOUR_STEPS);
// 2手目は、Area の無いデータで読むだけの手になるため ok を持つが、補足の検査は名指しで行う
checkTexts("1本目 ", TOUR_STEPS.map((s, i) => (i === 1 ? { ...s, ok: undefined } : s)));
ok(TOUR_STEPS[1].hint && TOUR_STEPS[1].hint.includes("Area"), "2手目の補足は、選ぶ項目を名指しする");
/* 5手目は「選んだ石の属性が、ここに出ます」。右上の既定は「点検」タブなので、
   開かないと属性の表が見えず、文面と画面が食い違う(作者の確認で見つかった) */
ok(TOUR_STEPS[4].tab === "attr", "**5手目は「属性」タブを開く**");
{
  /* 作者と決めたのは2・4・6手目(属性を変える・石をタップする・見え方を正面にする) */
  const acts = TOUR_STEPS.map((s, i) => (s.ok ? i + 1 : null)).filter(Boolean);
  ok(JSON.stringify(acts) === "[2,4,6]", "**やると進む手は 2・4・6 手目**", JSON.stringify(acts));
}

/* ===== 2本目: 属性を付ける ===== */
console.log("--- 2本目(属性を付ける) ---");
ok(Array.isArray(COLUMN_TOUR_STEPS) && COLUMN_TOUR_STEPS.length === 9, "案内は9手",
   String(COLUMN_TOUR_STEPS && COLUMN_TOUR_STEPS.length));
checkTargets("2本目 ", COLUMN_TOUR_STEPS);
checkTexts("2本目 ", COLUMN_TOUR_STEPS);
{
  /* 作者と決めたのは: 列を作る・石を選ぶ・値を付与する・投げ縄で囲む・まとめて付与する・その列で色分けする */
  const acts = COLUMN_TOUR_STEPS.map((s, i) => (s.ok ? i + 1 : null)).filter(Boolean);
  ok(JSON.stringify(acts) === "[2,3,4,6,7,8]", "**やると進む手は 2・3・4・6・7・8 手目**", JSON.stringify(acts));
}
/* 文面には利用者が実際に入れた名前が入る(「石種」「砂岩」以外でも進められる) */
{
  const other = { col: "エリア", value: "北面" };
  const t4 = COLUMN_TOUR_STEPS[3].text(other), t8 = COLUMN_TOUR_STEPS[7].text(other);
  ok(t4.includes("「エリア」") && t8.includes("「エリア」"), "4・8手目の文面は、作った列の名前を使う", t4);
  ok(COLUMN_TOUR_STEPS[4].text(other).includes("「北面」"), "5手目の文面は、付与した値を使う");
  ok(COLUMN_TOUR_STEPS[7].hint(other).includes("「エリア」"), "8手目の補足は、選ぶ列を名指しする");
}
/* 作者が直した言い回し(2026-11-15)。「付ける」ではなく「付与」 */
ok(asText(COLUMN_TOUR_STEPS[0].text) === "石垣の属性は追加することができます。（石種など）", "1手目は作者の文面のまま");
ok(asText(COLUMN_TOUR_STEPS[8].text).includes("復元されます"), "9手目はZIPで復元できることを言う");
/* 4手目の入力欄は「点検」タブにある。案内の側で開かないと、属性タブを開いていた人には見えない */
ok(COLUMN_TOUR_STEPS[3].tab === "survey", "4手目は「点検」タブを開く");
/* 練習の列を作るので、サンプルのときだけ進め、終わるときに後始末を尋ねる */
ok(/columns: \{ steps: COLUMN_TOUR_STEPS, sampleOnly: true,/.test(html), "**2本目はサンプルのときだけ進める**");
ok(/function columnTourEnd\(/.test(html) && html.includes("消して終わる") && html.includes("残して終わる"),
   "終わるとき、練習で作った列を消すか残すかを尋ねる");

/* ---------- インスペクタの最初の表示 ---------- */
/* 5手目は右上の属性表示を初めての人に見せる。設定の控えが無いときはタブを切り替える
   処理が呼ばれないので、本体に書いた最初の表示がそのまま出る。選ばれたタブと
   見えている面が食い違うと、両方の面が並んで出る(v1.45.1で修正) */
{
  const tabOn = /class="insp-tab on" id="tab-survey"/.test(body) ? "survey" : "attr";
  const hidden = (id) => new RegExp('id="' + id + '"[^>]*display:\\s*none').test(body);
  ok(/let inspectorTab = "survey";/.test(html) && tabOn === "survey", "インスペクタの既定は「点検」タブ");
  ok(hidden("insp-pane-attr") && !hidden("insp-pane-survey"),
     "**最初は「点検」の面だけを出す**(設定の控えが無いときに両方が並ばない)");
}

/* ---------- 案内を始める入り口 ---------- */
ok(/if \(q === "1"\) want = "basic";/.test(html), "?tour=1 で1本目を始められる(操作ガイドの古いリンク)");
ok(/hasOwnProperty\.call\(TOURS, q\)\) want = q;/.test(html), "?tour=columns で2本目を始められる");
ok(html.includes('e.data.type === "gac-start-tour"') && html.includes("startTour(tourByName(e.data.tour))"),
   "操作ガイドからの合図で、名指しした案内を始められる");
{
  const help = fs.readFileSync(path.join(__dirname, "..", "help.html"), "utf8");
  ok(help.includes('href="index.html?tour=1" data-start-tour>'), "操作ガイドに1本目の入り口がある");
  ok(help.includes('href="index.html?tour=columns" data-start-tour="columns"'), "操作ガイドの「属性と点検項目を付ける」に2本目の入り口がある");
  ok(help.includes("gac-start-tour") && help.includes('getAttribute("data-start-tour")'), "操作ガイドは案内の名前を合図に載せる");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
