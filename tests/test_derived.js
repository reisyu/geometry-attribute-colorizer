"use strict";
/*
 * 今回の入力から作る列(§5.1.8)。
 *
 * メモと点検項目の値から、3つの列を決まった順に作り直す。
 *   1. 該当項目    点検項目の値から
 *   2. メモの有無  メモ本文から
 *   3. 記録の状況  今回の記録と前回の記録から(前回を見るので最後)
 *
 * 以前は3つを別々の関数で作り、呼ぶ側が組み合わせていた。組み合わせ方が
 * 場所ごとに違い、次のことが起きた。
 *   - 「該当項目」をメモ用の関数に相乗りさせたら、メモの列が無い起動直後に走らなかった
 *   - 控えから復元したとき、「該当項目」と「記録の状況」を作り直していなかった
 *   - 「記録の状況」は前回の列より後に作る必要があり、順番の注意書きが3か所にあった
 * 作る場所を1つにしたので、順番と組み合わせをここで検査できる。
 */
const { deriveInputColumns, NOTE_COL, NOTE_FLAG_COL, HIT_COL, HIT_MULTI, HIT_NONE,
        COMBO_COL, COMBO_PREV, COMBO_BOTH, COMBO_NOW, COMBO_NONE,
        REF_PREFIX, HIST_PREFIX, NOTE_YES } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };
const j = (a) => JSON.stringify(a);
const S = new Set(["はらみ出し", "ひび割れ"]);
const clone = (rows) => rows.map((r) => ({ ...r }));

/* ---------- 起動直後(点検項目もメモも無い) ---------- */
{
  const rows = [{ ID: "1", Width: "0.5" }, { ID: "2", Width: "0.7" }];
  const r = deriveInputColumns(rows, ["ID", "Width"], new Set(), "ID");
  ok(r.columns.includes(HIT_COL), "**点検項目が無くても「該当項目」を作る**(押しても断られないように)", j(r.columns));
  ok(rows.every((x) => x[HIT_COL] === HIT_NONE), "全石が「なし」");
  ok(!r.columns.includes(NOTE_FLAG_COL), "メモの列が無ければ「メモの有無」は作らない");
  ok(!r.columns.includes(COMBO_COL), "記録に使う列が1つも無ければ「記録の状況」は作らない");
  ok(r.changed === true, "列が増えたら changed は真");
}

/* ---------- 点検項目だけで記録する(メモを書かない) ---------- */
{
  const rows = [{ ID: "1", "はらみ出し": "あり" }, { ID: "2", "はらみ出し": "" }, { ID: "3", "はらみ出し": "あり", "ひび割れ": "あり" }];
  const r = deriveInputColumns(rows, ["ID", "はらみ出し", "ひび割れ"], S, "ID");
  ok(j(rows.map((x) => x[HIT_COL])) === j(["はらみ出し", HIT_NONE, HIT_MULTI]), "該当項目: 1つなら項目名、2つ以上なら複数", j(rows.map((x) => x[HIT_COL])));
  ok(r.columns.includes(COMBO_COL), "**メモの列が無くても「記録の状況」を作る**");
  ok(j(rows.map((x) => x[COMBO_COL])) === j([COMBO_NOW, COMBO_NONE, COMBO_NOW]), "**印だけの石は「今回のみ」**", j(rows.map((x) => x[COMBO_COL])));
  ok(!r.columns.includes(NOTE_FLAG_COL), "メモの有無は作らない");
}

