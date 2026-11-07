"use strict";
const F = require("./extracted.js");
let pass=0, fail=0;
const ok=(c,n)=>{ c?pass++:fail++; console.log(`  ${c?"OK":"NG!!"}: ${n}`); };
const approx=(a,b,e=1e-6)=>Math.abs(a-b)<e;

// 垂直壁(XZ面)上、面内20度回転した 4x0.5 の矩形
const c20=Math.cos(20*Math.PI/180), s20=Math.sin(20*Math.PI/180);
const verts=[];
for (const [u,v] of [[-2,-0.25],[2,-0.25],[2,0.25],[-2,0.25]]) {
  verts.push([u*c20 - v*s20 + 10, 0, u*s20 + v*c20 + 5]);  // 中心(10,0,5)にオフセット
}
const a = F.computeContourAttributes(verts);
ok(a !== null, "計算成功");
ok(approx(a.rectAngle, 20, 0.01), `RectAngle=20 (${a.rectAngle.toFixed(3)})`);

// 中心線の検証
const A=a.rectLine.a, B=a.rectLine.b;
const mid=[(A[0]+B[0])/2,(A[1]+B[1])/2,(A[2]+B[2])/2];
ok(approx(mid[0],10,1e-6)&&approx(mid[2],5,1e-6), `中心線の中点=矩形中心 (${mid.map(x=>x.toFixed(4))})`);
const len=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]);
ok(approx(len, a.width, 1e-6), `中心線の長さ=Width (${len.toFixed(4)} vs ${a.width.toFixed(4)})`);
// 線の傾き = RectAngle と一致するか(XZ面内、水平基準に対する角度)
const dir=[(B[0]-A[0])/len, (B[1]-A[1])/len, (B[2]-A[2])/len];
let lineAngle = Math.atan2(dir[2], dir[0]) * 180/Math.PI;
// 線分は方向を持たないので、傾きを[-90, 90]に正規化して比較する
lineAngle = ((lineAngle + 90) % 180 + 180) % 180 - 90;
ok(approx(Math.abs(lineAngle), 20, 0.01), `線分としての傾き=±20° (${lineAngle.toFixed(3)})`);

