"use strict";
/*
 * スマホの画面(§10.11)。下から出るシートと、凡例の札。
 *
 * 幅700px未満では、右上のパネルを画面の下から出るシートにする。点検は
 * 「石を見る → 選ぶ → 印とメモを付ける」の繰り返しで、片手の親指だけで済ませたい。
 *
 * 見た目はCSSの @media の中だけにある。パソコン・iPadの画面を変えないことが要なので、
 * 「スマホ用の決まりが @media の外に漏れていないか」をここで確かめる。
 */
const fs = require("fs");
const path = require("path");
const { sheetTap, sheetStep, sheetSummary, SHEET_STATES, NOTE_COL } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };
const eq = (a, b, n) => ok(a === b, n, "(" + JSON.stringify(a) + ")");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
const body = html.slice(html.indexOf("<body"), html.indexOf("<script>"));

/* ---------- 高さは3段階 ---------- */
eq(JSON.stringify(SHEET_STATES), JSON.stringify(["low", "mid", "high"]), "高さは 低・中・高 の3段階");
/* つまみを押す: 低→中、中→高、高→中(低へは払って下げる。押すたびに畳まれると使いにくい) */
eq(sheetTap("low"), "mid", "つまみを押す: 低 → 中");
eq(sheetTap("mid"), "high", "つまみを押す: 中 → 高");
eq(sheetTap("high"), "mid", "つまみを押す: 高 → 中");
/* 払う: 向きへ1段。端では動かない */
eq(sheetStep("low", 1), "mid", "上に払う: 低 → 中");
eq(sheetStep("mid", 1), "high", "上に払う: 中 → 高");
eq(sheetStep("high", 1), "high", "**上に払う: 高のまま**(端では動かない)");
eq(sheetStep("high", -1), "mid", "下に払う: 高 → 中");
eq(sheetStep("mid", -1), "low", "下に払う: 中 → 低");
eq(sheetStep("low", -1), "low", "**下に払う: 低のまま**");
eq(sheetStep("???", 1), "mid", "知らない状態は中に戻す");

/* ---------- 要約(低でも、付いている印と前回の指摘が読める) ---------- */
{
  const j = (o) => JSON.stringify(o);
  eq(j(sheetSummary(null, ["はらみ出し"], [])), j({ marks: "", prev: "" }), "行が無ければ空");
  eq(sheetSummary({ はらみ出し: "あり" }, ["はらみ出し", "ひび割れ"], []).marks, "はらみ出し: あり", "付いている印だけを並べる");
  eq(sheetSummary({ はらみ出し: "あり", ひび割れ: "あり" }, ["はらみ出し", "ひび割れ"], []).marks,
     "はらみ出し: あり / ひび割れ: あり", "印が2つなら両方");
  eq(sheetSummary({ はらみ出し: " ", [NOTE_COL]: "" }, ["はらみ出し"], []).marks, "", "空白だけの値は付いていない扱い");
  eq(sheetSummary({ [NOTE_COL]: "目地が開いている" }, [], []).marks, "メモあり", "メモがあれば「メモあり」");
  eq(sheetSummary({ 石種: "砂岩" }, ["はらみ出し"], []).marks, "", "**属性(石種)は点検の要約に入れない**");
  const hist = [
    { date: "2024-11-01", who: "佐藤", text: "古い", same: false },
    { date: "2025-11-01", who: "山田", text: "目地が開いている", same: false },
    { date: "2026-11-15", who: "鈴木", text: "今日の別の人", same: true },
  ];
  eq(sheetSummary({}, [], hist).prev, "前回 2025-11-01 山田: 目地が開いている", "**前回は、今日より前でいちばん新しい記述**");
  eq(sheetSummary({}, [], [{ date: "2025-11-01", who: "", text: "x", same: false }]).prev, "前回 2025-11-01: x", "点検者が無ければ名前を出さない");
  eq(sheetSummary({}, [], [{ date: "2026-11-15", who: "鈴木", text: "今日", same: true }]).prev, "", "今日の記述しか無ければ前回は出さない");
  eq(sheetSummary({}, [], null).prev, "", "履歴が null でも落ちない");
}

