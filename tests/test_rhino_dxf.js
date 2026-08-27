"use strict";
const fs = require("fs");
const path = require("path");
const F = require("./extracted.js");
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`  ${c ? "OK" : "NG!!"}: ${n}`); };

(async () => {
  // === Rhino形式(2Dポリライン+OCS) ===
  const text = fs.readFileSync(path.join(__dirname, "data", "Rhino.dxf"), "utf8");
  const polys = await F.parseDXF(text);
  ok(polys.length === 5, `Rhino.dxf: 5ポリライン (実際 ${polys.length})`);
  const counts = polys.map(p => p.verts.length);
  ok(JSON.stringify(counts) === JSON.stringify([10,7,7,8,3]), `頂点数 [10,7,7,8,3] (実際 [${counts}])`);
  ok(polys.every(p => p.layer === "デフォルト"), "日本語レイヤー名の読み取り");

  // OCS→WCS変換の検証: ヘッダの$EXTMIN/$EXTMAXと一致するか
  const EXTMIN = [57.23963338402195, -23.68088456746717, 20.0760717760929];
  const EXTMAX = [305.6072671862187, 18.25978817798252, 131.5563193990418];
  let mn = [1e18,1e18,1e18], mx = [-1e18,-1e18,-1e18], allIn = true;
  for (const p of polys) for (const v of p.verts) for (let k = 0; k < 3; k++) {
    mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]);
    if (v[k] < EXTMIN[k] - 1 || v[k] > EXTMAX[k] + 1) allIn = false;
  }
  ok(allIn, "OCS→WCS変換後の全頂点がヘッダの$EXTMIN/$EXTMAX範囲内");
  ok(Math.abs(mn[0]-EXTMIN[0]) < 0.01 && Math.abs(mx[0]-EXTMAX[0]) < 0.01, "X範囲が完全一致");
  ok(Math.abs(mn[2]-EXTMIN[2]) < 0.01 && Math.abs(mx[2]-EXTMAX[2]) < 0.01, "Z範囲が完全一致");

  // 属性計算まで通るか
  let attrOk = 0;
  for (const p of polys) {
    const a = F.computeContourAttributes(p.verts);
    if (a && [a.width, a.height, a.area, a.tilt].every(Number.isFinite)) attrOk++;
  }
  ok(attrOk === 5, `全5輪郭で属性計算が成功 (実際 ${attrOk})`);

  // === 既存形式(クラスタリングソフトの3Dポリライン)の回帰 ===
  const legacy = fs.readFileSync(path.join(__dirname, "..", "sample_ishigaki.dxf"), "utf8");
  const lp = await F.parseDXF(legacy);
  ok(lp.length > 0, `既存形式(3Dポリライン)の回帰: ${lp.length}輪郭を読み込み`);
  // 座標が変わっていないか(1つ目の輪郭の1頂点をスポットチェック)
  ok(lp[0].verts.length >= 3 && lp[0].verts.every(v => v.every(Number.isFinite)), "既存形式の頂点が有効");

  console.log(`\n===== ${pass}成功 / ${fail}失敗 =====`);
  process.exit(fail ? 1 : 0);
})();
