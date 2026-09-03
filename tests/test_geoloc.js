"use strict";
/*
 * 現在地の目安表示の検証。
 *
 * 要は2つ。
 *  ・緯度経度 → 平面直角座標 の変換が正しいこと(latLonToJPRect)
 *  ・データがどの系で、CADのxyがどちら向きかを当てられること(estimateJPZone)
 *
 * 特に後者は「当てずっぽうの位置を出さない」ことが要になる。判定できない
 * 場合に null を返すところまで確かめる。
 */
const { latLonToJPRect, estimateJPZone, JP_ZONES, GEO_ACCEPT_M } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

/* 球面距離(検算用。投影とは別の式で求める) */
function haversine(a, b, c, d) {
  const R = 6371000, r = Math.PI / 180;
  const dp = (c - a) * r, dl = (d - b) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---------- 投影 ---------- */

let originsOk = true, worst = 0;
for (const z of Object.keys(JP_ZONES)) {
  const o = JP_ZONES[z];
  const p = latLonToJPRect(o[0], o[1], Number(z));
  worst = Math.max(worst, Math.abs(p.x), Math.abs(p.y));
  if (Math.abs(p.x) > 1e-6 || Math.abs(p.y) > 1e-6) originsOk = false;
}
ok(originsOk, "19系すべてで原点が (0,0) になる", "最大ずれ " + worst.toExponential(2) + "m");
ok(Object.keys(JP_ZONES).length === 19, "系は19個ある");

const north = latLonToJPRect(37, 139 + 50 / 60, 9);
ok(Math.abs(north.x - 110957) < 50 && Math.abs(north.y) < 1e-6,
   "9系の原点から北へ1度 → X≈110.96km / Y=0", "X=" + north.x.toFixed(1));

const east = latLonToJPRect(36, 140 + 50 / 60, 9);
ok(Math.abs(east.y - 90156) < 100 && east.x > 0 && east.x < 1000,
   "9系の原点から東へ1度 → Y≈90.16km", "Y=" + east.y.toFixed(1));

ok(latLonToJPRect(35, 135, 0) === null, "存在しない系(0)ではnullを返す");
ok(latLonToJPRect(35, 135, 20) === null, "存在しない系(20)ではnullを返す");

/* 近距離では、投影した平面距離が球面距離と一致する(0.1%以内) */
const A = [34.9, 135.75], B = [34.9018, 135.7522];
const pa = latLonToJPRect(A[0], A[1], 5), pb = latLonToJPRect(B[0], B[1], 5);
const planar = Math.hypot(pb.x - pa.x, pb.y - pa.y);
const sphere = haversine(A[0], A[1], B[0], B[1]);
ok(Math.abs(planar - sphere) / sphere < 0.001,
   "近距離の平面距離が球面距離と一致する",
   "平面 " + planar.toFixed(2) + "m / 球面 " + sphere.toFixed(2) + "m");

/* 北へ動けばXが増え、東へ動けばYが増える(符号の取り違えを防ぐ) */
const base = latLonToJPRect(35.0, 135.0, 5);
const up = latLonToJPRect(35.01, 135.0, 5);
const right = latLonToJPRect(35.0, 135.01, 5);
ok(up.x > base.x && Math.abs(up.y - base.y) < 20, "北へ動くとXが増える(X=北)");
ok(right.y > base.y && Math.abs(right.x - base.x) < 20, "東へ動くとYが増える(Y=東)");

/* ---------- 系の推定 ---------- */

/* 現地(奈良県付近, 6系の範囲)に立っていて、データも同じ場所にある場合 */
const site = [34.685, 135.805];                 // 緯度経度
const truth = latLonToJPRect(site[0], site[1], 6);   // 6系での座標

// (1) CADが 測量どおり (x=北, y=東) で入っている場合
let g = estimateJPZone(site[0], site[1], truth.x + 30, truth.y - 20);
ok(g && g.zone === 6 && g.swap === false, "系と軸の並びを当てる(x=北, y=東)",
   g ? "系" + g.zone + " swap=" + g.swap + " 距離" + g.dist.toFixed(0) + "m" : "null");

// (2) CADが図面向き (x=東, y=北) で入っている場合
g = estimateJPZone(site[0], site[1], truth.y + 10, truth.x + 15);
ok(g && g.zone === 6 && g.swap === true, "系と軸の並びを当てる(x=東, y=北)",
   g ? "系" + g.zone + " swap=" + g.swap : "null");

// (3) 別の系のデータ(9系の座標を持つデータを、6系の現地で開いた)
const other = latLonToJPRect(35.7, 139.7, 9);
ok(estimateJPZone(site[0], site[1], other.x, other.y) === null,
   "遠い場所のデータでは判定しない(nullを返す)");

// (4) 平面直角座標ではないデータ(ローカル座標)
ok(estimateJPZone(site[0], site[1], 0, 0) === null, "原点付近のローカル座標では判定しない");
ok(estimateJPZone(site[0], site[1], 12.5, -3.2) === null, "小さなローカル座標では判定しない");

// (5) 許容距離のちょうど内側/外側
const inside = estimateJPZone(site[0], site[1], truth.x + GEO_ACCEPT_M * 0.9, truth.y);
ok(inside && inside.zone === 6, "許容距離の内側なら判定する", "距離 " + (GEO_ACCEPT_M * 0.9) + "m");
const outside = estimateJPZone(site[0], site[1], truth.x + GEO_ACCEPT_M * 1.2, truth.y);
ok(outside === null, "許容距離の外側では判定しない");

/* (6) すべての系で、その系の現地に立てば正しく当たる。
   系を1つでも書き間違えていれば、ここで落ちる */
let allZonesOk = true;
const wrong = [];
for (const z of Object.keys(JP_ZONES)) {
  const zone = Number(z);
  const o = JP_ZONES[z];
  const here = [o[0] + 0.01, o[1] + 0.01];         // 原点から約1.4km
  const t = latLonToJPRect(here[0], here[1], zone);
  const r = estimateJPZone(here[0], here[1], t.x, t.y);
  if (!r || r.zone !== zone || r.swap !== false) { allZonesOk = false; wrong.push(z); }
}
ok(allZonesOk, "19系すべて、その系の現地なら正しく当たる", wrong.length ? "外れ: " + wrong.join(",") : "");

/* (7) 軸を入れ替えたデータでも、19系すべてで当たる */
let allSwapOk = true;
for (const z of Object.keys(JP_ZONES)) {
  const zone = Number(z);
  const o = JP_ZONES[z];
  const here = [o[0] + 0.01, o[1] + 0.01];
  const t = latLonToJPRect(here[0], here[1], zone);
  const r = estimateJPZone(here[0], here[1], t.y, t.x);
  if (!r || r.zone !== zone || r.swap !== true) allSwapOk = false;
}
ok(allSwapOk, "19系すべて、軸を入れ替えたデータでも当たる");

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
