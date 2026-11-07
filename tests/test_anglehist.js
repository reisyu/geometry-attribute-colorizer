"use strict";
/*
 * 傾きラインの分布(ステップ4のヒストグラム)。
 *
 * 凡例のヒストグラムは**色分けに使った範囲**で数えるが、こちらは
 * -45〜+45 に固定する。矩形回転角の値域そのもので、線は常にこの範囲で
 * 色が付いているため、目盛りと図を一致させる必要がある。
 *
 * 母体は**線を描いたオブジェクトだけ**。フィルタで消えたものと、
 * rectLine を持たないもの(extras の無い古いGLBなど)は入らない。
 * **数が全体と一致しないことがある**ので total を返し、画面に n として出す。
 * 「判定できないときは何も出さない / 精度の限界は必ず画面に出す」(CLAUDE.md)。
 */
const { angleHistogram, RECTLINE_HIST_BINS } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };
const eq = (a, b, n) => ok(a === b, n + "  (" + JSON.stringify(a) + ")");

/* ---------- ビンの割り当て ---------- */
{
  // 4ビンなら -45〜-22.5 / -22.5〜0 / 0〜22.5 / 22.5〜45
  const h = angleHistogram([-45, -10, 10, 45], 4);
  eq(JSON.stringify(h.counts), "[1,1,1,1]", "4ビンに1つずつ入る");
  eq(h.total, 4, "total は数えた個数");
}
{
  const h = angleHistogram([0], 4);
  eq(JSON.stringify(h.counts), "[0,0,1,0]", "**0°は中央の右側のビン**(境界は上のビンへ)");
}
{
  const h = angleHistogram([-45], 4);
  eq(JSON.stringify(h.counts), "[1,0,0,0]", "下端 -45° は先頭のビン");
}
{
  const h = angleHistogram([45], 4);
  eq(JSON.stringify(h.counts), "[0,0,0,1]", "**上端 +45° は最後のビン**(はみ出して落ちない)");
}

/* ---------- 範囲外 ---------- */
/* 正方形問題(Width≒Height で水平辺の判定が反転する既知の限界)や、
   将来の計算変更で ±45 を超える値が来ても落とさない。凡例のヒストグラムと
   同じく**端のビンに積む**。黙って捨てると個数が合わなくなる */
{
  const h = angleHistogram([-90, -46, 46, 180], 4);
  eq(JSON.stringify(h.counts), "[2,0,0,2]", "**範囲外は端のビンに積む**(捨てない)");
  eq(h.total, 4, "範囲外も total に数える");
}

/* ---------- 数でない値 ---------- */
/* rectLine.angle は復元経路によっては欠けうる。NaN をそのまま入れると
   Math.floor(NaN) で先頭ビンに化けるので、数えないほうが正しい */
{
  const h = angleHistogram([0, NaN, null, undefined, "", "   ", "x", true, Infinity, -Infinity], 4);
  eq(h.total, 1, "**数でない値は数えない**(NaNが先頭ビンに化けるのを防ぐ)");
  eq(JSON.stringify(h.counts), "[0,0,1,0]", "数えたのは 0° の1つだけ");
}
{
  // Number(null) も Number("") も 0 になる。素通しすると**0°として数えてしまい**、
  // 中央のビンが実際より高く出る。画面上は正しく見えるので気づけない
  eq(angleHistogram([null], 4).total, 0, "**null を 0° と数えない**");
  eq(angleHistogram([""], 4).total, 0, "**空文字を 0° と数えない**");
  eq(angleHistogram(["  "], 4).total, 0, "空白だけの文字列も数えない");
  eq(angleHistogram([false], 4).total, 0, "false を 0° と数えない");
}
{
  const h = angleHistogram(["12.5"], 4);
  eq(h.total, 1, "数として読める文字列は数える");
}

/* ---------- 空・壊れた入力 ---------- */
{
  const h = angleHistogram([], 4);
  eq(JSON.stringify(h.counts), "[0,0,0,0]", "空でもビンは返る");
  eq(h.total, 0, "空なら total は0");
}
ok(angleHistogram(null, 4).total === 0, "null でも落ちない");
ok(angleHistogram(undefined, 4).total === 0, "undefined でも落ちない");
{
  const h = angleHistogram([0], 0);
  eq(h.counts.length, 1, "ビン数0なら1本にまとめる(0除算を避ける)");
  const h2 = angleHistogram([0], undefined);
  eq(h2.counts.length, 1, "ビン数未指定でも落ちない");
  const h3 = angleHistogram([0], -5);
  eq(h3.counts.length, 1, "負のビン数でも落ちない");
}
{
  const h = angleHistogram([0], 2.7);
  eq(h.counts.length, 2, "小数のビン数は切り捨てる");
}

/* ---------- 実際に使う本数 ---------- */
eq(RECTLINE_HIST_BINS, 24, "**凡例のヒストグラムと同じ24本**(並べて読むため)");
{
  const h = angleHistogram([-45, 0, 45], RECTLINE_HIST_BINS);
  eq(h.counts.length, 24, "24本で返る");
  eq(h.counts.reduce((a, b) => a + b, 0), 3, "合計は数えた個数と一致する");
  eq(h.total, 3, "total も一致する");
}
{
  // 全部同じ値でも maxCount の計算(描画側)が0除算にならない形か
  const h = angleHistogram([10, 10, 10], RECTLINE_HIST_BINS);
  eq(Math.max(...h.counts), 3, "同じ値は1本のビンに集まる");
}

/* ---------- 左右の偏り(この図を出す目的) ---------- */
/* 積み方が左に傾いているか右に傾いているかを読み取るための図なので、
   符号の取り違えがあってはいけない */
{
  const h = angleHistogram([-30, -30, -30, 20], 4);
  const left = h.counts[0] + h.counts[1];
  const right = h.counts[2] + h.counts[3];
  ok(left === 3 && right === 1, "**マイナスは左、プラスは右**(符号を取り違えない)",
     JSON.stringify(h.counts));
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
