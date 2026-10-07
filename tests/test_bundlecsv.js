"use strict";
/*
 * 点検データのCSVまわり。
 *
 * 1. データ名(Dataset列) ---------------------------------------------------
 * 属性CSVには付いていたのに、点検データの台帳には付いていなかった。
 * 同じ台帳を2か所で別々に組み立てていたためで、ZIPから開き直すと
 * データ名が空に戻っていた。**両方が ledgerCSV を通ること**を担保する。
 *
 * 2. 記録CSVのファイル名 ---------------------------------------------------
 * 持ち寄って1つのZIPにまとめるとき、全員が「記録.csv」だと重なって
 * 入れられない。日と人を名前に入れて重ならないようにする。
 */
const { ledgerCSV, recordFileName, rowsToCSV } = require("./extracted.js");

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

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
