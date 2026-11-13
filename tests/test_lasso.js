"use strict";
/*
 * 投げ縄で選ぶ(§6.8.1)。
 *
 * ブラシは「なぞった線の近く」を拾うので、線と線の間に残った石を取りこぼすことが
 * あった。投げ縄は囲んだ範囲で拾う。判定は**石の重心が囲みの中に入ったか**
 * (ブラシと同じく、縁にかかった隣の石まで巻き込まないため)。
 *
 * 囲みの中かどうか(pointInPolygon)と、囲みの大きさ(polygonArea)を検証する。
 * 小さすぎる囲みはタップとみなすので、面積の計算が狂うとタップが効かなくなる。
 */
const { pointInPolygon, polygonArea } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

const SQ = [[0, 0], [100, 0], [100, 100], [0, 100]];

/* ---------- 四角 ---------- */
ok(pointInPolygon(50, 50, SQ), "中の点は中");
ok(!pointInPolygon(150, 50, SQ), "右の外は外");
ok(!pointInPolygon(-1, 50, SQ), "左の外は外");
ok(!pointInPolygon(50, 101, SQ), "下の外は外");
ok(pointInPolygon(1, 1, SQ) && pointInPolygon(99, 99, SQ), "角の近くでも中は中");

/* ---------- 閉じていない線 ---------- */
/* 指で描いた線は、始点と終点が離れている。最後の点から最初の点へ
   直線で結んで閉じたものとして扱う(結ぶ点を別に足さなくてよい) */
{
  const open = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 10]];
  ok(pointInPolygon(50, 50, open), "**始点と終点が離れていても、結んで閉じた囲みとして扱う**");
  const u = [[0, 0], [100, 0], [100, 100]];   // 三角形(斜めの辺で閉じる)
  ok(pointInPolygon(80, 20, u) && !pointInPolygon(20, 80, u), "斜めの辺で閉じた側だけが中");
}

/* ---------- へこんだ形 ---------- */
/* 指で囲むと、石を避けてへこんだ形になる。へこみの中は外 */
{
  const C = [[0, 0], [100, 0], [100, 30], [30, 30], [30, 70], [100, 70], [100, 100], [0, 100]];
  ok(pointInPolygon(15, 50, C), "へこんだ形: 左の太いところは中");
  ok(!pointInPolygon(70, 50, C), "**へこみの中は外**(避けて囲んだ石は選ばれない)");
  ok(pointInPolygon(70, 15, C) && pointInPolygon(70, 85, C), "へこみの上下の腕は中");
}

/* ---------- 線が交差した囲み ---------- */
/* 8の字に描いた場合、2つの輪はそれぞれ中。重なりは無いので両方選ばれる */
{
  const eight = [[0, 0], [100, 100], [100, 0], [0, 100]];   // 蝶ネクタイ形
  ok(pointInPolygon(20, 50, eight) && pointInPolygon(80, 50, eight), "8の字: 左右の輪は中");
  ok(!pointInPolygon(50, 10, eight), "8の字: 輪の外は外");
}

/* ---------- 縦横どちらの向きでも ---------- */
{
  const rev = SQ.slice().reverse();
  ok(pointInPolygon(50, 50, rev) && !pointInPolygon(150, 50, rev), "**逆回りに描いても同じ**");
}

/* ---------- 壊れた入力 ---------- */
ok(!pointInPolygon(0, 0, []), "点が無ければ何も中にない");
ok(!pointInPolygon(0, 0, null), "nullでも落ちない");
ok(!pointInPolygon(5, 5, [[0, 0], [10, 10]]), "2点(線)は囲みにならない");
{
  // 同じ高さの辺(水平な辺)で割り算が0にならない
  const flat = [[0, 50], [100, 50], [100, 50], [0, 50]];
  ok(!pointInPolygon(50, 50, flat), "潰れた囲み(面積0)は何も中にない");
}

/* ---------- 面積 ---------- */
/* 小さすぎる囲み(1辺8px四方ほど=64px²未満)は、投げ縄ではなくタップとみなす */
ok(Math.abs(polygonArea(SQ)) === 10000, "四角の面積", String(polygonArea(SQ)));
ok(polygonArea(SQ) === -polygonArea(SQ.slice().reverse()), "**向きで符号が変わる**(使う側で絶対値を取る)");
ok(Math.abs(polygonArea([[0, 0], [100, 0], [100, 100]])) === 5000, "三角形の面積");
ok(Math.abs(polygonArea([[0, 0], [7, 0], [7, 7], [0, 7]])) < 64, "手ぶれ程度(7px四方)はタップとみなす大きさ");
ok(Math.abs(polygonArea([[0, 0], [9, 0], [9, 9], [0, 9]])) >= 64, "9px四方なら囲みとみなす");
ok(polygonArea([]) === 0 && polygonArea(null) === 0, "点が無ければ0");
ok(polygonArea([[0, 0], [10, 10]]) === 0, "2点(線)は0");

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
