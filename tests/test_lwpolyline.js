"use strict";
/*
 * LWPOLYLINE形式のDXF読み込みの検証。
 *
 * LWPOLYLINE は AutoCAD R14(1997年)以降の標準的なポリラインで、
 * AutoCAD・QGIS・Illustrator など一般的なツールが既定で書き出す形式。
 * 旧来の POLYLINE/VERTEX と違い、頂点を 10/20 の並びで直接持ち、
 * Z は標高(38)で全頂点に共通、SEQEND を持たず次の要素で終わる。
 *
 * 検証は index.html の parseDXF を extracted.js 経由でそのまま呼ぶ。
 */
const fs = require("fs");
const path = require("path");
const F = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`  ${c ? "OK" : "NG!!"}: ${n}`); };

(async () => {
  const text = fs.readFileSync(path.join(__dirname, "data", "lwpolyline.dxf"), "utf8");
  const pls = await F.parseDXF(text);

  // 閉じたLWPOLYLINEだけが輪郭として採用される(開いた線・LINEは対象外)
  ok(pls.length === 2, `閉じたLWPOLYLINEを2件読み込む (実際: ${pls.length})`);
  ok(pls.openSkipped === 1, `閉じていないポリライン1本を除外する (実際: ${pls.openSkipped})`);

  const byLayer = Object.fromEntries(pls.map((p) => [p.layer, p]));
  ok(!!byLayer["Stone_1"] && !!byLayer["Stone_2"], "レイヤー名を保持する");
  ok(!byLayer["Guide"], "LINEエンティティを輪郭として拾わない");
  ok(!byLayer["OpenPath_9"], "閉じていないポリラインを拾わない");

  // 頂点: 10/20の並びから正しく組み立てられているか
  const s1 = byLayer["Stone_1"];
  ok(s1.verts.length === 4, `Stone_1の頂点数が4 (実際: ${s1.verts.length})`);
  ok(s1.verts[0][0] === 0 && s1.verts[0][1] === 0, "1番目の頂点が(0,0)");
  ok(s1.verts[1][0] === 2 && s1.verts[1][1] === 0, "2番目の頂点が(2,0)");
  ok(s1.verts[2][0] === 2 && s1.verts[2][1] === 1, "3番目の頂点が(2,1)");
  ok(s1.verts.every((v) => v[2] === 0), "標高(38)が無ければZは0");

  // 標高(38)は全頂点のZに適用される
  const s2 = byLayer["Stone_2"];
  ok(s2.verts.every((v) => v[2] === 5), `標高38=5.0が全頂点のZになる (実際: ${s2.verts.map(v=>v[2]).join(",")})`);
  ok(s2.verts.length === 4, "Stone_2の頂点数が4");

  // 幾何属性が計算できる(下流の処理に繋がることの確認)
  const attrs = F.computeContourAttributes(s1.verts);
  ok(!!attrs, "computeContourAttributesが結果を返す");
  ok(Math.abs(attrs.area - 2) < 1e-9, `2x1の矩形の面積が2 (実際: ${attrs && attrs.area})`);
  ok(Math.abs(attrs.width - 2) < 1e-9, `幅が2 (実際: ${attrs && attrs.width})`);
  ok(Math.abs(attrs.height - 1) < 1e-9, `高さが1 (実際: ${attrs && attrs.height})`);

  // 閉じたものが1つも無いファイルでは、開いたポリラインを救済して採用する
  const openOnly = text
    .replace(/^70\n1$/gm, "70\n0")     // 閉じフラグを全て落とす
    .replace(/\n0\nLINE\n[\s\S]*?(?=\n0\nLWPOLYLINE)/, "");
  const pls2 = await F.parseDXF(openOnly);
  ok(pls2.length > 0, `閉じフラグが無い場合も救済して読み込む (実際: ${pls2.length})`);
  ok(pls2.openUsed === pls2.length, `救済したことを openUsed で通知する (実際: ${pls2.openUsed})`);

  // 従来のPOLYLINE/VERTEX形式が壊れていないこと(回帰確認)
  const legacy = fs.readFileSync(path.join(__dirname, "data", "sample_ishigaki.dxf"), "utf8");
  const pls3 = await F.parseDXF(legacy);
  ok(pls3.length > 0, `POLYLINE/VERTEX形式も従来どおり読める (実際: ${pls3.length})`);
  ok(pls3.openSkipped === 0, "POLYLINE形式では除外が発生しない");

  console.log(`\n===== ${pass}成功 / ${fail}失敗 =====`);
  process.exit(fail ? 1 : 0);
})();
