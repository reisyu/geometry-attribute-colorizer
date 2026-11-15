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
/* 5手目は「選んだ石の属性が、ここに出ます」。「点検」タブを開いていた人や一覧を畳んでいた人には、
   開かないと属性の一覧が見えず、文面と画面が食い違う(作者の確認で見つかった) */
ok(TOUR_STEPS[4].tab === "attr" && TOUR_STEPS[4].unfold === "list", "**5手目は「属性」タブと属性の一覧を開く**");
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
/* 属性を付与する欄は「属性」タブにある(v1.47.0)。案内の側で開かないと、点検タブを開いていた人や
   欄を畳んでいた人には見えない */
ok([3, 4, 6].every((i) => COLUMN_TOUR_STEPS[i].tab === "attr" && COLUMN_TOUR_STEPS[i].unfold === "give"),
   "4・5・7手目は「属性」タブと「属性を付与する」を開く");
/* 値をもう一度押しても外れない(v1.47.0)。5手目は外し方を「空にする」で言う(作者の指摘) */
{
  const t5 = asText(COLUMN_TOUR_STEPS[4].text);
  ok(t5.includes("「空にする」") && !t5.includes("もう一度押すと外れ"), "5手目は、外し方を「空にする」で言う", t5);
}
ok(html.includes("if (step.unfold) setInspFold(step.unfold, false);"), "案内は、畳まれた段を開いてから指す");

/* ---------- 右上の入力欄の置き場所(§10.9.1) ---------- */
/* 属性(石種)は「属性」タブ、点検項目は「点検」タブ、選択の操作はタブの外 */
{
  const at = (id) => body.indexOf('id="' + id + '"');
  const attrPane = [at("insp-pane-attr"), at("insp-pane-survey")];
  const surveyEnd = at("insp-sel");
  ok(at("insp-attr-input") > attrPane[0] && at("insp-attr-input") < attrPane[1], "**属性を付与する欄は「属性」タブの中**");
  ok(at("insp-attr-view") < at("insp-table") && at("insp-table") < at("insp-attr-input"),
     "**上に属性の一覧、下に属性を付与する欄**(作者の案)");
  ok(/data-fold="list">\s*<button class="insp-fold-head"[^>]*>属性の一覧</.test(body) &&
     /data-fold="give">\s*<button class="insp-fold-head"[^>]*>属性を付与する</.test(body),
     "見出しは「属性の一覧」「属性を付与する」で、押すと畳める");
  ok(!body.includes("手で付ける属性"), "「手で付ける属性」という見出しは使わない");
  ok(html.includes("inspFolded: { ...inspFolded },"), "畳んだ状態は設定として覚える");
  ok(/#inspector {[^}]*min-width:/.test(html), "**畳んでもパネルが細くならない**(幅の下限がある)");
  ok(!/if \(staticCols\.has\(k\)\) continue;/.test(html), "**属性の一覧には、手で付与した属性も出す**");
  ok(at("insp-classify") > attrPane[1] && at("insp-classify") < surveyEnd, "点検項目の入力欄は「点検」タブの中");
  ok(surveyEnd > at("insp-note") && body.indexOf('id="insp-group-clear"') > surveyEnd, "**選択を解除するボタンはタブの外**(どちらのタブでも押せる)");
  ok(!body.includes("insp-class-col") && !body.includes("insp-class-new"), "列を選ぶ欄と常に出ている入力欄は無い(＋で行の中に開く)");
  ok(html.includes("classAddOpen = open ? null : { col, draft: \"\" }"), "＋はその行の入力欄を開け閉めする");
}
/* 練習の列を作るので、サンプルのときだけ進め、終わるときに後始末を尋ねる */
ok(/columns: \{ steps: COLUMN_TOUR_STEPS, sampleOnly: true,/.test(html), "**2本目はサンプルのときだけ進める**");
ok(/function columnTourEnd\(/.test(html) && html.includes("消して終わる") && html.includes("残して終わる"),
   "終わるとき、練習で作った列を消すか残すかを尋ねる");

/* ---------- インスペクタの最初の表示 ---------- */
/* 5手目は右上の属性表示を初めての人に見せる。設定の控えが無いときはタブを切り替える
   処理が呼ばれないので、本体に書いた最初の表示がそのまま出る。選ばれたタブと
   見えている面が食い違うと、両方の面が並んで出る(v1.45.1で修正) */
{
  const tabOn = /class="insp-tab on" id="tab-attr"/.test(body) ? "attr" : "survey";
  const hidden = (id) => new RegExp('id="' + id + '"[^>]*display:\\s*none').test(body);
  ok(/let inspectorTab = "attr";/.test(html) && tabOn === "attr", "**インスペクタの既定は「属性」タブ**(作者の指摘で v1.47.0 から)");
  ok(!hidden("insp-pane-attr") && hidden("insp-pane-survey"),
     "**最初は「属性」の面だけを出す**(設定の控えが無いときに両方が並ばない)");
  ok(html.includes('if (data.inspectorTab === "attr" || data.inspectorTab === "survey") setInspectorTab(data.inspectorTab);'),
     "覚えたタブが無いときは、既定(属性)のまま");
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