/* ---------- 部品 ---------- */
{
  const at = (id) => body.indexOf('id="' + id + '"');
  ok(at("insp-sheet-handle") > at("inspector") && at("insp-sheet-handle") < at("insp-name"), "つまみはパネルの先頭");
  ok(at("insp-sheet-close") > at("insp-name") && at("insp-sheet-close") < at("tab-attr"), "閉じるボタンは番号の横");
  ok(at("insp-sheet-sum") > at("insp-sheet-close") && at("insp-sheet-sum") < at("tab-attr"), "要約はタブの上");
  ok(at("legend-toggle") > at("legend-stack") && at("legend-toggle") < at("rectline-legend"), "凡例の札は凡例の先頭");
  ok(/id="legend-stack" class="legend-folded"/.test(body), "凡例は畳んだ状態から始める(スマホで石垣を広く見せる)");
}

/* ---------- パソコン・iPadの画面を変えない ---------- */
{
  const mediaAt = css.lastIndexOf("@media (max-width: 700px)");
  const outside = css.slice(0, mediaAt), inside = css.slice(mediaAt);
  ok(mediaAt > 0, "スマホ用の決まりは @media (max-width: 700px) にある");
  ok(/#insp-sheet-handle, #insp-sheet-sum, #insp-sheet-close, #legend-toggle \{ display: none; \}/.test(outside),
     "**スマホ用の部品(つまみ・要約・閉じる・凡例の札)は、ふだんは出さない**");
  ok(!/data-sheet/.test(outside), "**シートの高さの決まりが @media の外に無い**(パソコンのパネルの高さを変えない)");
  ok(!/legend-folded/.test(outside) && !/sheet-open/.test(outside), "**凡例を畳む・隠す決まりが @media の外に無い**");
  ok(/#inspector\[data-sheet="mid"\] \{ height: 46%; \}/.test(inside), "中は画面の半分弱");
  ok(/#inspector\[data-sheet="low"\] > :not\(#insp-sheet-handle\):not\(#insp-sheet-top\):not\(#insp-sheet-sum\) \{ display: none !important; \}/.test(inside),
     "低は、つまみ・番号・要約だけを出す");
  ok(/#viewport-wrap\.sheet-open #legend-stack \{ display: none; \}/.test(inside) &&
     /#viewport-wrap\.sheet-open\.sheet-low #legend-stack \{ display: flex; bottom: calc\(/.test(inside),
     "**シートが出ている間は凡例を隠す。低のときはシートの上に出す**(重ならない)");
  ok(/env\(safe-area-inset-bottom/.test(inside), "シートの下端は、端末の下の余白を空ける");
}

/* ---------- 動き ---------- */
ok(html.includes('const sheetState = { single: "mid", multi: "low" };'),
   "**1つ選んだ直後は中、まとめて選ぶ間は低から**(なぞる石垣を隠さない)");
ok(/if \(narrow && open && !sheetWasOpen && !document\.body\.classList\.contains\("panel-collapsed"\)\) \{\s*setPanelCollapsed\(true\);/.test(html),
   "**スマホでシートが出たら、左のパネルを畳む**(挟まれて石垣が見えなくなるため)");
ok(/function closeInspectorSheet\(\) \{\s*if \(selection\.size > 0\) clearSelection\(\);/.test(html), "閉じると選択も外す");
ok(html.includes('if (sheetState[sheetMode()] === "low") setSheetState("mid");'), "案内がパネルの中を指すときは、低のシートを中に上げる");
ok(/if \(isNarrowScreen\(\) && !\(data && \(data\.inspectorTab === "attr" \|\| data\.inspectorTab === "survey"\)\)\) \{\s*setInspectorTab\("survey"\);/.test(html),
   "**スマホで初めて開いたときは「点検」タブ**(パソコンは「属性」のまま)");
ok(html.includes("renderSheetSummary(row);") && html.includes("renderSheetSummary(null);"), "要約は、石を選んだときと値を書いたときに書き直す");

/* ========== 段階2: 上の帯と下のバー(§10.11.2、v1.53.0) ========== */
{
  const at = (id) => body.indexOf('id="' + id + '"');
  const mediaAt = css.lastIndexOf("@media (max-width: 700px)");
  const outside = css.slice(0, mediaAt), inside = css.slice(mediaAt);

  /* 下のバーは 選択・色分け・現在地・保存 の4つ(作者が承認した並び) */
  ok(at("pb-select") < at("pb-color") && at("pb-color") < at("pb-geo") && at("pb-geo") < at("pb-save") && at("phone-bar") < at("pb-select"),
     "**下のバーは 選択・色分け・現在地・保存 の順**");
  ok(at("phone-menu") > at("phone-top") && at("phone-unsaved") > at("phone-menu") && at("phone-unsaved") < at("phone-bar"),
     "上の帯に、左のパネルの開け閉めと未保存の件数がある");

  /* パソコン・iPadには出さない */
  ok(/#phone-top, #phone-bar \{ display: none; \}/.test(outside), "**上の帯と下のバーは、ふだんは出さない**");
  ok(!/--bar-h/.test(outside) && !/--band-h/.test(outside), "帯とバーの高さの決まりが @media の外に無い");
  ok(/#panel-toggle \{ display: none; \}/.test(inside) && /#note-badge \{ display: none !important; \}/.test(inside) && /#tb-tools \{ display: none; \}/.test(inside),
     "スマホでは、つまみ・左上の未保存バッジ・ツールバーの現在地と選択を出さない(帯とバーが代わりをする)");

  /* 同じ部品を置き場所だけ移す(写しを作らない) */
  ok(/put\(\$\("select-pick"\), \$\("pb-select"\)/.test(html) && /put\(\$\("geo-btn"\), \$\("pb-geo"\)/.test(html) &&
     /put\(\$\("survey-head"\), \$\("phone-top"\)/.test(html),
     "**選択・現在地・点検日と点検者は、同じ部品をスマホのときだけ移す**(案内が指す先を2つに割らない)");
  ok(/put\(\$\("geo-btn"\), tools, tools\.firstElementChild\);\s*put\(\$\("select-pick"\), tools, null\);\s*put\(\$\("survey-head"\), pane, pane\.firstElementChild\);/.test(html),
     "パソコンの幅に戻ったら、元の場所と順番に戻す");
  ok(/if \(el && parent && el\.parentElement !== parent\) parent\.insertBefore/.test(html),
     "もう置いてあれば差し直さない(入力中の欄からカーソルが外れる)");
  ok(body.indexOf('id="geo-btn"') > body.indexOf('id="tb-tools"') && body.indexOf('id="survey-head"') > body.indexOf('id="insp-pane-survey"'),
     "本体に書いてある置き場所はパソコン用のまま");

  /* 置き直し */
  ok(/bottom: var\(--bar-h\);/.test(inside) && /#inspector\[data-sheet="high"\] \{ height: calc\(100% - var\(--bar-h\)/.test(inside),
     "**シートは下のバーの上に出す**(保存を隠さない)");
  ok(/#viewport-wrap\.sheet-open\.sheet-low #legend-stack \{ display: flex; bottom: calc\(var\(--bar-h\) \+ var\(--sheet-h, 0px\) \+ 8px\); \}/.test(inside) &&
     /#viewport-gizmo \{ bottom: calc\(var\(--bar-h\) \+ 12px\); \}/.test(inside),
     "凡例の札と軸の印は、バーの上に置き直す");
  ok(/#phone-bar #select-pick select, #phone-color \{[^}]*font-size: max\(16px,/.test(inside),
     "選択肢の文字は16px(16px未満だと、押したとき画面が拡大される)");

  /* 動き */
  ok(html.includes('document.getElementById("phone-unsaved").textContent = dirty ? "未保存 " + n : "";') &&
     html.includes('document.getElementById("pb-save-label").textContent = dirty ? "保存 " + n : "保存";'),
     "**未保存の件数を、上の帯と「保存」に出す**");
  ok(/getElementById\("pb-save"\)\.addEventListener\("click", \(\) => \{\s*document\.getElementById\("export-bundle-btn"\)\.click\(\);/.test(html),
     "「保存」は、作業データをZIPで保存する(左のパネルのボタンと同じ経路)");
  ok(/if \(v === ""\) \{ document\.getElementById\("reset-btn"\)\.click\(\); return; \}/.test(html) &&
     html.includes('const src = document.getElementById(v.startsWith("s:") ? "survey-attribute" : "attribute");'),
     "「色分け」は、左のパネルの選択肢を動かす(色分けの仕組みは1つ)");
  ok(/\[\["点検", "s:", document\.getElementById\("survey-attribute"\)\],\s*\["属性", "a:", document\.getElementById\("attribute"\)\]\]/.test(html),
     "「色分け」の一覧は、点検側を先に並べる");
  ok(html.includes('pc.addEventListener("pointerdown", syncPhoneColor);'), "一覧は開く直前に作り直す");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
