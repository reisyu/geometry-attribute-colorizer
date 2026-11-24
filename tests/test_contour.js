"use strict";
/*
 * 読み戻した台紙GLBを「輪郭モデル」と見分けられるか。
 *
 * SVG立面図は**頂点の並びをそのまま輪郭として**使う。DXFから読んだときは
 * 印(isContour)が付くが、GLBや作業データ(ZIP)から開くと付かず、
 * 「SVG書き出しはDXFから読み込んだモデルでのみ利用できます」で止まっていた。
 * 運用は「初回だけDXF、以後はZIP」を勧めているのに、報告書用の図を出すには
 * DXFを読み直すしかない——という食い違いになっていた(v1.32.0で解消)。
 *
 * 書き出し側に印を入れたが、**それ以前に作った台紙GLBには印が無い**。
 * 作り直させるとDXFの読み直しでIDが振り直され、記録との対応が切れる。
 * そこで形からも見分ける。ここではその見分け方を検証する。
 */
const { looksLikeContour, unpackRectLine, contourVertsFromPositions } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

/* n角形を扇状に分割したインデックスを作る(耳切りと同じ三角形数 n-2) */
const fan = (n) => {
  const out = [];
  for (let i = 1; i + 1 < n; i++) out.push(0, i, i + 1);
  return out;
};

/* ---------- 輪郭と見なすもの ---------- */
ok(looksLikeContour(3, [0, 1, 2]), "三角形(3頂点1枚)は輪郭");
ok(looksLikeContour(4, fan(4)), "四角形(4頂点2枚)は輪郭");
ok(looksLikeContour(8, fan(8)), "八角形(8頂点6枚)は輪郭");
ok(looksLikeContour(40, fan(40)), "石らしい40頂点の輪郭");
{
  // 扇でなく耳切りでも、三角形の数と使う頂点は同じ
  const ear = [0,1,2, 2,3,4, 4,5,0, 0,2,4];   // 6頂点4枚
  ok(looksLikeContour(6, ear), "**扇状でなくても判定できる**(耳切りの並び)");
}

/* ---------- 輪郭でないもの ---------- */
{
  // 立方体: 8頂点12枚。n-2=6 とは合わない
  ok(!looksLikeContour(8, new Array(36).fill(0).map((_, i) => i % 8)),
     "立方体(8頂点12枚)は輪郭ではない");
}
ok(!looksLikeContour(100, fan(50)), "三角形の数が足りないものは輪郭ではない");
ok(!looksLikeContour(4, [0, 1, 2, 0, 2, 3, 0, 1, 3]), "三角形が多すぎるものは輪郭ではない");
{
  // 頂点が余る形。輪郭なら全ての頂点が辺に使われる
  const idx = fan(5);            // 5頂点3枚ぶん
  ok(!looksLikeContour(6, idx.concat([0, 1, 2])),
     "使われない頂点が残る形は輪郭ではない");
}

/* ---------- 壊れた入力 ---------- */
ok(!looksLikeContour(5, null), "インデックスが無ければ輪郭と見なさない");
ok(!looksLikeContour(0, []), "頂点が無ければ輪郭ではない");
ok(!looksLikeContour(2, [0, 1, 0]), "2頂点では輪郭にならない");
ok(!looksLikeContour(4, [0, 1, 9, 0, 2, 3]), "範囲外のインデックスがあれば断る");
ok(!looksLikeContour(4, [0, 1, -1, 0, 2, 3]), "負のインデックスがあれば断る");
{
  // 型付き配列でも動く(GLBから読むとこちらになる)
  ok(looksLikeContour(6, Uint16Array.from(fan(6))), "Uint16Arrayでも判定できる");
  ok(looksLikeContour(6, Uint32Array.from(fan(6))), "Uint32Arrayでも判定できる");
}

/* ---------- 取り違えの代償を確かめる ---------- */
{
  // 四角い板は「輪郭」と見なされる。これは誤判定ではなく、実際に輪郭である。
  // 一般のメッシュを誤って拾わないことのほうが大事
  ok(looksLikeContour(4, fan(4)), "四角い板は輪郭として扱ってよい(実際に多角形)");
  // 典型的な3Dメッシュは拾わない
  ok(!looksLikeContour(20, fan(10).concat(fan(10).map((v) => v + 10))),
     "2つの面を持つメッシュは拾わない");
}

/* ---------- 傾きラインの素を戻す ---------- */
/* 線の位置・浮かせ量・矩形の回転角は属性計算の途中結果で、**形からは復元できない**。
   台紙GLBに書いておき、読むときに戻す。壊れた値のまま描くと線が飛んだり
   浮かせ量がNaNになって消えたりするので、揃っていないものは返さない */
{
  const good = { a: [1, 2, 3], b: [4, 5, 6], n: [0, 0, 1], f: 0.02, angle: 12.3 };
  const r = unpackRectLine(good);
  ok(!!r, "揃っていれば戻る");
  ok(JSON.stringify(r.a) === "[1,2,3]" && JSON.stringify(r.b) === "[4,5,6]", "端点がそのまま戻る");
  ok(JSON.stringify(r.n) === "[0,0,1]", "法線がそのまま戻る");
  ok(r.f === 0.02 && r.angle === 12.3, "浮かせ量と角度が戻る");
  ok(r.a !== good.a, "**元の配列を共有しない**(読み込んだJSONを書き換えない)");
}
ok(unpackRectLine(null) === null, "中身が無ければ返さない");
ok(unpackRectLine(undefined) === null, "undefinedでも落ちない");
ok(unpackRectLine({}) === null, "空のものは返さない");
ok(unpackRectLine({ a: [1, 2, 3], b: [4, 5, 6] }) === null, "法線が欠けていれば返さない");
ok(unpackRectLine({ a: [1, 2], b: [4, 5, 6], n: [0, 0, 1] }) === null, "端点が2つしか無ければ返さない");
ok(unpackRectLine({ a: [1, 2, "x"], b: [4, 5, 6], n: [0, 0, 1] }) === null, "数でない値が混じれば返さない");
ok(unpackRectLine({ a: [1, 2, NaN], b: [4, 5, 6], n: [0, 0, 1] }) === null, "**NaNが混じれば返さない**(線が消える原因になる)");
ok(unpackRectLine({ a: [1, 2, Infinity], b: [4, 5, 6], n: [0, 0, 1] }) === null, "無限大が混じれば返さない");
{
  // 浮かせ量と角度は欠けても描ける。0として扱う
  const r = unpackRectLine({ a: [1, 2, 3], b: [4, 5, 6], n: [0, 0, 1] });
  ok(!!r && r.f === 0 && r.angle === 0, "浮かせ量と角度が無ければ0にする(線は描ける)");
  const r2 = unpackRectLine({ a: [1, 2, 3], b: [4, 5, 6], n: [0, 0, 1], f: NaN });
  ok(!!r2 && r2.f === 0, "浮かせ量がNaNなら0にする");
}

