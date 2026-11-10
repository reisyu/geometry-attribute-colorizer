"use strict";
/*
 * 凡例の集計(§5.1.3)。
 *
 * 凡例は「数える」(legendModel)と「描く」(画面のDOM・SVG)に分けてある。
 * 以前は画面とSVGがそれぞれ自前で数えており、次の食い違いがあった。
 *   - 画面はCSVの全行、SVGのヒストグラムは書き出した石を数えていた。
 *     フィルタで84石だけ出しているのに、凡例は n=123 だった
 *   - SVGのヒストグラムは空欄を 0 として数えていた(Number("") は 0)
 *
 * **数えるのは図に出ている石だけ**(v1.40.6)。図に出ている石の行を渡すのは
 * 呼び出し側の責任で、ここでは渡された行だけを数える。
 */
const { legendModel, legendRowLabels, LEGEND_HIST_BINS, OTHER_COLOR } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };
const j = (a) => JSON.stringify(a);
const RED = [1, 0, 0], BLUE = [0, 0, 1], GREEN = [0, 1, 0];

/* ---------- 数値の列 ---------- */
{
  const style = { attr: "Area", numericMode: true, vmin: 0, vmax: 1 };
  const rows = [{ Area: "0.1" }, { Area: "0.6" }, { Area: "0.9" }, { Area: "1" }];
  const m = legendModel(rows, style, [], new Set(), 4);
  ok(m.numeric === true, "数値の列は数値の凡例");
  ok(m.n === 4, "n は値のある石の数", j(m.n));
  ok(j(m.bins.map((b) => b.count)) === "[1,0,1,2]", "ビンに振り分ける(上端は最後のビン)", j(m.bins.map((b) => b.count)));
  ok(m.bins[0].lo === 0 && m.bins[3].hi === 1, "ビンの端は範囲の端");
  ok(Math.abs(m.bins[1].mid - 0.375) < 1e-9, "ビンの中央値(色を決めるのに使う)");
  ok(m.bins.reduce((a, b) => a + b.count, 0) === m.n, "**ビンの合計は n と一致する**");
}
{
  // 空欄を 0 として数えない。SVG側は Number("") === 0 で、空欄が最初のビンに積まれていた
  const style = { attr: "Area", numericMode: true, vmin: 0, vmax: 1 };
  const m = legendModel([{ Area: "" }, { Area: "  " }, {}, { Area: null }, { Area: "x" }, { Area: "0.5" }], style, [], null, 4);
  ok(m.n === 1, "**空欄・空白・欠けた値・数でない値は数えない**", j(m.n));
  ok(m.bins[0].count === 0, "**空欄が 0 として最初のビンに積まれない**", j(m.bins.map((b) => b.count)));
}
{
  // 範囲外(手動範囲で絞ったとき)は端のビンに積む。黙って捨てると n と合わなくなる
  const style = { attr: "Area", numericMode: true, vmin: 0.2, vmax: 0.4 };
  const m = legendModel([{ Area: "0.1" }, { Area: "0.3" }, { Area: "5" }], style, [], null, 2);
  ok(j(m.bins.map((b) => b.count)) === "[2,1]", "範囲外は端のビンに積む", j(m.bins.map((b) => b.count)));
  ok(m.n === 3, "範囲外も n に数える");
}
{
  // 全部同じ値(範囲の幅が0)でも落ちない
  const m = legendModel([{ A: "3" }, { A: "3" }], { attr: "A", numericMode: true, vmin: 3, vmax: 3 }, [], null, 4);
  ok(m.n === 2 && m.bins.reduce((a, b) => a + b.count, 0) === 2, "範囲の幅が0でも落ちない");
}
{
  /* **範囲は数えた石から決め直さない。** フィルタを掛けるたびに色の対応が
     変わると、図を見比べられなくなる */
  const style = { attr: "A", numericMode: true, vmin: 0, vmax: 100 };
  const m = legendModel([{ A: "50" }], style, [], null, 4);
  ok(m.vmin === 0 && m.vmax === 100, "**範囲は渡された配色のまま**(数えた石で変えない)");
}
ok(LEGEND_HIST_BINS === 24, "画面とSVGのヒストグラムは24本(傾きの分布と揃える)");

