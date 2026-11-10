"use strict";
/*
 * 分類の列(手入力)の検証。
 *
 * 選択肢を事前に決められないので、値は自由に増える。そのぶん
 *  ・表記ゆれで同じものが別カテゴリに割れないこと(正規化)
 *  ・自動計算される列と同じ名前を作らせないこと(読み直しで消えるため)
 * の2つが要になる。実コードから抽出した関数で確かめる。
 */
const { normalizeClassValue, isReservedColumn, ATTR_INFO, REF_PREFIX, HIST_PREFIX,
        classChipNextValue, classChoices, recordHeaderColumns,
        SURVEY_DATE_COL, SURVEYOR_COL } = require("./extracted.js");

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


/* ---------- チップをもう一度押すと外れる ---------- */
/* 点検項目のように値が「該当」1つしかない列では、チップがチェックボックス
   そのものになる。押して付け、もう一度押して外せないと、外すために
   「空にする」を探すことになり、項目の数だけ余計な操作が増える */
{
  const eqv = (a, b, n) => ok(a === b, n + "  (" + JSON.stringify(a) + ")");
  eqv(classChipNextValue([], "該当"), "該当", "まだ何も付いていなければ、その値を書く");
  eqv(classChipNextValue([""], "該当"), "該当", "空なら、その値を書く");
  eqv(classChipNextValue(["該当"], "該当"), "", "**同じ値をもう一度押すと外れる**");
  eqv(classChipNextValue(["非該当"], "該当"), "該当", "別の値が付いていれば、押した値に変える");
  eqv(classChipNextValue(new Set(["該当"]), "該当"), "", "Setで渡しても同じ(呼び出し側はSet)");

  // 複数選択で値が混ざっているとき。いきなり空にすると、
  // 「揃えたいだけ」の操作で**書いてあるものまで消える**
  eqv(classChipNextValue(["該当", ""], "該当"), "該当", "**混ざっていれば、まず揃える**(空にしない)");
  eqv(classChipNextValue(["該当", "非該当"], "該当"), "該当", "別の値が混ざっていても揃える");
  eqv(classChipNextValue(["該当", "該当"], "該当"), "", "全部同じなら外れる");

  // 「空にする」チップは常に空
  eqv(classChipNextValue(["該当"], ""), "", "空を押せば空のまま");
  eqv(classChipNextValue([], ""), "", "何も付いていないときに空を押しても空");

  // 壊れた入力
  eqv(classChipNextValue(null, "該当"), "該当", "nullでも落ちない");
  eqv(classChipNextValue([null, null], "該当"), "該当", "値がnullなら、まだ付いていない扱い");
  eqv(classChipNextValue(["該当"], null), "", "押した値がnullなら空");
}

/* ---------- 外した値を候補に残す ---------- */
/* 候補はデータに実際にある値から作るので、**最後の1つを外すと候補ごと消え**、
   押し直す場所が無くなる。付け外しを繰り返す点検項目では行き止まりになる */
{
  const j = (a) => JSON.stringify(a);
  ok(j(classChoices([["該当", 3]], null)) === j([["該当", 3]]),
     "今回使った値が無ければ、データのままを返す");
  ok(j(classChoices([], new Set(["該当"]))) === j([["該当", 0]]),
     "**0件でも、今回使った値は候補に残す**");
  ok(j(classChoices([["該当", 2]], new Set(["該当"]))) === j([["該当", 2]]),
     "データにある値は二重に出さない(件数はデータ側を使う)");
  ok(j(classChoices([["該当", 2]], new Set(["非該当"]))) === j([["該当", 2], ["非該当", 0]]),
     "データにある値が先、今回だけの値が後ろ");
  ok(j(classChoices([], [])) === j([]), "どちらも空なら空");
  ok(j(classChoices(null, null)) === j([]), "nullでも落ちない");
  {
    const src = [["該当", 1]];
    classChoices(src, new Set(["非該当"]));
    ok(j(src) === j([["該当", 1]]), "**元の配列を書き換えない**(呼び出しごとに増えていかない)");
  }
}

/* ---------- 記録CSVのヘッダ(作っただけの列を消さない) ---------- */
/* 列を作って値を入れないままZIPを保存すると、台帳からは手入力列として外れ、
   記録の行にも現れないため、**作った列ごと消えていた**。
   点検項目を先に用意して翌日書き足す使い方が成立しない */
{
  const j = (a) => JSON.stringify(a);
  ok(j(recordHeaderColumns([["Note"], ["点検:ひび割れ"]])) === j(["Note", "点検:ひび割れ"]),
     "**値が無い列もヘッダに残す**(複数の一覧をつなぐ)");
  ok(j(recordHeaderColumns([["Note", "石種"], ["石種", "Note"]])) === j(["Note", "石種"]),
     "重複は落とし、最初に出た順を保つ");
  ok(j(recordHeaderColumns([["ID", SURVEY_DATE_COL, SURVEYOR_COL, "Note"]])) === j(["Note"]),
     "**鍵の3列は値の列ではない**ので外す");
  ok(j(recordHeaderColumns([])) === j([]), "空なら空");
  ok(j(recordHeaderColumns(null)) === j([]), "nullでも落ちない");
  ok(j(recordHeaderColumns([null, undefined, ["Note"]])) === j(["Note"]),
     "中身がnullの一覧が混じっても落ちない");
  ok(j(recordHeaderColumns([["", "  ", "Note"]])) === j(["Note"]),
     "空や空白だけの列名は拾わない");
  ok(j(recordHeaderColumns([[" Note "]])) === j(["Note"]), "前後の空白は落とす");
  ok(j(recordHeaderColumns([["ID"]])) === j([]), "鍵だけなら値の列は無い");
}

/* ---------- 記録の鍵の列名 ---------- */
/* 記録の行は { ID, 点検日, 点検者 } に値の列を足して組む。同じ名前の点検項目が
   あると鍵を上書きする。実際に「点検者」という点検項目を作れてしまい、
   **記録の点検者名が「あり」に置き換わっていた** */
ok(isReservedColumn(SURVEYOR_COL, ""), "**「点検者」は手入力の列に使えない**(記録の鍵を上書きする)");
ok(isReservedColumn(SURVEY_DATE_COL, ""), "**点検日の列名も使えない**");
ok(isReservedColumn(" " + SURVEYOR_COL + " ", ""), "前後に空白があっても同じ");
ok(!isReservedColumn("確認者", ""), "似た意味の別名は使える");
ok(!isReservedColumn("点検者メモ", ""), "鍵の名前を含むだけの列は使える");

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
