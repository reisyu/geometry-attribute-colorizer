"use strict";
/*
 * 選択オブジェクトの太い輪郭線の検証。
 *
 * WebGLはlineWidthを無視するため、線分1本を板(2三角形)に展開し、
 * 頂点シェーダが画面座標で太さを与えている。ここでは
 *  ・輪郭 → 線分の並び      (contourToSegments)
 *  ・線分の並び → 頂点属性  (thickLineAttributes)
 * を実コードから抽出して確かめ、最後に頂点シェーダと同じ計算をJSで再現して、
 * 出来上がる板が指定したpx幅になることを確認する。
 */
const { contourToSegments, thickLineAttributes } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n); };
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps);

/* ---------- 輪郭 → 線分 ---------- */
const ring = [0, 0, 0, 1, 0, 0, 1, 1, 0];   // 三角形(3頂点)
const seg3 = contourToSegments(ring);
ok(seg3.length === 3 * 6, "3頂点の輪郭は3本の線分になる(閉じる分を含む)");
ok(seg3[0] === 0 && seg3[3] === 1, "1本目は 頂点0 → 頂点1");
ok(seg3[12] === 1 && seg3[13] === 1 && seg3[15] === 0 && seg3[16] === 0,
   "最後の1本は 頂点2 → 頂点0 で閉じる");

ok(contourToSegments([1, 2, 3]).length === 0, "1頂点だけなら線分は作らない");
ok(contourToSegments([]).length === 0, "空の輪郭でも例外にならない");

// 実際の石の輪郭に近い頂点数でも本数が合うこと
const many = [];
for (let i = 0; i < 24; i++) many.push(Math.cos(i), Math.sin(i), 0);
ok(contourToSegments(many).length / 6 === 24, "24頂点の輪郭は24本の線分になる");

/* ---------- 線分 → 頂点属性 ---------- */
const one = new Float32Array([0, 0, 0, 2, 0, 0]);   // x軸に沿った1本
const a = thickLineAttributes(one);
ok(a.position.length === 4 * 3, "1本の線分から4頂点");
ok(a.index.length === 6, "1本の線分から2三角形(6インデックス)");
ok(a.aStart.length === 4 * 3 && a.aEnd.length === 4 * 3, "始点・終点は4頂点すべてが持つ");

let sameStart = true, sameEnd = true;
for (let v = 0; v < 4; v++) {
  for (let k = 0; k < 3; k++) {
    if (a.aStart[v * 3 + k] !== one[k]) sameStart = false;
    if (a.aEnd[v * 3 + k] !== one[3 + k]) sameEnd = false;
  }
}
ok(sameStart && sameEnd, "4頂点すべてが同じ始点・終点を指す(シェーダで向きを出すため)");

// aExpand: x=左右(±1), y=どちらの端か(-1=始点 / +1=終点)
const exp = Array.from(a.aExpand);
ok(exp[1] === -1 && exp[3] === -1 && exp[5] === 1 && exp[7] === 1,
   "前半2頂点が始点側、後半2頂点が終点側");
ok(exp[0] + exp[2] === 0 && exp[4] + exp[6] === 0,
   "各端に左右1つずつある(同じ側が2つだと板がねじれる)");

// position は自分が担当する端の座標
ok(a.position[0] === 0 && a.position[6] === 2, "positionは担当する端の座標(境界球の計算用)");

ok(thickLineAttributes(new Float32Array(0)).index.length === 0, "線分0本でも例外にならない");

/* インデックスの型: 頂点が65535を超えたら16bitでは足りない */
const small = thickLineAttributes(new Float32Array(6 * 100));
ok(small.index instanceof Uint16Array, "小さい図形は16bitインデックス");
const big = thickLineAttributes(new Float32Array(6 * 20000));   // 80000頂点
ok(big.index instanceof Uint32Array, "65535頂点を超えたら32bitインデックスに切り替わる");

/* 三角形が4頂点の範囲に収まっているか(はみ出すと別の線分を巻き込む) */
let idxOk = true;
for (let i = 0; i < small.index.length; i++) {
  const quad = Math.floor(i / 6) * 4;
  if (small.index[i] < quad || small.index[i] > quad + 3) idxOk = false;
}
ok(idxOk, "各三角形は自分の板の4頂点だけを参照する");

/* ---------- 頂点シェーダと同じ計算を再現して太さを確かめる ---------- */
/* index.html の vertexShader と同じ式。板が本当に uWidth px になるか、
   また端が線方向へ半分伸びているか(角の欠けを埋めるため)を見る */
function projectVertex(attrs, v, resX, resY, width) {
  const p = (arr, i) => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
  const s = p(attrs.aStart, v), e = p(attrs.aEnd, v);
  const ex = attrs.aExpand[v * 2], ey = attrs.aExpand[v * 2 + 1];
  const hx = resX / 2, hy = resY / 2;
  // 投影は恒等(w=1)として扱う: 板の広げ方だけを見たいため
  const ps = [s[0] * hx, s[1] * hy], pe = [e[0] * hx, e[1] * hy];
  const d = [pe[0] - ps[0], pe[1] - ps[1]];
  const len = Math.hypot(d[0], d[1]);
  const dir = len > 1e-5 ? [d[0] / len, d[1] / len] : [1, 0];
  const nrm = [-dir[1], dir[0]];
  const base = ey < 0 ? ps : pe;
  return [
    base[0] + (nrm[0] * ex + dir[0] * ey) * (width * 0.5),
    base[1] + (nrm[1] * ex + dir[1] * ey) * (width * 0.5),
  ];
}

const W = 6;
const q = [0, 1, 2, 3].map((v) => projectVertex(a, v, 2, 2, W));  // hx=hy=1 で実座標=px
ok(near(Math.abs(q[0][1] - q[1][1]), W), "始点側の板幅が指定どおり(" + W + "px)");
ok(near(Math.abs(q[2][1] - q[3][1]), W), "終点側の板幅が指定どおり(" + W + "px)");
ok(near(q[0][0], -W / 2) && near(q[2][0], 2 + W / 2),
   "端は線方向にも半分ずつ伸びる(角の欠けを埋めるため)");
ok(near(q[0][1], W / 2) && near(q[1][1], -W / 2),
   "始点側の2頂点が線をはさんで反対側にある(ねじれていない)");

/* 太さを倍にしたら板幅も倍になる(pxで効いていることの確認) */
const q2 = [0, 1].map((v) => projectVertex(a, v, 2, 2, W * 2));
ok(near(Math.abs(q2[0][1] - q2[1][1]), W * 2), "太さの指定がそのまま画面上の幅になる");

/* 斜めの線でも幅は変わらない(直交方向に広げているため) */
const diag = thickLineAttributes(new Float32Array([0, 0, 0, 1, 1, 0]));
const dq = [0, 1].map((v) => projectVertex(diag, v, 2, 2, W));
ok(near(Math.hypot(dq[0][0] - dq[1][0], dq[0][1] - dq[1][1]), W),
   "斜めの線分でも板幅は同じ");

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