/* ---------- カテゴリの列 ---------- */
{
  const style = { attr: "石種", numericMode: false };
  const colors = [["砂岩", RED], ["花崗岩", BLUE], ["安山岩", GREEN]];
  const rows = [{ 石種: "砂岩" }, { 石種: "砂岩" }, { 石種: "花崗岩" }, { 石種: "" }, {}];
  const m = legendModel(rows, style, colors, new Set(), 24);
  ok(m.numeric === false, "文字の列はカテゴリの凡例");
  ok(m.n === 3, "n は値のある石の数(未入力は入れない)", j(m.n));
  ok(m.blanks === 2, "未入力は別に数える", j(m.blanks));
  ok(j(m.items.map((i) => i.cat)) === j(["砂岩", "花崗岩"]), "**色を決めた順に並ぶ**", j(m.items.map((i) => i.cat)));
  ok(!m.items.some((i) => i.cat === "安山岩"), "**図に1つも無い値は出さない**(フィルタで消えた値が「(0)」で並ばない)");
  ok(m.others === null, "その他が無ければ null");
  ok(j(legendRowLabels(m).map((r) => r.text)) === j(["砂岩 (2)", "花崗岩 (1)", "未入力 (2)"]),
     "凡例の文言", j(legendRowLabels(m).map((r) => r.text)));
}
{
  // 「上位のみ色分け」で「その他」にまとめた値
  const style = { attr: "c", numericMode: false };
  const colors = [["a", RED], ["b", OTHER_COLOR], ["c", OTHER_COLOR], ["d", OTHER_COLOR]];
  const rows = [{ c: "a" }, { c: "b" }, { c: "b" }, { c: "c" }];
  const m = legendModel(rows, style, colors, new Set(["b", "c", "d"]), 24);
  ok(m.others && m.others.kinds === 2 && m.others.count === 3,
     "**その他の種類と件数は、図に出ている値だけ**(図に無い d は数えない)", j(m.others));
  ok(j(legendRowLabels(m).map((r) => r.text)) === j(["a (1)", "その他 2種 (3)"]), "その他は1行にまとめる",
     j(legendRowLabels(m).map((r) => r.text)));
  ok(legendRowLabels(m)[1].rgb === OTHER_COLOR, "その他は灰色");
}
{
  // 空文字の値は凡例に「(空欄)」と出す(空白だけの値は未入力として扱う)
  const m = legendModel([{ c: "a" }], { attr: "c", numericMode: false }, [["", RED], ["a", BLUE]], null, 24);
  ok(m.items.length === 1, "空文字の値は未入力側(カテゴリにしない)");
}

/* ---------- 図に出ている石だけを数える ---------- */
/* 呼び出し側が「図に出ている石の行」を渡す。フィルタで除外した石を渡さなければ、
   件数もヒストグラムもその図の内容と一致する */
{
  const style = { attr: "石種", numericMode: false };
  const colors = [["砂岩", RED], ["花崗岩", BLUE]];
  const all = [{ 石種: "砂岩" }, { 石種: "砂岩" }, { 石種: "花崗岩" }, { 石種: "花崗岩" }];
  const shown = all.slice(0, 2);   // フィルタで後ろ2石を除外した図
  const mAll = legendModel(all, style, colors, null, 24);
  const mShown = legendModel(shown, style, colors, null, 24);
  ok(mAll.n === 4 && mShown.n === 2, "**渡した石だけを数える**", j([mAll.n, mShown.n]));
  ok(j(legendRowLabels(mShown).map((r) => r.text)) === j(["砂岩 (2)"]),
     "**除外した石の値は、凡例の行から消える**", j(legendRowLabels(mShown).map((r) => r.text)));
}
{
  /* 画面とSVGで同じ石を渡せば、同じ文字列になる(§5.1.3)。
     描く側は legendRowLabels の文言をそのまま使う */
  const style = { attr: "c", numericMode: false };
  const colors = [["a", RED]];
  const rows = [{ c: "a" }, { c: "" }];
  const t1 = legendRowLabels(legendModel(rows, style, colors, null, 24)).map((r) => r.text);
  const t2 = legendRowLabels(legendModel(rows.slice(), style, colors, null, 24)).map((r) => r.text);
  ok(j(t1) === j(t2), "同じ石なら同じ文言(画面とSVGで食い違わない)");
}

/* ---------- 壊れた入力 ---------- */
{
  const m = legendModel(null, { attr: "x", numericMode: false }, null, null, 24);
  ok(m.n === 0 && m.items.length === 0 && m.blanks === 0, "行も色もnullでも落ちない");
  const m2 = legendModel([], { attr: "x", numericMode: true, vmin: 0, vmax: 1 }, [], null, 0);
  ok(m2.bins.length === 1 && m2.n === 0, "ビン数0でも1本にまとめて落ちない");
  const m3 = legendModel([null, undefined, { x: "1" }], { attr: "x", numericMode: true, vmin: 0, vmax: 1 }, [], null, 2);
  ok(m3.n === 1, "行に null が混ざっても落ちない");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
