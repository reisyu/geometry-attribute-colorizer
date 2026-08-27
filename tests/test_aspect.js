"use strict";
/*
 * アスペクト比(Aspect)属性の検証。
 *
 * 定義: 幅 ÷ 高さ。Widthは最小外接矩形の「水平に近い辺」、Heightは
 * 「鉛直に近い辺」なので、1より大きい=横長、小さい=縦長になる。
 * 高さが0に潰れた輪郭では null(値なし)を返し、Infinityを作らないこと。
 */
const F = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`  ${c ? "OK" : "NG!!"}: ${n}`); };

/* XY平面上の矩形(反時計回り) */
const rect = (w, h) => [[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0]];

{
  const a = F.computeContourAttributes(rect(2, 1));
  ok(a !== null, "2x1の矩形が計算できる");
  ok(Math.abs(a.aspect - a.width / a.height) < 1e-12, "aspectはwidth/heightと一致する");
  ok(Math.abs(a.aspect - 2) < 1e-9, `横長(2x1)のaspectが2 (実際: ${a.aspect})`);

  const b = F.computeContourAttributes(rect(1, 2));
  ok(Math.abs(b.aspect - 0.5) < 1e-9, `縦長(1x2)のaspectが0.5 (実際: ${b.aspect})`);

  const c = F.computeContourAttributes(rect(1, 1));
  ok(Math.abs(c.aspect - 1) < 1e-9, `正方形のaspectが1 (実際: ${c.aspect})`);
}

{
  // 極端に細長い形でも有限値になる
  const thin = F.computeContourAttributes(rect(1000, 0.001));
  ok(thin === null || Number.isFinite(thin.aspect), `極端に細長い形でも有限値 (実際: ${thin && thin.aspect})`);

  // 高さが潰れた(一直線)輪郭でInfinityを作らない
  const line = F.computeContourAttributes([[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
  if (line === null) {
    ok(true, "一直線の輪郭は計算不能(null)として扱われる");
  } else {
    ok(line.aspect === null || Number.isFinite(line.aspect),
      `高さが潰れてもInfinityにならない (実際: ${line.aspect})`);
  }
}

{
  // Aspectは形状固有の値ではなく「向きに依存する」値である点が重要。
  // Widthは水平に近い辺、Heightは鉛直に近い辺と定義されているため、
  // 90度回して長辺が縦になれば比は逆数になる。これは仕様どおりの挙動。
  const rot = (pts, deg) => {
    const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    return pts.map(([x, y, z]) => [x * c - y * s, x * s + y * c, z]);
  };
  const base = F.computeContourAttributes(rect(2, 1));

  for (const deg of [10, 30, 180]) {
    const r = F.computeContourAttributes(rot(rect(2, 1), deg));
    ok(r !== null && Math.abs(r.aspect - base.aspect) < 1e-6,
      `${deg}度回転(長辺は横のまま)ではaspectが変わらない (実際: ${r && r.aspect.toFixed(4)})`);
  }

  const r90 = F.computeContourAttributes(rot(rect(2, 1), 90));
  ok(r90 !== null && Math.abs(r90.aspect - 1 / base.aspect) < 1e-6,
    `90度回転で長辺が縦になり比が逆数になる (実際: ${r90 && r90.aspect.toFixed(4)})`);

  for (const deg of [0, 10, 45, 90, 135]) {
    const r = F.computeContourAttributes(rot(rect(2, 1), deg));
    ok(r !== null && Math.abs(r.aspect - r.width / r.height) < 1e-9,
      `${deg}度: aspectは常にwidth/heightと一致する`);
  }
}

console.log(`\n===== ${pass}成功 / ${fail}失敗 =====`);
process.exit(fail ? 1 : 0);
