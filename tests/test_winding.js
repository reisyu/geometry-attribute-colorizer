"use strict";
/*
 * GLB書き出し時の三角形巻き順反転の検証。
 *
 * 重要: 反転処理は index.html の flipTriangleWinding を extracted.js 経由で
 * そのまま呼ぶ。以前はこのファイル内に同じ処理の写しを置いていたため、
 * index.html 側を変更してもテストが永久に成功する状態になっていた。
 */
const F = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`  ${c ? "OK" : "NG!!"}: ${n}`); };

function triNormal(pos, i0, i1, i2) {
  const ax = pos[i1*3]-pos[i0*3], ay = pos[i1*3+1]-pos[i0*3+1], az = pos[i1*3+2]-pos[i0*3+2];
  const bx = pos[i2*3]-pos[i0*3], by = pos[i2*3+1]-pos[i0*3+1], bz = pos[i2*3+2]-pos[i0*3+2];
  return [ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx];
}

// 五角形の扇形分割(輪郭メッシュと同じ構造)
const pos = new Float32Array([1,0,0, 0.31,0,0.95, -0.81,0,0.59, -0.81,0,-0.59, 0.31,0,-0.95]);
const index = new Uint16Array([0,1,2, 0,2,3, 0,3,4]);

const flipped = F.flipTriangleWinding(index);   // ← index.html の実装そのもの

// 全三角形の法線が反転しているか
let allFlipped = true;
for (let t = 0; t < index.length; t += 3) {
  const a = triNormal(pos, index[t], index[t+1], index[t+2]);
  const b = triNormal(pos, flipped[t], flipped[t+1], flipped[t+2]);
  const dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  if (dot >= 0) allFlipped = false;
}
ok(allFlipped, "巻き順反転で全三角形の法線が反転する");

// 反転しても頂点集合・三角形数は不変(形状が壊れない)
ok(flipped.length === index.length, "インデックス数が不変");
const tris = (arr) => {
  const s = new Set();
  for (let t = 0; t < arr.length; t += 3) s.add([arr[t],arr[t+1],arr[t+2]].sort().join("-"));
  return s;
};
const t1 = tris(index), t2 = tris(flipped);
ok(t1.size === t2.size && [...t1].every(x => t2.has(x)), "三角形の集合が同一(形状不変)");

// 元の配列を破壊しない(exportGLBは元ジオメトリを再利用するため必須)
ok(index[1] === 1 && index[2] === 2, "入力配列を破壊しない");

// 型が保たれる(GLBのcomponentType選択が型に依存するため)
ok(flipped instanceof Uint16Array, "Uint16Arrayの型が保たれる");
ok(F.flipTriangleWinding(new Uint32Array([0,1,2])) instanceof Uint32Array, "Uint32Arrayの型が保たれる");

// 2回反転すると元に戻る(対合性)
const twice = F.flipTriangleWinding(flipped);
ok([...twice].every((v, i) => v === index[i]), "2回反転で元に戻る");

console.log(`\n===== ${pass}成功 / ${fail}失敗 =====`);
process.exit(fail ? 1 : 0);
