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
const { TOUR_STEPS, COLUMN_TOUR_STEPS, SURVEY_TOUR_STEPS } = require("./extracted.js");

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
ok(Array.isArray(COLUMN_TOUR_STEPS) && COLUMN_TOUR_STEPS.length === 11, "案内は11手(v1.48.0 で2種類の値を付与する流れに)",
   String(COLUMN_TOUR_STEPS && COLUMN_TOUR_STEPS.length));
checkTargets("2本目 ", COLUMN_TOUR_STEPS);
checkTexts("2本目 ", COLUMN_TOUR_STEPS);
{
  /* 作者と決めたのは: 列を作る・石を選ぶ・値を付与する・投げ縄で囲む・まとめて付与する・
     別の石を囲む・2種類目を付与する・その列で色分けする */
  const acts = COLUMN_TOUR_STEPS.map((s, i) => (s.ok ? i + 1 : null)).filter(Boolean);
  ok(JSON.stringify(acts) === "[2,3,4,6,7,8,9,10]", "**やると進む手は 2・3・4・6・7・8・9・10 手目**", JSON.stringify(acts));
}
/* 文面には利用者が実際に入れた名前が入る(「石種」「砂岩」以外でも進められる) */
{
  const other = { col: "エリア", value: "北面", value2: "南面" };
  const t4 = COLUMN_TOUR_STEPS[3].text(other), t10 = COLUMN_TOUR_STEPS[9].text(other);
  ok(t4.includes("「エリア」") && t10.includes("「エリア」"), "4・10手目の文面は、作った列の名前を使う", t4);
  ok(COLUMN_TOUR_STEPS[4].text(other).includes("「北面」"), "5手目の文面は、付与した値を使う");
  ok(COLUMN_TOUR_STEPS[7].hint(other).includes("「北面」"), "8手目の補足は、1種類目の値を名指しする");
  ok(t10.includes("北面と南面"), "10手目は、付与した2種類の値を名指しする", t10);
  ok(COLUMN_TOUR_STEPS[9].hint(other).includes("「エリア」"), "10手目の補足は、選ぶ列を名指しする");
}
/* 作者が直した言い回し(2026-11-15)。「付ける」ではなく「付与」 */
ok(asText(COLUMN_TOUR_STEPS[0].text) === "石垣の属性は追加することができます。（石種など）", "1手目は作者の文面のまま");
ok(asText(COLUMN_TOUR_STEPS[10].text).includes("復元されます"), "11手目はZIPで復元できることを言う");
/* 2種類目(v1.48.0)。投げ縄は今の選択に足すので、8手目に入るとき選択を外す。
   外さないと砂岩の石まで花崗岩で上書きされ、色分けが1色に戻る */
