"use strict";
/*
 * ブラシ選択の当たり判定の検証。
 *
 * pointermoveは飛び飛びに届くため、判定は「点」ではなく「前回位置→今回位置の
 * 線分」との距離で行う。点で判定すると、速くなぞったときに間の石が抜ける。
 * ここでは実コードから抽出した distToSegmentSq を確かめる。
 */
const { distToSegmentSq } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

/* ---------- 基本 ---------- */
ok(near(distToSegmentSq(0, 0, 0, 0, 10, 0), 0), "線分上の点は距離0");
ok(near(distToSegmentSq(5, 3, 0, 0, 10, 0), 9), "線分の真横は垂線の長さ");
ok(near(distToSegmentSq(5, -3, 0, 0, 10, 0), 9), "反対側でも同じ距離");

/* ---------- 端の外側は端点までの距離になる(線ではなく線分であること) ---------- */
ok(near(distToSegmentSq(-4, 0, 0, 0, 10, 0), 16), "始点より手前は始点までの距離");
ok(near(distToSegmentSq(14, 0, 0, 0, 10, 0), 16), "終点より先は終点までの距離");
ok(near(distToSegmentSq(-3, 4, 0, 0, 10, 0), 25), "端の外側は斜めでも端点基準");
// 無限直線として扱うと 0 や 16 ではなく別の値になる。ここが崩れると
// 「なぞっていない延長線上の石まで拾う」ことになる
ok(distToSegmentSq(30, 0, 0, 0, 10, 0) > 100, "延長線上の遠い点を拾わない");

/* ---------- 長さ0の線分(押した瞬間・止めたまま) ---------- */
ok(near(distToSegmentSq(3, 4, 0, 0, 0, 0), 25), "長さ0でも点との距離になる(0除算しない)");
ok(near(distToSegmentSq(0, 0, 7, 7, 7, 7), 98), "長さ0・離れた位置でも有限の値");

/* ---------- 斜めの線分 ---------- */
ok(near(distToSegmentSq(0, 0, -1, 1, 1, 1), 1), "斜めでない水平線の垂線");
const d = distToSegmentSq(0, 2, 0, 0, 2, 2);   // 線分 y=x 上への距離
ok(near(d, 2), "45度の線分への垂線の2乗距離");

/* ---------- 速くなぞったときの取りこぼし ---------- */
/* 40px離れた2点の間に重心がある石は、点判定(半径16)では拾えないが
   線分判定なら拾える。ブラシがこの性質を持つことを固定する */
const R2 = 16 * 16;
const midStone = [20, 3];
const p0 = [0, 0], p1 = [40, 0];
ok(distToSegmentSq(midStone[0], midStone[1], p0[0], p0[1], p0[0], p0[1]) > R2,
   "点だけの判定では間の石を拾えない");
ok(distToSegmentSq(midStone[0], midStone[1], p0[0], p0[1], p1[0], p1[1]) <= R2,
   "線分で判定すれば間の石を拾える");

/* 逆に、なぞった線から離れた石は拾わない(巻き込み防止) */
ok(distToSegmentSq(20, 40, p0[0], p0[1], p1[0], p1[1]) > R2, "離れた石は拾わない");

/* ---------- 対称性 ---------- */
const a = distToSegmentSq(5, 9, 0, 0, 10, 0);
const b = distToSegmentSq(5, 9, 10, 0, 0, 0);
ok(near(a, b), "線分の向きを逆にしても同じ距離");

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
