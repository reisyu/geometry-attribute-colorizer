"use strict";
/*
 * 作業データのCSVまわり。
 *
 * 1. データ名(Dataset列) ---------------------------------------------------
 * 属性CSVには付いていたのに、作業データの台帳には付いていなかった。
 * 同じ台帳を2か所で別々に組み立てていたためで、ZIPから開き直すと
 * データ名が空に戻っていた。**両方が ledgerCSV を通ること**を担保する。
 *
 * 2. 記録CSVのファイル名 ---------------------------------------------------
 * 持ち寄って1つのZIPにまとめるとき、全員が「記録.csv」だと重なって
 * 入れられない。日と人を名前に入れて重ならないようにする。
 */
const { ledgerCSV, recordFileName, rowsToCSV, openingAttribute, comboState, isLiveColorColumn, surveyorLabel, SURVEYOR_NONE, isColorizableColumn,
        REF_PREFIX, NOTE_FLAG_COL, NOTE_COL, HIST_PREFIX,
        COMBO_COL, COMBO_PREV, COMBO_BOTH, COMBO_NOW, COMBO_NONE } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

const BOM = String.fromCharCode(0xFEFF);
const rows2 = [{ ID: "1", Width: "0.42" }, { ID: "2", Width: "0.51" }];
const lines = (csv) => csv.replace(BOM, "").trim().split("\n");

/* ---------- データ名(Dataset列) ---------- */
{
  const out = ledgerCSV(rows2, ["ID", "Width"], "本丸東面");
  const L = lines(out);
  ok(L[0] === "ID,Width,Dataset", "データ名があるとDataset列が増える", L[0]);
  ok(L[1] === "1,0.42,本丸東面" && L[2] === "2,0.51,本丸東面",
     "**全行に同じ値**が入る", L[1] + " / " + L[2]);
  ok(out.charCodeAt(0) === 0xFEFF, "先頭にBOMが付く(Excelで文字化けしないため)");
}
{
  const L = lines(ledgerCSV(rows2, ["ID", "Width"], ""));
  ok(L[0] === "ID,Width", "データ名が空ならDataset列を足さない", L[0]);
  ok(L.length === 3, "行数は変わらない", L.length + "行");
}
{
  // 空白だけの入力は「入れていない」とみなす
  const L = lines(ledgerCSV(rows2, ["ID"], "   "));
  ok(L[0] === "ID", "空白だけのデータ名は無視する", L[0]);
}
{
  const L = lines(ledgerCSV(rows2, ["ID"], "  本丸東面  "));
  ok(L[1] === "1,本丸東面", "前後の空白は落とす", L[1]);
}
{
  // 読み戻したCSVを書き直す場合。列が増えず、いまの名前で上書きされる
  const old = [{ ID: "1", Dataset: "古い名前" }];
  const L = lines(ledgerCSV(old, ["ID", "Dataset"], "新しい名前"));
  ok(L[0] === "ID,Dataset", "Dataset列があっても二重に増やさない", L[0]);
  ok(L[1] === "1,新しい名前", "**いまの入力で上書きする**(古い値を残さない)", L[1]);
}
{
  const L = lines(ledgerCSV([{ ID: "1" }], ["ID"], '本丸,東面"北'));
  ok(L[1] === '1,"本丸,東面""北"', "カンマや引用符を含むデータ名が壊れない", L[1]);
}
{
  const L = lines(ledgerCSV([], ["ID", "Width"], "本丸東面"));
  ok(L[0] === "ID,Width,Dataset", "行が0件でも見出しは出る", L[0]);
}
{
  // 台帳と記録の見分けは「調査日の列があるか」で行う(loadBundle)。
  // Dataset列を足したせいで台帳が記録と間違われないこと
  const head = lines(ledgerCSV(rows2, ["ID", "Width"], "本丸東面"))[0].split(",");
  ok(!head.includes("SurveyDate"), "台帳に調査日の列は入らない(記録と誤認されない)");
}