/* ---------- メモ ---------- */
{
  const rows = [{ ID: "1", [NOTE_COL]: "割れあり" }, { ID: "2", [NOTE_COL]: "  " }, { ID: "3" }];
  const r = deriveInputColumns(rows, ["ID", NOTE_COL], new Set(), "ID");
  ok(j(rows.map((x) => x[NOTE_FLAG_COL])) === j([NOTE_YES, "なし", "なし"]), "メモの有無: 空白だけ・欠けた値は「なし」", j(rows.map((x) => x[NOTE_FLAG_COL])));
  ok(rows.every((x) => x[NOTE_FLAG_COL] !== undefined && x[NOTE_FLAG_COL] !== ""), "**全行に値を入れる**(空欄は欠損扱いで灰色になり、「なし」と区別できない)");
  ok(j(rows.map((x) => x[COMBO_COL])) === j([COMBO_NOW, COMBO_NONE, COMBO_NONE]), "メモだけでも「今回のみ」");
  ok(r.columns.indexOf(NOTE_FLAG_COL) < r.columns.indexOf(COMBO_COL), "**記録の状況は最後に作る**", j(r.columns));
}

/* ---------- 前回の記録があるとき ---------- */
{
  const P = REF_PREFIX;
  const cols = ["ID", "はらみ出し", NOTE_COL, P + "はらみ出し", P + NOTE_COL, P + NOTE_FLAG_COL];
  const rows = [
    { ID: "1", [P + "はらみ出し"]: "あり", [P + NOTE_FLAG_COL]: "なし" },                       // 前回の印だけ
    { ID: "2", [P + NOTE_COL]: "目地が開く", [P + NOTE_FLAG_COL]: "あり", "はらみ出し": "あり" },  // 前回メモ・今回印
    { ID: "3", [NOTE_COL]: "新しい割れ", [P + NOTE_FLAG_COL]: "なし" },                           // 今回メモだけ
    { ID: "4", [P + NOTE_FLAG_COL]: "なし" },                                                     // どちらも無し
  ];
  const r = deriveInputColumns(rows, cols, S, "ID");
  ok(j(rows.map((x) => x[COMBO_COL])) === j([COMBO_PREV, COMBO_BOTH, COMBO_NOW, COMBO_NONE]),
     "**前回のみ・前回と今回・今回のみ・記録なし**", j(rows.map((x) => x[COMBO_COL])));
  ok(rows[3][COMBO_COL] === COMBO_NONE, "**前回のメモの有無が「なし」でも、前回の記録にしない**");
}
{
  // 前回の記録を重ねただけで、今回はまだ何も無い。回り残しを見たいのは書く前
  const P = REF_PREFIX;
  const rows = [{ ID: "1", [P + NOTE_COL]: "割れ" }, { ID: "2", [P + NOTE_COL]: "" }];
  const r = deriveInputColumns(rows, ["ID", P + NOTE_COL], new Set(), "ID");
  ok(r.columns.includes(COMBO_COL), "**前回の記録を重ねただけでも「記録の状況」を作る**");
  ok(j(rows.map((x) => x[COMBO_COL])) === j([COMBO_PREV, COMBO_NONE]), "前回のみ・記録なし", j(rows.map((x) => x[COMBO_COL])));
}

/* ---------- 属性は記録にしない ---------- */
{
  const rows = [{ ID: "1", "石種": "花崗岩" }];
  const r = deriveInputColumns(rows, ["ID", "石種"], new Set(), "ID");
  ok(rows[0][HIT_COL] === HIT_NONE, "**属性(石種)は該当項目に数えない**");
  ok(!r.columns.includes(COMBO_COL), "属性だけでは「記録の状況」を作らない");
}
{
  // 記録の鍵や自動計算の列が、誤って点検項目に登録されていても数えない
  const weird = new Set(["はらみ出し", "点検者", "Width", NOTE_COL]);
  const rows = [{ ID: "1", "点検者": "山田", Width: "0.5" }];
  deriveInputColumns(rows, ["ID", "点検者", "Width", "はらみ出し"], weird, "ID");
  ok(rows[0][HIT_COL] === HIT_NONE, "**記録の鍵・自動計算の列は、該当項目に数えない**", rows[0][HIT_COL]);
}

