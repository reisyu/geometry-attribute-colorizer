"use strict";
const fs = require("fs");
const path = require("path");
const F = require("./extracted.js");

(async () => {
  // リポジトリ同梱のサンプルで検証する。
  // 大規模な実データを持っている場合は、環境変数で差し替えられる:
  //   GAC_TEST_DXF=/path/to/large.dxf node integration_test.js
  const dxfPath = process.env.GAC_TEST_DXF || path.join(__dirname, "..", "sample_ishigaki.dxf");
  const text = fs.readFileSync(dxfPath, "utf8");
  const t0 = Date.now();
  const contours = await F.parseDXF(text);
  const tParse = Date.now() - t0;

  const t1 = Date.now();
  let ok = 0, failed = 0, selfX = 0;
  const stats = { w: [], fill: [], tilt: [], ra: [], flat: [] };
  for (const c of contours) {
    const a = F.computeContourAttributes(c.verts);
    if (!a) { failed++; continue; }
    ok++;
    if (a.selfIntersect) selfX++;
    stats.w.push(a.width); stats.fill.push(a.fillRate);
    stats.tilt.push(a.tilt); stats.ra.push(a.rectAngle); stats.flat.push(a.flatness);
  }
  const tCalc = Date.now() - t1;

  const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
  const mm = (arr) => [Math.min(...arr), Math.max(...arr)];

  console.log(`統合テスト(実JSコード使用): ${path.basename(dxfPath)}`);
  console.log(`  パース: ${contours.length} 輪郭, ${tParse}ms`);
  console.log(`  属性計算: 成功 ${ok} / 失敗 ${failed}, ${tCalc}ms`);
  console.log(`  自己交差の検出: ${selfX} 個`);
  console.log(`  Width: ${mm(stats.w).map(x=>x.toFixed(3))} 平均 ${mean(stats.w).toFixed(3)}`);
  console.log(`  FillRate: ${mm(stats.fill).map(x=>x.toFixed(3))} 平均 ${mean(stats.fill).toFixed(3)}`);
  console.log(`  Tilt: ${mm(stats.tilt).map(x=>x.toFixed(1))} 平均 ${mean(stats.tilt).toFixed(1)}`);
  console.log(`  RectAngle: ${mm(stats.ra).map(x=>x.toFixed(1))}`);
  console.log(`  Flatness: 最大 ${Math.max(...stats.flat).toFixed(4)}`);

  // 妥当性の自動判定
  const checks = [
    [ok === contours.length, "全輪郭の計算成功"],
    [stats.fill.every((f) => f >= 0 && f <= 1.001), "FillRateが全て0-1"],
    [stats.ra.every((r) => r >= -45.001 && r <= 45.001), "RectAngleが全て±45内"],
    [stats.tilt.every((t) => t >= 0 && t <= 90.001), "Tiltが全て0-90"],
    [tParse + tCalc < 15000, "処理時間が実用範囲(15秒未満)"],
  ];
  let pass = 0;
  for (const [cond, name] of checks) {
    console.log(`  ${cond ? "OK" : "NG!!"}: ${name}`);
    if (cond) pass++;
  }
  console.log(`\n===== 統合テスト: ${pass}/${checks.length} =====`);
  process.exit(pass === checks.length ? 0 : 1);
})();
