const fs = require("fs");
const F = require("./tests/extracted.js");

(async () => {
  const pls = await F.parseDXF(fs.readFileSync("sample_ishigaki.dxf", "utf8"));
  // 座標はmm精度(小数3桁)に丸める。サンプル用途には十分で、埋め込みサイズを抑えられる
  const lines = pls.map((p) =>
    "  [" + p.verts.map((v) => "[" + v.map((n) => +n.toFixed(3)).join(",") + "]").join(",") + "],"
  );

  const head = [
    "/* 内蔵サンプルの輪郭データ。",
    "   実際の石垣調査で得られた sample_ishigaki.dxf（同梱）から輪郭座標だけを抜き出したもの。",
    "   DXF全文（約390KB）ではなく座標のみ（約24KB）を持つのは、index.html 1つで完結させる",
    "   方針（SPECIFICATION §2）を保ちつつファイルの肥大を避けるため。",
    "   座標はDXFと同じZ-up、mm精度に丸めてある。",
    "",
    "   以前は手続き的に生成した理想的な形（6段・整った矩形）だったが、実際の石垣と",
    "   かけ離れており、属性の分布が現実と合わなかった。実データに差し替えている。",
    "   更新する場合は node tools/embed_sample.js を実行する */",
    "const SAMPLE_CONTOURS = [",
  ];
  fs.writeFileSync("_sample_block.txt", head.concat(lines).concat(["];", ""]).join("\n"));
  console.log("輪郭数:", pls.length, " 生成サイズ:", (fs.statSync("_sample_block.txt").size / 1024).toFixed(0) + "KB");
})();