// symmetricAngleColor(対称グラデーション)の検証
const BLUE = [0.14, 0.34, 0.90], RED = [0.90, 0.13, 0.13];
const cm45 = F.symmetricAngleColor(-45, BLUE, RED);
const c0 = F.symmetricAngleColor(0, BLUE, RED);
const cp45 = F.symmetricAngleColor(45, BLUE, RED);
ok(cm45[0] > 0.85, `-45°=赤 (${cm45.map(x=>x.toFixed(2))})`);
ok(c0[2] > 0.85 && c0[0] < 0.3, `0°=青 (${c0.map(x=>x.toFixed(2))})`);
ok(cp45[0] > 0.85, `+45°=赤 (${cp45.map(x=>x.toFixed(2))})`);
ok(approx(cm45[0], cp45[0]) && approx(cm45[2], cp45[2]), "±45°が対称(同色)");
ok(F.symmetricAngleColor(99, BLUE, RED)[0] > 0.85, "範囲外はクランプ");
/* 中間色はHSVで回す(v1.38.0で変更)。

   以前はRGBの直線補間で、この検査も「RGBの平均になること」を確かめていた。
   しかし青と赤をRGBで混ぜると途中で**灰色がかった紫**を通り、±22.5°付近で
   彩度0.55・明度0.52まで落ちる。石の色分けは常に彩度0.85・明度0.95なので、
   **線のほうが下地より暗く鈍くなり、いちばん読みたい中間の傾きが見えにくい**。
   いまは色相を短いほうに回し、彩度と明度は両端の値を補間する。 */
{
  const hsv = (c) => F.rgbToHsv(c);
  const midCol = F.symmetricAngleColor(22.5, BLUE, RED);
  const sB = hsv(BLUE), sR = hsv(RED), sM = hsv(midCol);

  ok(!approx(midCol[0], (BLUE[0]+RED[0])/2, 0.02),
     "**±22.5°はRGBの平均ではない**(平均にすると灰色がかる)");
  ok(sM[1] > 0.80, `中間でも彩度が落ちない (S=${sM[1].toFixed(2)})`);
  ok(sM[2] > 0.85, `**中間でも明度が落ちない** (V=${sM[2].toFixed(2)})`);
  ok(Math.abs(sM[1] - (sB[1]+sR[1])/2) < 0.02, "彩度は両端の補間どおり");
  ok(Math.abs(sM[2] - (sB[2]+sR[2])/2) < 0.02, "明度は両端の補間どおり");
  // 青(色相≒0.62)から赤(0)へは、短いほう=紫・マゼンタ側を通る。
  // 長いほうへ回すと緑・黄を通り、傾きの図として意味を持たない色になる
  ok(sM[0] > 0.75 && sM[0] < 0.95,
     `**色相は短いほう(紫〜マゼンタ)を回る** (H=${sM[0].toFixed(2)})`);

  // 両端は変えない(読み方「0°=青 / ±45°=赤」を保つ)
  const c0 = F.symmetricAngleColor(0, BLUE, RED);
  ok(approx(c0[0], BLUE[0], 1e-6) && approx(c0[1], BLUE[1], 1e-6) && approx(c0[2], BLUE[2], 1e-6),
     "0°は中央色そのもの");
  const c45 = F.symmetricAngleColor(45, BLUE, RED);
  ok(approx(c45[0], RED[0], 1e-6) && approx(c45[1], RED[1], 1e-6) && approx(c45[2], RED[2], 1e-6),
     "±45°は両端色そのもの");

  // 無彩色を選ばれても壊れない。灰色には色相が無いので、相手の色相を使う
  const GRAY = [0.5, 0.5, 0.5];
  const g = F.symmetricAngleColor(22.5, GRAY, RED);
  ok(F.rgbToHsv(g)[0] < 0.05 || F.rgbToHsv(g)[0] > 0.95,
     "灰色→赤でも赤の色相のまま(0へ流れて別の色にならない)");
  const gg = F.symmetricAngleColor(22.5, GRAY, [0.2, 0.2, 0.2]);
  ok(F.rgbToHsv(gg)[1] === 0, "両方とも無彩色なら無彩色のまま");

  // 同じ色を選ばれたとき
  const same = F.symmetricAngleColor(22.5, BLUE, BLUE);
  ok(approx(same[0], BLUE[0], 1e-6) && approx(same[2], BLUE[2], 1e-6), "両端が同色なら全域で同色");

  // 壊れた角度。NaNをそのまま通すと色がNaNになり、線が描かれない
  const bad = F.symmetricAngleColor(NaN, BLUE, RED);
  ok(bad.every(Number.isFinite), "**角度がNaNでも色はNaNにしない**(線が消える)");
  ok(approx(bad[2], BLUE[2], 1e-6), "読めない角度は0°として扱う");
}

/* rgbToHsv 単体 */
{
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const red = F.rgbToHsv([1, 0, 0]);
  ok(near(red[0], 0) && near(red[1], 1) && near(red[2], 1), "赤はH0 S1 V1");
  const grn = F.rgbToHsv([0, 1, 0]);
  ok(near(grn[0], 1/3), "緑はH=1/3");
  const blu = F.rgbToHsv([0, 0, 1]);
  ok(near(blu[0], 2/3), "青はH=2/3");
  ok(F.rgbToHsv([0, 0, 0])[1] === 0, "黒は彩度0(0除算にしない)");
  ok(F.rgbToHsv([1, 1, 1])[1] === 0, "白も彩度0");
  // hsvToRgb との往復
  for (const c of [[0.9, 0.2, 0.1], [0.1, 0.5, 0.8], [0.3, 0.7, 0.3]]) {
    const h = F.rgbToHsv(c), back = F.hsvToRgb(h[0], h[1], h[2]);
    ok(back.every((v, i) => Math.abs(v - c[i]) < 1e-6), "hsvToRgbと往復して戻る");
  }
}

console.log(`\n===== ${pass}成功 / ${fail}失敗 =====`);
process.exit(fail?1:0);
