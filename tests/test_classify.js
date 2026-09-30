"use strict";
/*
 * 分類の列(手入力)の検証。
 *
 * 選択肢を事前に決められないので、値は自由に増える。そのぶん
 *  ・表記ゆれで同じものが別カテゴリに割れないこと(正規化)
 *  ・自動計算される列と同じ名前を作らせないこと(読み直しで消えるため)
 * の2つが要になる。実コードから抽出した関数で確かめる。
 */
const { normalizeClassValue, isReservedColumn, ATTR_INFO, REF_PREFIX, HIST_PREFIX } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n); };
const eq = (a, b, n) => ok(a === b, n + "  (" + JSON.stringify(a) + ")");

/* ---------- 値の正規化 ---------- */
eq(normalizeClassValue("花崗岩"), "花崗岩", "そのままの値は変わらない");
eq(normalizeClassValue("  花崗岩  "), "花崗岩", "前後の半角空白を落とす");
eq(normalizeClassValue("　花崗岩　"), "花崗岩", "前後の全角空白も落とす");
eq(normalizeClassValue("本丸  東面"), "本丸 東面", "連続する空白は1つにまとめる");
eq(normalizeClassValue("本丸　東面"), "本丸 東面", "全角空白も半角1つに揃える");
eq(normalizeClassValue("ＡＢＣ"), "ABC", "全角英字を半角に揃える");
eq(normalizeClassValue("１２３"), "123", "全角数字を半角に揃える");
eq(normalizeClassValue(""), "", "空文字は空文字のまま");
eq(normalizeClassValue("   "), "", "空白だけなら空になる(未入力と同じ扱い)");
eq(normalizeClassValue(null), "", "nullでも落ちない");
eq(normalizeClassValue(undefined), "", "undefinedでも落ちない");
eq(normalizeClassValue(12), "12", "数値を渡しても文字列になる");

/* 異体字は揃えない。機械で同じものと判断できないため、
   ここで無理に寄せると別の石種を勝手に統合してしまう */
ok(normalizeClassValue("花崗岩") !== normalizeClassValue("花コウ岩"),
   "漢字とカタカナ交じりは別の値のまま(統合は利用者が行う)");

/* 同じ値に揃うことの確認: 表記ゆれの主因である空白と全角半角は吸収される */
ok(normalizeClassValue(" 安山岩") === normalizeClassValue("安山岩　"),
   "前後の空白違いは同じ値になる");

/* ---------- 予約列名 ---------- */
for (const name of ["Width", "Height", "Area", "Tilt", "RectAngle", "Flatness",
                    "SelfIntersect", "Note", "HasNote", "SrcID", "Course", "Dataset",
                    "X", "Y", "Z", "FillRate", "Aspect"]) {
  ok(isReservedColumn(name, ""), "自動計算・仕組み用の列は使えない: " + name);
}
ok(Object.keys(ATTR_INFO).every((k) => isReservedColumn(k, "")),
   "ATTR_INFOに載っている列はすべて予約(将来増えても取りこぼさない)");

ok(isReservedColumn("id", ""), "小文字の id も使えない");

/* 前回の記録(§9.2)は「前回:」を付けた列として重ねる。同じ名前で分類の列を
   作れてしまうと、重ね直したときに手で入れた値が消える */
ok(REF_PREFIX === "前回:", "前回の記録の接頭辞は「前回:」");
ok(isReservedColumn(REF_PREFIX + "Note", ""), "前回の記録の列名は使えない: 前回:Note");
ok(isReservedColumn(REF_PREFIX + "石種", ""), "前回の記録の列名は使えない: 前回:石種");
ok(isReservedColumn(REF_PREFIX, ""), "接頭辞だけでも使えない");
ok(!isReservedColumn("前回の所見", ""), "「前回」で始まるだけの名前は使える(接頭辞ではない)");
ok(!isReservedColumn("石種", ""), "ふつうの名前は使える(対照)");

/* 履歴の集計列(§5.1.5)も同じ理由で予約する。作り直すたびに消えるため、
   同じ名前で分類の列を作ると手で入れた値が失われる */
ok(HIST_PREFIX === "履歴:", "履歴の集計列の接頭辞は「履歴:」");
ok(isReservedColumn(HIST_PREFIX + "記録回数", ""), "履歴の集計列名は使えない: 履歴:記録回数");
ok(isReservedColumn(HIST_PREFIX + "最終記録日", ""), "履歴の集計列名は使えない: 履歴:最終記録日");
ok(!isReservedColumn("履歴メモ", ""), "「履歴」で始まるだけの名前は使える(接頭辞ではない)");
ok(isReservedColumn("ID", ""), "大文字の ID も使えない");
ok(isReservedColumn("", ""), "空の名前は使えない");
ok(isReservedColumn("   ", ""), "空白だけの名前も使えない");
ok(isReservedColumn(null, ""), "nullでも落ちずに拒否する");

ok(isReservedColumn("石番号", "石番号"), "いま選んでいるID列の名前も使えない");
ok(!isReservedColumn("石番号", "SrcID"), "ID列でなければ使える");

ok(!isReservedColumn("石種", ""), "石種は使える");
ok(!isReservedColumn("エリア", ""), "エリアは使える");
ok(!isReservedColumn("劣化度", ""), "劣化度は使える");
ok(!isReservedColumn("width", ""), "小文字のwidthは別の列として使える(計算列はWidth)");

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
