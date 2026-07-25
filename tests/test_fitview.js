"use strict";
/*
 * 全体表示のフィット計算の検証。
 *
 * 重要: 計算の本体は index.html の solveFitDistance / solveFitOrtho を
 * extracted.js 経由でそのまま呼ぶ。以前はこのファイル内にアルゴリズムの
 * 写しを置いていたため、index.html 側を変更してもテストが永久に成功する
 * 状態になっていた。写しは置かないこと。
 *
 * ここで組み立てるのはカメラ基底(right/camUp)だけで、これは index.html 側では
 * THREE.Vector3 が担う部分。アルゴリズムそのものは共有している。
 */
const F = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`  ${c ? "OK" : "NG!!"}: ${n}`); };

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };

/* index.html の fitView と同じ手順でカメラ基底を作る(THREE依存部分の再現) */
function basis(forward) {
  let right = cross(forward, [0, 1, 0]);
  if (Math.hypot(...right) < 1e-6) right = [1, 0, 0];   // 真上/真下から見ている場合
  right = norm(right);
  return { right, camUp: norm(cross(right, forward)) };
}

/* 実コード solveFitDistance を使ってフィット結果を得る */
function fitView(corners, fov, aspect, forward, margin = 0.05) {
  const { right, camUp } = basis(forward);
  const half = Math.tan((fov * Math.PI / 180) / 2);
  const tanV = half * (1 - 2 * margin);
  const tanH = half * aspect * (1 - 2 * margin);
  const pts = corners.map((p) => ({ u: dot(p, right), v: dot(p, camUp), f: dot(p, forward) }));
  const rad = Math.max(...corners.map((p) => Math.hypot(...p)));
  const s = F.solveFitDistance(pts, tanH, tanV, rad);   // ← index.html の実装そのもの
  return { d: s.distance, su: s.su, sv: s.sv, right, camUp };
}

// ==== 検証: 実データ相当の壁(152×9×14m)を各視点で ====
const FOV = 50, ASPECT = 1.5;
const size = [152.18, 8.89, 13.94];
const corners = [];
for (let i = 0; i < 8; i++) corners.push([
  (i & 1 ? size[0] / 2 : -size[0] / 2),
  (i & 2 ? size[1] / 2 : -size[1] / 2),
  (i & 4 ? size[2] / 2 : -size[2] / 2)]);

function screenStats(r, corners, fov, aspect) {
  const tanVr = Math.tan((fov * Math.PI / 180) / 2), tanHr = tanVr * aspect;
  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity, allFront = true;
  for (const p of corners) {
    const u = dot(p, r.right) - r.su, v = dot(p, r.camUp) - r.sv, f = dot(p, r.fwd);
    const z = r.d + f;
    if (z <= 0) allFront = false;
    mnX = Math.min(mnX, u / (z * tanHr)); mxX = Math.max(mxX, u / (z * tanHr));
    mnY = Math.min(mnY, v / (z * tanVr)); mxY = Math.max(mxY, v / (z * tanVr));
  }
  return { mnX, mxX, mnY, mxY, allFront };
}

const views = [
  ["正面", [0, 0, -1]],
  ["斜め(スクショ相当)", norm([-0.85, -0.25, -0.46])],
  ["浅い斜め", norm([-0.3, -0.2, -0.93])],
  ["真上(基底が縮退するケース)", [0, -1, 0]],
];
for (const [name, fwd] of views) {
  const r = fitView(corners, FOV, ASPECT, fwd);
  r.fwd = fwd;
  const s = screenStats(r, corners, FOV, ASPECT);
  const mL = (1 + s.mnX) / 2, mR = (1 - s.mxX) / 2, mB = (1 + s.mnY) / 2, mT = (1 - s.mxY) / 2;
  const tight = Math.min(mL, mR, mB, mT);
  console.log(`${name}: d=${r.d.toFixed(1)}m シフト=(${r.su.toFixed(1)}, ${r.sv.toFixed(1)})`);
  console.log(`  マージン 左${(mL * 100).toFixed(1)}% 右${(mR * 100).toFixed(1)}% 下${(mB * 100).toFixed(1)}% 上${(mT * 100).toFixed(1)}%`);
  ok(s.allFront, `${name}: 全頂点がカメラの前`);
  ok(tight > 0.049, `${name}: どの辺も5%以上の余白`);
  ok(Math.abs(tight - 0.05) < 0.002, `${name}: 制約辺の余白がほぼちょうど5%`);
  const symH = Math.abs(mL - mR) < 0.01 || Math.min(mB, mT) < Math.min(mL, mR) + 0.001;
  ok(symH, `${name}: 余白が対称に再配分されている`);
}

// ==== 平行投影のフィット(solveFitOrtho) ====
console.log("\n平行投影のフィット:");
{
  // 横長(200×20)を aspect 1.5 の画面に収める → 幅が制約になる
  const r = F.solveFitOrtho(-100, 100, -10, 10, 1.5, 0.05);
  const halfWNeeded = 100 / (1 - 0.1);
  ok(Math.abs(r.halfHeight - halfWNeeded / 1.5) < 1e-9, "横長: 幅が制約になり高さが決まる");
  ok(Math.abs(r.cu) < 1e-12 && Math.abs(r.cv) < 1e-12, "横長: 中心が原点");

  // 縦長(20×200)→ 高さが制約になる
  const r2 = F.solveFitOrtho(-10, 10, -100, 100, 1.5, 0.05);
  ok(Math.abs(r2.halfHeight - 100 / (1 - 0.1)) < 1e-9, "縦長: 高さが制約になる");

  // 余白がちょうど5%か(高さ方向で検証)
  const covered = 100 / r2.halfHeight;           // 収まっている割合(0〜1)
  ok(Math.abs((1 - covered) / 2 - 0.05) < 1e-9, "上下の余白がそれぞれ5%");

  // 中心がずれた箱でも中心が正しく返る
  const r3 = F.solveFitOrtho(10, 30, -5, 15, 1.0, 0.05);
  ok(Math.abs(r3.cu - 20) < 1e-12 && Math.abs(r3.cv - 5) < 1e-12, "中心がずれた箱の中心を正しく返す");

  // 退化(点)でも0除算やNaNにならない
  const r4 = F.solveFitOrtho(5, 5, 5, 5, 1.5, 0.05);
  ok(Number.isFinite(r4.halfHeight) && r4.halfHeight > 0, "退化した箱でも有限かつ正の高さ");
}

console.log(`\n===== ${pass}成功 / ${fail}失敗 =====`);
process.exit(fail ? 1 : 0);