ok(COLUMN_TOUR_STEPS[7].enter && /function tourClearForSecond\(\) \{\s*if \(!selectMode\) setSelectMode\(true\);\s*clearSelection\(\);/.test(html),
   "**8手目に入るとき、選択を外す**(砂岩の石を花崗岩で上書きしない)");
ok(asText(COLUMN_TOUR_STEPS[8].text).includes("「花崗岩」"), "9手目は2種類目に「花崗岩」を入れさせる");
/* ビュー(石垣)を指す手は、吹き出しをビューの中の左上に置く(作者の指定で統一) */
{
  const onView = [...TOUR_STEPS, ...COLUMN_TOUR_STEPS].filter((s) => s.target === "#viewport-wrap canvas");
  ok(onView.length === 3 && onView.every((s) => s.place === "view"), "**ビューを指す手(1本目4手目・2本目3・8手目)は、吹き出しをビューの左上に置く**",
     String(onView.length));
  ok(html.includes('} else if (step.place === "view") {') && html.includes('getElementById("viewport-badges")'),
     "左上の状態表示の下に置く(表示を隠さない)");
}
/* 選択したままだと色が見分けにくい(作者の指摘)。10手目に入るとき選択を外し、モードも抜ける */
ok(COLUMN_TOUR_STEPS[9].enter && /function tourClearForColor\(\) \{\s*if \(selectMode\) setSelectMode\(false\);/.test(html),
   "**10手目に入るとき、選択を外す**(色分けの色が見分けられるように)");
ok(asText(COLUMN_TOUR_STEPS[9].text).includes("灰色"), "10手目は、付与していない石が灰色になることを言う");
ok(html.includes("if (step.enter) step.enter(tour.ctx);"), "手に入るときの下ごしらえ(enter)を呼ぶ");
/* 属性を付与する欄は「属性」タブにある(v1.47.0)。案内の側で開かないと、点検タブを開いていた人や
   欄を畳んでいた人には見えない */
ok([3, 4, 6, 8].every((i) => COLUMN_TOUR_STEPS[i].tab === "attr" && COLUMN_TOUR_STEPS[i].unfold === "give"),
   "4・5・7・9手目は「属性」タブと「属性を付与する」を開く");
/* 値をもう一度押しても外れない(v1.47.0)。5手目は外し方を「空にする」で言う(作者の指摘) */
{
  const t5 = asText(COLUMN_TOUR_STEPS[4].text);
  ok(t5.includes("「空にする」") && !t5.includes("もう一度押すと外れ"), "5手目は、外し方を「空にする」で言う", t5);
}
ok(html.includes("if (step.unfold) setInspFold(step.unfold, false);"), "案内は、畳まれた段を開いてから指す");

/* ===== 3本目: 点検の記録(v1.49.0) ===== */
console.log("--- 3本目(点検の記録) ---");
ok(Array.isArray(SURVEY_TOUR_STEPS) && SURVEY_TOUR_STEPS.length === 11, "案内は11手",
   String(SURVEY_TOUR_STEPS && SURVEY_TOUR_STEPS.length));
checkTargets("3本目 ", SURVEY_TOUR_STEPS);
checkTexts("3本目 ", SURVEY_TOUR_STEPS);
{
  /* 項目を作る・石を選ぶ・点検者を入れる・印を付ける・ブラシでなぞる・まとめて印を付ける・
     記録の状況で色分けする。7手目(メモ)は作者の文面が紹介なので、読んで進む */
  const acts = SURVEY_TOUR_STEPS.map((s, i) => (s.ok ? i + 1 : null)).filter(Boolean);
  ok(JSON.stringify(acts) === "[2,3,4,5,8,9,10]", "**やると進む手は 2・3・4・5・8・9・10 手目**", JSON.stringify(acts));
}
/* 作者の文面(2026-11-15)。例は「ひび割れ・剥離」、印の値は「あり」 */
ok(asText(SURVEY_TOUR_STEPS[0].text) === "点検結果を、点検日・点検者名とともに記録として残せます。（ひび割れ・剥離など）", "1手目は作者の文面のまま");
ok(asText(SURVEY_TOUR_STEPS[3].hint) === "点検日は今日の日付が入っています。名前は次に開いたときにも同じ名前が入ります。", "4手目の補足は作者の文面のまま");
ok(SURVEY_TOUR_STEPS[4].text({ col: "はらみ出し", value: "あり" }) === "「はらみ出し」の行ができました。「＋」を押し、「あり」と入れて「追加」を押してください。", "5手目は作者の文面のまま");
ok(asText(SURVEY_TOUR_STEPS[6].text) === "メモ欄に自由記述することができます（例: 目地が開いている）", "7手目は作者の文面のまま");
ok(!SURVEY_TOUR_STEPS.some((s) => /該当/.test(asText(s.text) + (s.hint ? asText(s.hint) : ""))), "**文面に「該当」を使わない**(印の値は「あり」)");
{
  const other = { col: "ひび割れ", value: "大" };
  ok(SURVEY_TOUR_STEPS[4].text(other).includes("「ひび割れ」") && SURVEY_TOUR_STEPS[5].text(other).includes("「大」"),
     "5・6手目の文面は、作った項目と付けた値の名前を使う");
}
ok(SURVEY_TOUR_STEPS[2].place === "view", "3手目(石をタップ)の吹き出しはビューの左上");
ok([3, 4, 5, 6, 8].every((i) => SURVEY_TOUR_STEPS[i].tab === "survey"), "**4〜7・9手目は「点検」タブを開く**(初めては「属性」タブが開くため)");
/* まとめて印を付ける手(作者の指定でブラシ)。ブラシは今の選択に足すので、入るときに外す */
ok(SURVEY_TOUR_STEPS[7].target === "#select-pick" && asText(SURVEY_TOUR_STEPS[7].text).includes("「ブラシ」") &&
   SURVEY_TOUR_STEPS[7].enter, "**8手目はブラシでなぞる**(入るときに選んだ1つを外す)");
ok(asText(SURVEY_TOUR_STEPS[8].text).includes("まとめて印が付きます"), "9手目は、なぞった石にまとめて印を付ける");
ok(SURVEY_TOUR_STEPS[9].enter && /colorColumn === COMBO_COL/.test(String(SURVEY_TOUR_STEPS[9].ok)),
   "10手目は選択を外してから、記録の状況で色分けすると進む");
ok(/function tourClearForColor\(\) \{[\s\S]*?if \(highlightObj\) \{[\s\S]*?setHighlight\(null\);/.test(html),
   "色分けの前に、通常のタップで選んだ1つの強調表示も外す");
ok(/survey: \{ steps: SURVEY_TOUR_STEPS, sampleOnly: true,/.test(html), "**3本目もサンプルのときだけ進める**");
/* 削除するときは、書いたメモも案内を始める前に戻す(メモ列が無かったなら列ごと) */
ok(html.includes("c.notes = new Map(csvRows.map((r) => [r, r[NOTE_COL]]));") && /if \(c\.notes\) \{[\s\S]*?if \(!c\.hadNoteCol\)/.test(html),
   "**削除すると、書いたメモも戻す**");
ok(html.includes('c.endBody = "削除すると、付けた印と書いたメモもなくなり、色分けも元に戻ります。";'),
   "3本目の確認は、印とメモが消えることを言う");

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
ok(/function columnTourEnd\(/.test(html) && html.includes("削除して終了する") && html.includes("残して終了する"),
   "終わるとき、練習で作った列を削除するか残すかを尋ねる");
/* 確認の文面は作者が書いたもの(2026-11-15) */
ok(html.includes('"の情報を削除しますか？"') &&
   html.includes('"削除すると、付与した値もなくなり、色分けも元に戻ります。"') &&
   html.includes('"残した情報は、次にサンプルを開いたときにも読み込まれます。"'),
   "終わるときの確認は作者の文面のまま");

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
  ok(help.includes('href="index.html?tour=survey" data-start-tour="survey"'), "操作ガイドに3本目(点検の記録)の入り口がある");
  ok(help.includes("gac-start-tour") && help.includes('getAttribute("data-start-tour")'), "操作ガイドは案内の名前を合図に載せる");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
