"use strict";
/*
 * 壁の表向きを、ジオメトリの面法線から復元できるか。
 *
 * 傾きライン(rectLine)はDXFから属性を計算したときにしか無い。GLBや作業データ
 * (ZIP)から開くと1つも無く、**既定の (0,0,1) が返っていた**。壁がその向きで
 * なければ「正面」が裏返る。現地で実際に起きた(v1.29.4で修正)。
 *
 * ここでは足し込みの核だけを見る。面積で重み付けされること、巻き順が向きを
 * 決めること、縮退した三角形が結果を汚さないこと。
 */
const { accumulateFaceNormals } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

const acc = (positions, indices) => accumulateFaceNormals(positions, indices, [0, 0, 0]);
const unit = (v) => {
  const L = Math.hypot(v[0], v[1], v[2]);
  return L < 1e-12 ? [0, 0, 0] : [v[0] / L, v[1] / L, v[2] / L];
};
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps);
const sameDir = (v, w) => near(unit(v)[0], w[0]) && near(unit(v)[1], w[1]) && near(unit(v)[2], w[2]);

/* ---------- 向き ---------- */
{
  // XY平面の三角形。反時計回りなら +Z を向く
  const p = [0,0,0, 1,0,0, 0,1,0];
  ok(sameDir(acc(p, null), [0, 0, 1]), "反時計回りの面は +Z を向く", JSON.stringify(unit(acc(p, null))));
}
{
  // 巻き順を逆にすると裏返る。**これが正面と裏を分ける**
  const p = [0,0,0, 0,1,0, 1,0,0];
  ok(sameDir(acc(p, null), [0, 0, -1]), "巻き順を逆にすると -Z を向く", JSON.stringify(unit(acc(p, null))));
}
{
  // XZ平面(床)の三角形
  const p = [0,0,0, 1,0,0, 0,0,-1];
  ok(sameDir(acc(p, null), [0, 1, 0]), "床向きの面は +Y を向く", JSON.stringify(unit(acc(p, null))));
}

/* ---------- 面積の重み ---------- */
{
  // 外積の長さは面積の2倍。大きい面ほど強く効く
  const small = acc([0,0,0, 1,0,0, 0,1,0], null);
  const big   = acc([0,0,0, 10,0,0, 0,10,0], null);
  ok(near(Math.hypot(...big) / Math.hypot(...small), 100, 1e-4),
     "**面積で重み付けされる**(10倍の辺で100倍)", (Math.hypot(...big) / Math.hypot(...small)).toFixed(2));
}
{
  // 大きい面と小さい逆向きの面。大きいほうが勝つ
  const p = [0,0,0, 10,0,0, 0,10,0,   0,0,1, 0,1,1, 1,0,1];
  ok(sameDir(acc(p, null), [0, 0, 1]), "小さな逆向きの面があっても、大きい面の向きになる");
}

/* ---------- インデックス付き ---------- */
{
  const p = [0,0,0, 1,0,0, 0,1,0, 1,1,0];
  const withIdx = acc(p, [0,1,2, 1,3,2]);
  ok(sameDir(withIdx, [0, 0, 1]), "インデックス付きでも向きが出る");
  const direct = acc([0,0,0, 1,0,0, 0,1,0, 1,0,0, 1,1,0, 0,1,0], null);
  ok(near(Math.hypot(...withIdx), Math.hypot(...direct), 1e-6),
     "インデックスの有無で面積の合計が変わらない",
     Math.hypot(...withIdx).toFixed(6) + " / " + Math.hypot(...direct).toFixed(6));
}

/* ---------- 壊れた入力 ---------- */
ok(JSON.stringify(acc([], null)) === "[0,0,0]", "頂点が無ければ 0 のまま");
{
  // 三角形にならない端数は無視する(落ちない)
  const r = acc([0,0,0, 1,0,0], null);
  ok(JSON.stringify(r) === "[0,0,0]", "3頂点に満たない端数は無視する", JSON.stringify(r));
}
{
  // 面積0の三角形(同じ点が3つ)は何も足さない
  const r = acc([1,2,3, 1,2,3, 1,2,3], null);
  ok(JSON.stringify(r) === "[0,0,0]", "つぶれた三角形は結果を汚さない", JSON.stringify(r));
}
{
  // 一直線に並んだ3点も面積0
  const r = acc([0,0,0, 1,0,0, 2,0,0], null);
  ok(Math.hypot(...r) < 1e-12, "一直線の3点も面積0として扱われる", JSON.stringify(r));
}

/* ---------- 足し込みであること ---------- */
{
  const out = [1, 0, 0];
  accumulateFaceNormals([0,0,0, 1,0,0, 0,1,0], null, out);
  ok(near(out[0], 1) && near(out[2], 1),   // 外積の長さは面積の2倍なので 0.5 ではなく 1
     "渡した配列に**足し込む**(複数のメッシュを1つに集められる)", JSON.stringify(out));
}

/* ---------- 壁らしい形 ---------- */
{
  // わずかに傾いた壁面を模した2枚。平均が傾きを拾う
  const p = [
    0,0,0,  1,0,0,  0,1,0.1,
    1,0,0,  1,1,0.1, 0,1,0.1,
  ];
  const n = unit(acc(p, null));
  ok(n[2] > 0.9 && n[1] < 0, "ほぼ正面を向きつつ、傾きぶんだけ上下成分が出る",
     n.map((x) => x.toFixed(3)).join(", "));
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