/* ---------- rowsToCSV の fixed ---------- */
{
  const L = lines(rowsToCSV([{ ID: "1", A: "x" }], ["ID", "A"], { A: "固定" }));
  ok(L[1] === "1,固定", "fixedに入れた列は行の値を無視する", L[1]);
  const L2 = lines(rowsToCSV([{ ID: "1", A: "x" }], ["ID", "A"]));
  ok(L2[1] === "1,x", "fixedを渡さなければこれまでどおり", L2[1]);
}
{
  // 値が空文字の固定列。hasOwnPropertyで見ているので空も固定として扱う
  const L = lines(rowsToCSV([{ ID: "1", A: "x" }], ["ID", "A"], { A: "" }));
  ok(L[1] === "1,", "空文字でも固定値として書く", JSON.stringify(L[1]));
}

/* ---------- 記録CSVのファイル名 ---------- */
ok(recordFileName("2026-10-09", "山田") === "記録_2026-10-09_山田.csv",
   "日と人が名前に入る", recordFileName("2026-10-09", "山田"));
ok(recordFileName("2026-10-09", "") === "記録_2026-10-09.csv",
   "調査者が空なら日だけ", recordFileName("2026-10-09", ""));
ok(recordFileName("", "山田") === "記録_山田.csv",
   "日が空なら人だけ", recordFileName("", "山田"));
ok(recordFileName("", "") === "記録.csv",
   "どちらも空ならこれまでどおりの名前", recordFileName("", ""));
ok(recordFileName(null, undefined) === "記録.csv", "null/undefinedでも落ちない");
ok(recordFileName("2026-10-09", "山田") !== recordFileName("2026-10-09", "佐藤"),
   "**人が違えば名前も違う**(1つのZIPに並べられる)");
ok(recordFileName("2026-09-30", "山田") !== recordFileName("2026-10-09", "山田"),
   "日が違えば名前も違う");
ok(recordFileName("2026-10-09", "山田/太郎").indexOf("/") < 0,
   "ファイル名に使えない文字が残らない", recordFileName("2026-10-09", "山田/太郎"));
ok(recordFileName("2026-10-09", "山田 太郎") === "記録_2026-10-09_山田_太郎.csv",
   "空白は下線になる", recordFileName("2026-10-09", "山田 太郎"));
ok(/\.csv$/.test(recordFileName("2026-10-09", "山田")), "拡張子は.csv");
{
  // 末尾のピリオドはWindowsで落とされるため safeFileNamePart が削る
  const n = recordFileName("2026-10-09", "山田.");
  ok(!/\.\.csv$/.test(n), "末尾のピリオドが二重にならない", n);
}

/* ---------- 開いた直後に見せる図 ---------- */
/* 点検のために開いたのだから、点検の図で始める。
   ただし初回の点検(前回の記録が無い)では何も変えない */
{
  ok(openingAttribute(["ID", "Width", COMBO_COL]) === COMBO_COL,
     "「記録の状況」で開く(書いた石からその場で色が変わる)", openingAttribute(["ID", "Width", COMBO_COL]));
  ok(openingAttribute(["ID", "Width", NOTE_FLAG_COL]) === "",
     "記録の状況の列が無ければ何も変えない(存在しない属性を選ばない)");
  ok(openingAttribute([]) === "", "列が空でも落ちない");
  ok(openingAttribute(["ID", "履歴:記録回数"]) === "", "履歴の列だけでは切り替えない");
}

/* ---------- 色分けに出す列 ---------- */
/* 同じ図を別の名前で何枚も出すと、現場で選ぶ手間が増えるだけだった。
   メモの有無と前回:メモの有無は、どちらも「履歴:記録の状況」に含まれる */
{
  ok(!isColorizableColumn(NOTE_FLAG_COL, "ID"),
     "**メモの有無は色分けに出さない**(記録の状況に含まれる)");
  ok(!isColorizableColumn(REF_PREFIX + NOTE_FLAG_COL, "ID"),
     "**前回:メモの有無も出さない**(同上)");
  ok(isColorizableColumn(COMBO_COL, "ID"), "記録の状況は出す");
  ok(!isColorizableColumn(NOTE_COL, "ID"), "メモ本文は出さない(自由記述)");
  ok(!isColorizableColumn(REF_PREFIX + NOTE_COL, "ID"), "前回のメモ本文も出さない");
  ok(!isColorizableColumn("ID", "ID"), "ID列は出さない");
  ok(isColorizableColumn("Width", "ID"), "幅は出す");
  ok(isColorizableColumn(HIST_PREFIX + "調査者", "ID"), "調査者は出す");
  ok(isColorizableColumn(HIST_PREFIX + "記録回数", "ID"), "記録回数は出す");
}