/* ---------- 古い台紙から輪郭の頂点を取り戻す ---------- */
/* v1.33.0より前の台紙GLBには傾きラインの素が入っていない。輪郭の頂点は
   ジオメトリに残っているので、属性計算が使う並び(Z-up)へ戻して計算し直す。
   読み込み時に (x,y,z) -> (x, z, -y) と並べ替えているので、その逆をする */
{
  const v = contourVertsFromPositions([1, 2, 3]);
  ok(v.length === 1, "1頂点ぶん返る", String(v.length));
  ok(JSON.stringify(v[0]) === "[1,-3,2]",
     "**並べ替えの逆になっている** (x,y,z) -> (x,-z,y)", JSON.stringify(v[0]));
}
{
  // 往復させると元に戻る(読み込み時の変換と組み合わせて確かめる)
  const zUp = [[1.5, -2.25, 3.75], [0, 4, -1]];
  const yUp = [];
  for (const [x, y, z] of zUp) yUp.push(x, z, -y);     // 読み込み時と同じ並べ替え
  const back = contourVertsFromPositions(yUp);
  ok(JSON.stringify(back) === JSON.stringify(zUp),
     "往復して元の座標に戻る", JSON.stringify(back));
}
{
  const v = contourVertsFromPositions([0,0,0, 1,0,0, 0,0,-1]);
  ok(v.length === 3, "3頂点ぶん返る", String(v.length));
}
ok(contourVertsFromPositions([]).length === 0, "空なら空が返る");
ok(contourVertsFromPositions([1, 2]).length === 0, "3つに満たない端数は捨てる");
ok(contourVertsFromPositions([1,2,3, 4,5]).length === 1, "端数があっても揃っている分だけ返す");
{
  // GLBから読むと型付き配列になる
  const v = contourVertsFromPositions(Float32Array.from([1, 2, 3]));
  ok(v.length === 1 && v[0][0] === 1, "Float32Arrayでも扱える");
}

/* ---------- 原点の寄せ量(背景モデルとの位置合わせ。v1.55.2) ---------- */
{
  const X = require("./extracted.js");
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const o = X.worldOffsetFromGLTF({ asset: { extras: { worldOffset: [-36513.7965, -148202.306, 63.2579] } } });
  ok(o && near(o[0], -36513.7965) && near(o[1], -148202.306) && near(o[2], 63.2579), "GLBに書いた寄せ量をそのまま読む");
  ok(X.worldOffsetFromGLTF({ asset: { version: "2.0" } }) === null, "書いていないGLB(古い版・他のソフト)は null");
  ok(X.worldOffsetFromGLTF({ asset: { extras: { worldOffset: [1, "2", 3] } } }) === null, "数でない値があれば null");
  ok(X.worldOffsetFromGLTF({ asset: { extras: { worldOffset: [1, NaN, 3] } } }) === null, "NaN なら null");
  ok(X.worldOffsetFromGLTF({ asset: { extras: { worldOffset: [1, 2] } } }) === null, "3つ揃っていなければ null");
  ok(X.worldOffsetFromGLTF(null) === null, "null でも落ちない");
  const m = X.vertexMean(new Float32Array([0, 0, 0, 4, 0, 0, 4, 2, 0, 0, 2, 0, 1, 1, 0]));
  ok(m && near(m[0], 1.8) && near(m[1], 1) && near(m[2], 0), "頂点の平均(外接箱の中心とは違う値になる形で)");
  ok(X.vertexMean(new Float32Array(0)) === null && X.vertexMean(null) === null, "頂点が無ければ null");

  /* 現在のビューに入れる石(§8.4)。画面(NDC -1〜1)に少しでも掛かれば入れる */
  const V = X.ndcBoxOverlapsView;
  ok(V([[0, 0], [0.2, 0.1], [0.1, 0.3]]), "画面の中の石は入れる");
  ok(V([[0.9, 0], [1.4, 0.1], [1.2, 0.3]]), "画面の端に掛かる石は入れる(はみ出す部分は切り取る)");
  ok(V([[-2, -2], [2, -2], [2, 2], [-2, 2]]), "画面より大きく、画面を覆う石も入れる");
  ok(!V([[1.1, 0], [1.6, 0.1], [1.3, 0.3]]), "右の外の石は入れない");
  ok(!V([[-3, 0], [-1.2, 0.1], [-2, 0.3]]), "左の外の石は入れない");
  ok(!V([[0, 1.05], [0.2, 1.4], [0.1, 1.2]]), "上の外の石は入れない");
  ok(!V([]) && !V(null), "点が無ければ入れない");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
