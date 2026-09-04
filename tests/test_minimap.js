"use strict";
/*
 * 俯瞰ミニマップの座標変換と目盛りの検証。
 *
 * 現在地の目安表示(§6.9)で、投影と系の判定は test_geoloc.js が見ている。
 * ここで見るのは、その結果を**図の上のどこに置くか**の部分。
 *
 *  ・toMapXY      データ座標(x, y) → 地図座標(u=東, v=北)
 *  ・niceScaleLength  スケールバーの長さを 1・2・5 系列に丸める
 *
 * toMapXY を取り違えると俯瞰図が90度回り、現在地が別の区画を指す。
 * 現地では**回っていることに気づけない**(壁は上から見ると細長い線なので、
 * 90度回った図もそれらしく見えてしまう)ため、ここで押さえておく。
 */
const { toMapXY, niceScaleLength } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

/* ---------- toMapXY ---------- */

// swap=false: データは平面直角座標そのまま(x=北, y=東)
{
  const q = toMapXY({ x: 100, y: 30 }, false);
  ok(q.u === 30 && q.v === 100, "swap=false では x=北・y=東 として読む", JSON.stringify(q));
}
// swap=true: CADでよくある入れ替え(x=東, y=北)
{
  const q = toMapXY({ x: 100, y: 30 }, true);
  ok(q.u === 100 && q.v === 30, "swap=true では x=東・y=北 として読む", JSON.stringify(q));
}

// 北へ動いた点は v が増える(画面では上に行く)。両方の並びで確かめる
{
  const base = { x: 0, y: 0 };
  const north = { x: 50, y: 0 };            // x=北 の並び
  const a = toMapXY(base, false), b = toMapXY(north, false);
  ok(b.v > a.v && b.u === a.u, "swap=false: 北へ動くと v だけが増える");
}
{
  const base = { x: 0, y: 0 };
  const north = { x: 0, y: 50 };            // y=北 の並び
  const a = toMapXY(base, true), b = toMapXY(north, true);
  ok(b.v > a.v && b.u === a.u, "swap=true: 北へ動くと v だけが増える");
}

// 東へ動いた点は u が増える(画面では右に行く)
{
  const a = toMapXY({ x: 0, y: 0 }, false), b = toMapXY({ x: 0, y: 50 }, false);
  ok(b.u > a.u && b.v === a.v, "swap=false: 東へ動くと u だけが増える");
}
{
  const a = toMapXY({ x: 0, y: 0 }, true), b = toMapXY({ x: 50, y: 0 }, true);
  ok(b.u > a.u && b.v === a.v, "swap=true: 東へ動くと u だけが増える");
}

// 2つの並びは u と v を入れ替えた関係になる(取り違えると図が90度回る)
{
  const p = { x: 123.5, y: -67.25 };
  const a = toMapXY(p, false), b = toMapXY(p, true);
  ok(a.u === b.v && a.v === b.u, "swapの有無は u と v の入れ替えに等しい");
}

// 石と現在地は同じ変換を通す。相対的な位置関係が保たれること
{
  const swap = false;
  const stone = toMapXY({ x: 1000, y: 2000 }, swap);      // 北1000, 東2000
  const me = toMapXY({ x: 1000 - 30, y: 2000 + 40 }, swap); // 南へ30m, 東へ40m
  ok(me.v < stone.v && me.u > stone.u, "現在地が石の南東にあるとき、図でも下・右になる",
     "Δu=" + (me.u - stone.u) + " Δv=" + (me.v - stone.v));
  ok(Math.hypot(me.u - stone.u, me.v - stone.v) === 50,
     "変換で距離が変わらない(30-40-50)");
}

// 値をそのまま渡すだけで、元のオブジェクトを書き換えないこと
{
  const p = { x: 5, y: 7 };
  toMapXY(p, true); toMapXY(p, false);
  ok(p.x === 5 && p.y === 7, "元の点を書き換えない");
}

// 負の座標(原点の南西側)でも並びは同じ
{
  const q = toMapXY({ x: -109625.8, y: -21166.1 }, false);   // 第6系・京都付近
  ok(q.u === -21166.1 && q.v === -109625.8, "実際の平面直角座標(負の値)でも並びは同じ");
}

/* ---------- niceScaleLength ---------- */

const nice = [
  [1, 1], [1.4, 1], [1.9, 1],
  [2, 2], [2.5, 2], [4.9, 2],
  [5, 5], [9.9, 5],
  [10, 10], [12, 10], [20, 20], [49, 20], [50, 50], [99, 50],
  [100, 100], [237, 200], [640, 500],
  [1000, 1000], [3400, 2000], [8000, 5000],
];
let niceOk = true, niceBad = [];
for (const [input, want] of nice) {
  const got = niceScaleLength(input);
  if (got !== want) { niceOk = false; niceBad.push(input + "→" + got + "(期待" + want + ")"); }
}
ok(niceOk, "スケールバーが 1・2・5 系列に丸まる", niceBad.join(" "));

// 1m未満は1mに寄せる(壁の一部だけを見ているときに 0m と出さない)
ok(niceScaleLength(0.4) === 1, "1m未満でも1mになる");
ok(niceScaleLength(0) === 1, "0でも1mになる(0除算・-Infinityを出さない)");
ok(Number.isFinite(niceScaleLength(0)), "0でも有限の値を返す");

// 返り値は常に正。長さ0のバーを描かない
{
  let allPositive = true;
  for (let m = 0.01; m < 20000; m *= 1.7) if (!(niceScaleLength(m) > 0)) allPositive = false;
  ok(allPositive, "どの入力でも正の長さを返す");
}

// 丸めた長さは元の長さを大きく超えない(バーが枠からはみ出さない)
{
  let within = true, worst = 0;
  for (let m = 1; m < 20000; m *= 1.3) {
    const r = niceScaleLength(m) / m;
    if (r > worst) worst = r;
    if (r > 1.0001) within = false;
  }
  ok(within, "丸めた長さは元の長さ以下(バーが枠外へ出ない)", "最大比 " + worst.toFixed(3));
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
