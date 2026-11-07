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
/* 中間色(v1.38.0)。

   以前はRGBの2色直線補間で、この検査も「RGBの平均になること」を確かめていた。
   しかし青と赤を混ぜると途中で**灰色がかった紫**を通り、±22.5°付近で
   彩度0.55・明度0.52まで落ちる。石の色分けは常に彩度0.85・明度0.95なので、
   **線のほうが下地より暗く鈍くなり、いちばん読みたい中間の傾きが見えにくい**。

   HSVで色相を回す案は、巻き戻しと無彩色の場合分けが要るうえ、
   **既定の色では片方の分岐が一度も通らない**(逆の色を選んだときだけ動く)。
   動かない道を残さないため、中間色を1つ持たせて2区間に分ける形にした。 */
{
  const MID = [0.80, 0.14, 0.90];   // マゼンタ(#cd23e6 相当)

  // 3つの色が、それぞれの角度でそのまま出る
  const c0 = F.symmetricAngleColor(0, BLUE, RED, MID);
  ok(c0.every((v, i) => approx(v, BLUE[i], 1e-9)), "0°は中央色そのもの");
  const c22 = F.symmetricAngleColor(22.5, BLUE, RED, MID);
  ok(c22.every((v, i) => approx(v, MID[i], 1e-9)), "**±22.5°は中間色そのもの**");
  const c45b = F.symmetricAngleColor(45, BLUE, RED, MID);
  ok(c45b.every((v, i) => approx(v, RED[i], 1e-9)), "±45°は両端色そのもの");
  const cm22 = F.symmetricAngleColor(-22.5, BLUE, RED, MID);
  ok(cm22.every((v, i) => approx(v, c22[i], 1e-9)), "±22.5°が対称(同色)");

  // 2区間がそれぞれ直線になっている
  const q1 = F.symmetricAngleColor(11.25, BLUE, RED, MID);
  ok(q1.every((v, i) => approx(v, (BLUE[i] + MID[i]) / 2, 1e-9)), "前半は中央色と中間色の平均");
  const q3 = F.symmetricAngleColor(33.75, BLUE, RED, MID);
  ok(q3.every((v, i) => approx(v, (MID[i] + RED[i]) / 2, 1e-9)), "後半は中間色と両端色の平均");

  // くすまないこと(この変更の目的)
  ok(Math.max(...c22) > 0.85, "**中間でも明るさが落ちない** (max=" + Math.max(...c22).toFixed(2) + ")");
  ok(Math.max(...c22) - Math.min(...c22) > 0.6,
     "中間でも色味が残る(灰色に寄らない) (幅=" + (Math.max(...c22) - Math.min(...c22)).toFixed(2) + ")");

  // 範囲外
  ok(F.symmetricAngleColor(99, BLUE, RED, MID).every((v, i) => approx(v, RED[i], 1e-9)),
     "範囲外は両端色にクランプ");
  ok(F.symmetricAngleColor(-99, BLUE, RED, MID).every((v, i) => approx(v, RED[i], 1e-9)),
     "負の範囲外もクランプ");

  // 中間色を渡さなければ2色の直線補間(古い呼び出しを壊さない)
  const noMid = F.symmetricAngleColor(22.5, BLUE, RED);
  ok(noMid.every((v, i) => approx(v, (BLUE[i] + RED[i]) / 2, 1e-9)),
     "中間色を省けば2色の直線補間に戻る");

  // 壊れた角度。NaNをそのまま通すと色がNaNになり、線が描かれない
  const bad = F.symmetricAngleColor(NaN, BLUE, RED, MID);
  ok(bad.every(Number.isFinite), "**角度がNaNでも色はNaNにしない**(線が消える)");
  ok(bad.every((v, i) => approx(v, BLUE[i], 1e-9)), "読めない角度は0°として扱う");
  ok(F.symmetricAngleColor(undefined, BLUE, RED, MID).every(Number.isFinite), "角度が無くても落ちない");

  // 3色とも同じでも破綻しない
  const same = F.symmetricAngleColor(22.5, BLUE, BLUE, BLUE);
  ok(same.every((v, i) => approx(v, BLUE[i], 1e-9)), "3色とも同色なら全域で同色");
}

console.log(`\n===== ${pass}成功 / ${fail}失敗 =====`);
process.exit(fail?1:0);
