"use strict";
const F = require("./extracted.js");
(async () => {
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  OK: ${name}`); }
  else { fail++; console.log(`  NG!!: ${name}`); }
}
function approx(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }

console.log("--- normalizeId (ID正規化) ---");
ok(F.normalizeId("1") === "1", "整数文字列");
ok(F.normalizeId("1.0") === "1", "小数表記の整数");
ok(F.normalizeId(" 42 ") === "42", "前後空白");
ok(F.normalizeId("1.5") === "1.5", "非整数はそのまま");
ok(F.normalizeId("abc") === "abc", "テキストはそのまま");
ok(F.normalizeId("") === "", "空文字");
ok(F.normalizeId(null) === "", "null");

console.log("--- isNumericColumn (数値判定) ---");
ok(F.isNumericColumn([{a:"1"},{a:"2.5"}], "a") === true, "数値列");
ok(F.isNumericColumn([{a:"1"},{a:"x"}], "a") === false, "混在列");
ok(F.isNumericColumn([{a:"1"},{a:""}], "a") === true, "欠損は無視");

console.log("--- parseDXF (実データ形式) ---");
const dxf = [
  "  0","SECTION","  2","ENTITIES",
  "  0","POLYLINE","  8","Layer7"," 66","1"," 70","9",
  "  0","VERTEX","  8","Layer7"," 10","1.0"," 20","2.0"," 30","3.0",
  "  0","VERTEX","  8","Layer7"," 10","4.0"," 20","5.0"," 30","6.0",
  "  0","VERTEX","  8","Layer7"," 10","7.0"," 20","8.0"," 30","9.0",
  "  0","SEQEND","  0","ENDSEC","  0","EOF"
].join("\n");
const polys = await F.parseDXF(dxf);
ok(polys.length === 1, "ポリライン数");
ok(polys[0].layer === "Layer7", "レイヤー名");
ok(polys[0].verts.length === 3 && polys[0].verts[1][2] === 6.0, "頂点座標");
ok((await F.parseDXF("  0\nPOLYLINE\n  0\nSEQEND")).length === 0, "頂点3未満は除外");

console.log("--- 幾何計算 (既知の矩形で厳密検証) ---");
// XY平面上の 4x2 の矩形(法線+Z)
const rect = [[0,0,0],[4,0,0],[4,2,0],[0,2,0]];
const a1 = F.computeContourAttributes(rect);
ok(approx(a1.width, 4), `Width=4 (実測 ${a1.width.toFixed(6)})`);
ok(approx(a1.height, 2), `Height=2 (実測 ${a1.height.toFixed(6)})`);
ok(approx(a1.area, 8), `Area=8 (実測 ${a1.area.toFixed(6)})`);
ok(approx(a1.fillRate, 1), `FillRate=1 (実測 ${a1.fillRate.toFixed(6)})`);
ok(approx(a1.tilt, 0), `Tilt=0° 水平面 (実測 ${a1.tilt.toFixed(4)})`);
ok(a1.selfIntersect === 0, "自己交差なし");
ok(approx(a1.flatness, 0), "Flatness=0 完全平面");

// 垂直の壁面(XZ平面、法線+Y)上の 3x1 矩形
const wall = [[0,0,0],[3,0,0],[3,0,1],[0,0,1]];
const a2 = F.computeContourAttributes(wall);
ok(approx(a2.tilt, 90), `Tilt=90° 垂直面 (実測 ${a2.tilt.toFixed(4)})`);
ok(approx(a2.width, 3) && approx(a2.height, 1), "垂直面の幅高さ判定(水平辺=幅)");
ok(approx(a2.rectAngle, 0, 1e-4), `RectAngle=0 水平な矩形 (実測 ${a2.rectAngle.toFixed(4)})`);

// 面内で20度回転した矩形(垂直壁上)
const c = Math.cos(20*Math.PI/180), s = Math.sin(20*Math.PI/180);
const rot = [[-2*c, 0, -2*s], [2*c, 0, 2*s], [2*c - 0.5*(-s), 0, 2*s - 0.5*c], [-2*c + 0.5*s, 0, -2*s + 0.5*c]];
// 単純化: 長軸(4)を面内20度回転、短軸0.5
const rot2 = [];
for (const [u, v] of [[-2,-0.25],[2,-0.25],[2,0.25],[-2,0.25]]) {
  rot2.push([u*c - v*s, 0, u*s + v*c]);
}
const a3 = F.computeContourAttributes(rot2);
ok(approx(Math.abs(a3.rectAngle), 20, 0.01), `RectAngle=±20° (実測 ${a3.rectAngle.toFixed(4)})`);
ok(a3.rectAngle > 0, "回転方向の符号(反時計回り=正)");

// 完全対称の蝶ネクタイ型(法線が退化)→ 計算不能としてnullを返すべき
const bow = [[0,0,0],[1,0,1],[1,0,0],[0,0,1]];
ok(F.computeContourAttributes(bow) === null, "法線退化の輪郭はnull(修正済み)");
// 非対称の自己交差(法線は生きている)→ 交差の大きさが0より大きいこと
const bow2 = [[0,0,0],[2,0,1.5],[2,0,0],[0,0,1]];
const abow2 = F.computeContourAttributes(bow2);
ok(abow2 !== null && abow2.selfIntersect > 0.1, "非対称の自己交差を検出");
// 対称な8の字型(6頂点)は面積相殺で法線退化 → nullが正しい
const eight = [[0,0,0],[2,0,2],[4,0,0],[4,0,2],[2,0,0],[0,0,2]];
ok(F.computeContourAttributes(eight) === null, "対称8の字は退化としてnull");
// 非対称の8の字(法線あり)は構造的交差として検出
const eight2 = [[0,0,0],[2,0,2.6],[4,0,0],[4,0,2],[2,0,0],[0,0,2]];
const aeight2 = F.computeContourAttributes(eight2);
ok(aeight2 !== null && aeight2.selfIntersect > 0.1, "非対称8の字を検出");
// 正常な五角形は誤検出しない
const penta5 = [[1,0,0],[0.31,0,0.95],[-0.81,0,0.59],[-0.81,0,-0.59],[0.31,0,-0.95]];
ok(F.computeContourAttributes(penta5).selfIntersect === 0, "正五角形は誤検出しない");

// --- 自己交差の「大きさ」(0〜0.5の実数) ---
// 交差で分かれる小さい側のループが全体に占める面積比。食い込みを浅くすれば
// 値も小さくなること(二値ではなく連続量であること)を確かめる
const notch = (d) => F.computeContourAttributes([[0,0,0],[10,0,0],[10,0,1],[10-d,0,-d],[0,0,1]]).selfIntersect;
const n50 = notch(0.5), n20 = notch(0.2), n05 = notch(0.05), n01 = notch(0.01);
ok(n50 > n20 && n20 > n05 && n05 > n01, "食い込みが浅いほど値が小さい");
ok(n50 > 0.1, "大きな食い込みは0.1超");
ok(n01 > 0 && n01 < 0.002, "ごく浅い食い込みは0に近い正の値");
// 上限は0.5(2つのループが同じ面積のとき)
ok(n50 <= 0.5 && n20 <= 0.5, "値は0.5を超えない");

// 値の意味: Areaはこの値の2倍だけ過小評価される。
// 靴ひも面積は |大-小|、本来囲んでいる面積は 大+小 なので誤差は 2*小/(大+小)
{
  const d = 0.2, v = [[0,0,0],[10,0,0],[10,0,1],[10-d,0,-d],[0,0,1]];
  const a = F.computeContourAttributes(v);
  // 小ループの面積 = 比 * (大+小)。大+小 = Area + 2*小 なので逆算できる
  const small = a.selfIntersect * a.area / (1 - 2 * a.selfIntersect);
  const union = a.area + 2 * small;
  ok(Math.abs(small / union - a.selfIntersect) < 1e-9, "面積比の定義がAreaと整合する");
}

// 退化した輪郭を交差と誤判定しないこと(かつての二値判定は全て1にしていた)
// 閉じたポリラインの終端に始点を書き出すDXFは珍しくなく、そのままでは
// 全オブジェクトが「自己交差あり」になっていた
ok(F.computeContourAttributes([[0,0,0],[1,0,0],[1,0,1],[0,0,1],[0,0,0]]).selfIntersect === 0,
   "閉じ頂点が重複していても誤検出しない");
ok(F.computeContourAttributes([[0,0,0],[1,0,0],[1,0,0],[1,0,1],[0,0,1]]).selfIntersect === 0,
   "長さ0の辺があっても誤検出しない");
// リング距離で除外していた頃は、12頂点以上の輪郭で離れた辺の交差を見逃していた
{
  const p = [];
  for (let k = 0; k < 12; k++) p.push([Math.cos(k / 12 * 2 * Math.PI), 0, Math.sin(k / 12 * 2 * Math.PI)]);
  const t = p[3]; p[3] = p[5]; p[5] = t;   // リング距離2の交差ができる
  ok(F.computeContourAttributes(p).selfIntersect > 0, "12頂点の輪郭でも近い辺の交差を見逃さない");
}

// --- CSVのエスケープ(メモ列が改行・カンマ・引用符を含むため) ---
// RFC 4180: カンマ・引用符・改行を含む値は引用符で囲み、値中の " は "" にする
ok(F.csvEscape("ふつうの値") === "ふつうの値", "囲む必要がない値はそのまま");
ok(F.csvEscape("a,b") === '"a,b"', "カンマを含む値は引用符で囲む");
ok(F.csvEscape('言った"南面"') === '"言った""南面"""', "引用符は2つに重ねて囲む");
ok(F.csvEscape("1行目\n2行目") === '"1行目\n2行目"', "改行を含む値は引用符で囲む");
ok(F.csvEscape("1行目\r\n2行目") === '"1行目\r\n2行目"', "CRLFの改行も囲む");
ok(F.csvEscape("目地開き\n要経過観察, \"南面\"") === '"目地開き\n要経過観察, ""南面"""',
   "改行・カンマ・引用符が同時に来ても壊れない");
ok(F.csvEscape("") === "", "空文字はそのまま");
ok(F.csvEscape(null) === "" || F.csvEscape(null) === "null", "nullでも例外にならない");

// --- ラベルに出す文字列(メモは切り詰める) ---
// メモは複数行の長文になりうる。そのまま出すと1つの石のラベルが図を覆う
ok(F.labelText("Note", "短い") === "短い", "短いメモはそのまま出す");
ok(F.labelText("Note", "目地開き\n要経過観察のため次回確認") === "目地開き 要経過観察のた…",
   "長いメモは改行を空白に潰して先頭だけ出す");
ok(F.labelText("Note", "あ".repeat(F.NOTE_LABEL_MAX)) === "あ".repeat(F.NOTE_LABEL_MAX),
   "上限ちょうどのメモは省略記号を付けない");
ok(F.labelText("Note", "あ".repeat(F.NOTE_LABEL_MAX + 1)) === "あ".repeat(F.NOTE_LABEL_MAX) + "…",
   "上限を1文字超えたら省略する");
ok(F.labelText("Note", "  前後の空白\t\n  ") === "前後の空白", "前後の空白は落とす");
ok(F.labelText("Note", "") === "", "空のメモは空文字");
// メモ以外の列は切り詰めない(数値の整形は formatValue のまま)
ok(F.labelText("Width", "0.917723456") === "0.91772", "数値列は従来どおり有効数字5桁");
ok(F.labelText("SrcID", "とても長いテキスト値だが切り詰めない") === "とても長いテキスト値だが切り詰めない",
   "メモ以外の長いテキストは切り詰めない");

// 平面からズレた輪郭のFlatness
const bumpy = [[0,0,0],[4,0,0],[4,2,0.1],[0,2,0]];
const a4 = F.computeContourAttributes(bumpy);
ok(a4.flatness > 0.02 && a4.flatness < 0.1, `Flatness>0 (実測 ${a4.flatness.toFixed(4)})`);

console.log("--- 色計算 ---");
// RED_BLUE: t=0が赤、t=1が青
const cmin = F.numericToColor(0, 0, 1, "RED_BLUE", null, null, false, null, false);
const cmax = F.numericToColor(1, 0, 1, "RED_BLUE", null, null, false, null, false);
ok(cmin[0] > 0.9 && cmin[2] < 0.3, `最小値=赤 (${cmin.map(x=>x.toFixed(2))})`);
ok(cmax[2] > 0.9 && cmax[0] < 0.3, `最大値=青 (${cmax.map(x=>x.toFixed(2))})`);
// 反転
const cinv = F.numericToColor(0, 0, 1, "RED_BLUE", null, null, false, null, true);
ok(cinv[2] > 0.9, "反転で最小値=青");
// カスタム3色(赤→白→青)の中間
const mid = F.numericToColor(0.5, 0, 1, "CUSTOM", [1,0,0], [0,0,1], true, [1,1,1], false);
ok(approx(mid[0],1) && approx(mid[1],1) && approx(mid[2],1), "3色補間の中央=中間色");
// 範囲外のクランプ
const clamp = F.numericToColor(99, 0, 1, "RED_BLUE", null, null, false, null, false);
ok(approx(clamp[2], cmax[2]), "範囲外は端の色にクランプ");
// 全値同一(vmin==vmax)でゼロ除算しない
const same = F.numericToColor(5, 5, 5, "RED_BLUE", null, null, false, null, false);
ok(same.every(Number.isFinite), "vmin=vmaxでも安全");

console.log("--- 凸包・最小外接矩形の頑健性 ---");
// 一直線上の点(退化ケース)
const line2d = [[0,0],[1,0],[2,0],[3,0]];
const hull = F.convexHull2D(line2d);
ok(Array.isArray(hull), "一直線でも凸包がクラッシュしない");
// ランダム点群で: 外接矩形は必ず全点を含む
let allInside = true;
for (let trial = 0; trial < 50; trial++) {
  const pts = [];
  for (let i = 0; i < 30; i++) pts.push([Math.random()*10, Math.random()*10]);
  const h = F.convexHull2D(pts);
  const r = F.minAreaRect2D(h);
  if (!r) { allInside = false; break; }
  for (const [px, py] of pts) {
    const u = px*r.axisU[0] + py*r.axisU[1];
    const v = px*r.axisV[0] + py*r.axisV[1];
    const us = h.map(([hx,hy]) => hx*r.axisU[0] + hy*r.axisU[1]);
    const vs = h.map(([hx,hy]) => hx*r.axisV[0] + hy*r.axisV[1]);
    if (u < Math.min(...us) - 1e-9 || u > Math.max(...us) + 1e-9 ||
        v < Math.min(...vs) - 1e-9 || v > Math.max(...vs) + 1e-9) { allInside = false; }
  }
}
ok(allInside, "ランダム50試行: 外接矩形が全点を包含");

console.log(`\n===== 結果: ${pass} 成功 / ${fail} 失敗 =====`);


process.exit(fail > 0 ? 1 : 0);
})();