/* ---------- 前回と今回を合わせた図 ---------- */
/* 点検中にいちばん見たいのは「前回の指摘で、まだ何も書いていない石」。
   それが「前回のみ」になり、書けば「前回と今回」に移る。
   回り終われば「前回のみ」が消える、という読み方をする */
{
  ok(comboState(true, false) === COMBO_PREV,
     "前回あり・今回なし → **前回のみ**(まだ書いていない指摘箇所)", comboState(true, false));
  ok(comboState(true, true) === COMBO_BOTH,
     "前回あり・今回あり → 前回と今回(見て書いた)", comboState(true, true));
  ok(comboState(false, true) === COMBO_NOW,
     "前回なし・今回あり → 今回のみ(新しい指摘)", comboState(false, true));
  ok(comboState(false, false) === COMBO_NONE,
     "どちらも無し → 記録なし", comboState(false, false));

  const all = [COMBO_PREV, COMBO_BOTH, COMBO_NOW, COMBO_NONE];
  ok(new Set(all).size === 4, "4つの値が互いに重ならない");
  ok(COMBO_COL.startsWith("履歴:"),
     "**履歴の列として扱う**(書き出すCSVには入らない)", COMBO_COL);
  ok(!all.includes("未確認"),
     "「未確認」とは呼ばない(書いていない=見ていない、と機械が決めつけないため)");
}

/* ---------- 書いた瞬間に塗り直す列 ---------- */
{
  ok(isLiveColorColumn(NOTE_FLAG_COL), "メモの有無は書いた瞬間に塗り直す");
  ok(isLiveColorColumn(COMBO_COL), "**前回と今回も書いた瞬間に塗り直す**(赤→青が見えないと意味がない)");
  ok(!isLiveColorColumn("Width"), "幅は塗り直さない(手入力で変わらない)");
  ok(!isLiveColorColumn(REF_PREFIX + NOTE_FLAG_COL),
     "前回:メモの有無は塗り直さない(今回の記入では動かない値)");
}

/* ---------- 点検者別の色分け ---------- */
/* 持ち寄って統合したあと、誰がどこを見たかを図で確かめるための列。
   「最後に書いた人」にすると、同じ石に後から別の人が書いた時点で
   先に見た人の担当範囲が図から消える。分担の確認には全員が要る */
{
  ok(surveyorLabel(["山田"]) === "山田", "1人ならその名前", surveyorLabel(["山田"]));
  ok(surveyorLabel(["山田", "佐藤"]) === surveyorLabel(["佐藤", "山田"]),
     "**並び順が違っても同じ呼び名**(同じ組み合わせが2色に割れない)", surveyorLabel(["山田", "佐藤"]));
  ok(surveyorLabel(["山田", "佐藤"]).includes("・"), "複数なら中黒で並べる", surveyorLabel(["山田", "佐藤"]));
  ok(surveyorLabel(["山田", "山田"]) === "山田", "同じ人が何度書いても1つ");
  ok(surveyorLabel([]) === SURVEYOR_NONE, "誰も書いていなければ記録なし", surveyorLabel([]));
  ok(surveyorLabel(null) === SURVEYOR_NONE, "中身が無くても落ちない");
  ok(surveyorLabel(undefined) === SURVEYOR_NONE, "undefinedでも落ちない");
  ok(surveyorLabel([" ", ""]) === SURVEYOR_NONE, "空白だけの名前は人数に数えない");
  ok(surveyorLabel(["  山田  "]) === "山田", "前後の空白は落とす", surveyorLabel(["  山田  "]));
  ok(surveyorLabel(["山田", "", "佐藤"]) === surveyorLabel(["山田", "佐藤"]),
     "空の名前が混じっても結果は変わらない");
  ok(surveyorLabel([null, "山田"]) === "山田", "nullが混じっても落ちない");
}
{
  // 3人以上でも割れない
  const a = surveyorLabel(["鈴木", "山田", "佐藤"]);
  const b = surveyorLabel(["佐藤", "鈴木", "山田"]);
  ok(a === b, "3人でも並び順によらず同じ", a);
  ok(a.split("・").length === 3, "3人ぶん並ぶ", a);
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