/* ---------- 何度作り直しても同じ ---------- */
{
  const cols0 = ["ID", "はらみ出し", NOTE_COL];
  const rows = [{ ID: "1", "はらみ出し": "あり" }, { ID: "2", [NOTE_COL]: "割れ" }];
  const a = deriveInputColumns(rows, cols0, S, "ID");
  const snap = j(rows);
  const b = deriveInputColumns(rows, a.columns, S, "ID");
  ok(j(b.columns) === j(a.columns), "**2回目は列が変わらない**", j(b.columns));
  ok(b.changed === false, "**2回目は changed が偽**(選択肢を無駄に作り直さない)");
  ok(j(rows) === snap, "2回目は値も変わらない");
  ok(new Set(b.columns).size === b.columns.length, "列が重複しない");
}

/* ---------- 値を消したら戻る ---------- */
{
  const rows = [{ ID: "1", "はらみ出し": "あり" }];
  const a = deriveInputColumns(rows, ["ID", "はらみ出し"], S, "ID");
  rows[0]["はらみ出し"] = "";
  deriveInputColumns(rows, a.columns, S, "ID");
  ok(rows[0][HIT_COL] === HIT_NONE && rows[0][COMBO_COL] === COMBO_NONE, "印を外すと「なし」「記録なし」に戻る", j(rows[0]));
}

/* ---------- 列が無くなったら片付ける ---------- */
{
  // 点検項目を属性に変えた(記録に使う列が無くなった)
  const rows = [{ ID: "1", "はらみ出し": "あり", [COMBO_COL]: COMBO_NOW, [HIT_COL]: "はらみ出し" }];
  const r = deriveInputColumns(rows, ["ID", "はらみ出し", HIT_COL, COMBO_COL], new Set(), "ID");
  ok(!r.columns.includes(COMBO_COL) && rows[0][COMBO_COL] === undefined, "**記録に使う列が無くなったら「記録の状況」を消す**(値も残さない)", j(rows[0]));
  ok(rows[0][HIT_COL] === HIT_NONE, "該当項目は「なし」に戻る");
  ok(r.changed === true, "列が減ったら changed は真");
}
{
  const r = deriveInputColumns([], ["ID", HIT_COL, COMBO_COL], S, "ID");
  ok(!r.columns.includes(HIT_COL) && !r.columns.includes(COMBO_COL), "行が無ければ、該当項目も記録の状況も作らない", j(r.columns));
}

/* ---------- ほかの列には触らない ---------- */
{
  const cols0 = ["ID", "Width", "石種", "はらみ出し", HIST_PREFIX + "記録回数", REF_PREFIX + "はらみ出し"];
  const rows = [{ ID: "1", Width: "0.5", "石種": "砂岩", "はらみ出し": "あり", [HIST_PREFIX + "記録回数"]: 2, [REF_PREFIX + "はらみ出し"]: "あり" }];
  const keep = { ...rows[0] };
  const r = deriveInputColumns(rows, cols0, S, "ID");
  ok(cols0.every((c, i) => r.columns[i] === c), "**元の列の並びを変えない**(書き出すCSVの列の順が変わらない)", j(r.columns));
  ok(Object.keys(keep).every((k) => rows[0][k] === keep[k]), "**前回・履歴・属性の値に触らない**(読み込んだデータから作る列は別の場所で作る)");
  ok(j(cols0) === j(["ID", "Width", "石種", "はらみ出し", HIST_PREFIX + "記録回数", REF_PREFIX + "はらみ出し"]), "渡した列の配列を書き換えない");
}

/* ---------- 壊れた入力 ---------- */
{
  const r = deriveInputColumns(null, null, null, "");
  ok(j(r.columns) === "[]" && r.changed === false, "null でも落ちない", j(r));
  const r2 = deriveInputColumns([{}], ["ID"], ["はらみ出し"], "ID");
  ok(r2.columns.includes(HIT_COL), "点検項目の集合は配列でもよい");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
