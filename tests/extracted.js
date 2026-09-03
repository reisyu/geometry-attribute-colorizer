/* このファイルは extract_for_tests.js が index.html から自動生成します。

   直接編集しないでください。 */



function nextFrame(){ return Promise.resolve(); }

const HUE_RANGES = { RED_BLUE: [0.0, 0.66], RED_GREEN: [0.0, 0.33], YELLOW_BLUE: [0.16, 0.66] };

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

const PALETTE = [
  [0.90, 0.20, 0.20], [0.20, 0.55, 0.90], [0.25, 0.75, 0.35], [0.95, 0.65, 0.15],
  [0.60, 0.30, 0.80], [0.20, 0.80, 0.80], [0.85, 0.75, 0.15], [0.90, 0.45, 0.65],
  [0.55, 0.40, 0.25], [0.45, 0.85, 0.55], [0.35, 0.35, 0.85], [0.95, 0.45, 0.20],
  [0.50, 0.70, 0.90], [0.75, 0.55, 0.85], [0.70, 0.70, 0.35], [0.30, 0.60, 0.55],
  [0.85, 0.60, 0.50], [0.55, 0.25, 0.45], [0.40, 0.50, 0.30], [0.65, 0.65, 0.75],
];

const NOTE_COL = "Note";

const NOTE_LABEL_MAX = 12;

const ATTR_INFO = {
  Width:     { jp: "幅",       desc: "最小外接矩形の2辺のうち、水平に近い方の辺の長さ" },
  Height:    { jp: "高さ",     desc: "最小外接矩形の2辺のうち、鉛直に近い方の辺の長さ" },
  Area:      { jp: "面積",     desc: "フィット平面に投影した輪郭の面積" },
  FillRate:  { jp: "矩形充填率", desc: "輪郭の面積 ÷ 外接矩形の面積(1に近いほど矩形に近い形)" },
  Aspect:    { jp: "アスペクト比", desc: "幅 ÷ 高さ。1より大きいほど横長、1より小さいほど縦長。1に近いほど正方形に近い" },
  Tilt:      { jp: "傾斜角",   desc: "面の法線と鉛直(+Z)のなす角。0°=水平な面、90°=垂直な面" },
  RectAngle: { jp: "矩形回転角", desc: "外接矩形の水平辺が面内の水平基準から回転している角度。反時計回り(右上がり)がプラス" },
  Flatness:  { jp: "平面性",   desc: "フィット平面からの最大ズレ距離。大きいほど平面近似の信頼性が低い" },
  Note: { jp: "メモ", desc: "点検時の所見などを自由に書き留める欄。属性インスペクタで編集し、CSVに書き出される" },
  HasNote: { jp: "メモの有無", desc: "メモが書かれていれば「あり」、空なら「なし」。メモ本文から自動で作られる列で、色分け・立面図で記入済みの箇所を見るために使う" },
  SelfIntersect: { jp: "自己交差", desc: "輪郭の自己交差の大きさ(0〜0.5)。0は交差なし。交差で分かれる小さい側のループが全体に占める面積比で、Areaはこの値の2倍だけ小さく出る" },
  X: { jp: "重心X", desc: "輪郭の重心のX座標(原点シフト前の元の座標値)" },
  Y: { jp: "重心Y", desc: "輪郭の重心のY座標(原点シフト前の元の座標値)" },
  Z: { jp: "重心Z", desc: "輪郭の重心のZ座標=標高(原点シフト前の元の座標値)" },
  SrcID: { jp: "元ID", desc: "読み込み時のID(DXFのレイヤー名由来)。自動採番で振り直される前の値" },
  Course: { jp: "段", desc: "立面図で下から数えた段(コース)番号。ID自動採番時の段判定に基づく" },
  Dataset: { jp: "データ名", desc: "書き出し時に付与されるデータセット識別名。複数データの横断分析での由来識別に使う" },
};

function normalizeId(raw) {
  const s = String(raw ?? "").trim();
  const n = Number(s);
  if (s !== "" && Number.isFinite(n)) return String(Math.trunc(n) === n ? Math.trunc(n) : n);
  return s;
}

function ocsToWcs(verts, n) {
  let [nx, ny, nz] = n;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  // X軸の選択: Nがワールド Z軸に近い場合は Wy×N、それ以外は Wz×N
  let ax = (Math.abs(nx) < 1 / 64 && Math.abs(ny) < 1 / 64)
    ? [nz, 0, -nx]     // Wy × N
    : [-ny, nx, 0];    // Wz × N
  const al = Math.hypot(...ax) || 1;
  ax = [ax[0] / al, ax[1] / al, ax[2] / al];
  const ay = [ny * ax[2] - nz * ax[1], nz * ax[0] - nx * ax[2], nx * ax[1] - ny * ax[0]];  // N × Ax
  return verts.map(([x, y, z]) => [
    x * ax[0] + y * ay[0] + z * nx,
    x * ax[1] + y * ay[1] + z * ny,
    x * ax[2] + y * ay[2] + z * nz,
  ]);
}

async function parseDXF(text, onProgress) {
  const lines = text.split(/\r?\n/);
  const polylines = [];
  const openLw = [];      // 閉じていないLWPOLYLINE(閉じたものが1つも無い場合のみ使う)
  let current = null;
  let inVertex = false;   // VERTEXエンティティの中にいるか
  let isLw = false;       // 現在の要素がLWPOLYLINEか
  let x = 0, y = 0;
  let lwX = null;         // LWPOLYLINEの頂点は 10(X) → 20(Y) の順に並ぶ
  let lwElev = 0;         // LWPOLYLINEの標高(38)。全頂点のZになる
  let bulges = 0;         // 円弧(バルジ)を直線とみなした数
  const totalPairs = lines.length;

  /* 収集した輪郭を確定して配列へ入れる。
     押し出し方向が(0,0,1)以外(Rhino等の2Dポリライン、OCS)ならWCSへ変換する */
  const finalize = (pl, into) => {
    if (!pl || pl.verts.length < 3) return;
    const [ex, ey, ez] = pl.ext;
    if (Math.abs(ex) > 1e-12 || Math.abs(ey) > 1e-12 || Math.abs(ez - 1) > 1e-12) {
      pl.verts = ocsToWcs(pl.verts, pl.ext);
    }
    delete pl.ext;
    delete pl.closed;
    into.push(pl);
  };

  /* LWPOLYLINEはSEQENDを持たず、次の要素の開始(コード0)かファイル末尾で終わる。
     標高は確定時にまとめて適用する(38は頂点の前後どちらに現れてもよいため) */
  const finalizeLw = () => {
    if (!isLw || !current) return;
    if (lwElev !== 0) for (const v of current.verts) v[2] = lwElev;
    finalize(current, current.closed ? polylines : openLw);
    current = null;
    isLw = false;
  };

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1].trim();
    if (code === "0") {
      finalizeLw();
      if (value === "LWPOLYLINE") {
        // AutoCAD R14以降の標準的なポリライン。頂点を10/20の並びで直接持つ
        current = { layer: "", verts: [], ext: [0, 0, 1], closed: false };
        isLw = true; inVertex = false; lwX = null; lwElev = 0;
      } else if (value === "POLYLINE") {
        current = { layer: "", verts: [], ext: [0, 0, 1] };
        inVertex = false;
      } else if (value === "VERTEX") {
        inVertex = true;
      } else if (value === "SEQEND") {
        finalize(current, polylines);
        current = null;
        inVertex = false;
      }
    } else if (current) {
      if (code === "8" && current.layer === "") current.layer = value;
      else if (isLw) {
        // LWPOLYLINEはZを頂点ごとに持たず、標高(38)が全頂点に共通で効く
        if (code === "10") lwX = parseFloat(value);
        else if (code === "20" && lwX !== null) {
          current.verts.push([lwX, parseFloat(value), 0]);
          lwX = null;
        }
        else if (code === "38") lwElev = parseFloat(value);
        else if (code === "70") current.closed = (parseInt(value, 10) & 1) === 1;
        else if (code === "42" && parseFloat(value) !== 0) bulges++;  // 円弧は直線として扱う
        else if (code === "210") current.ext[0] = parseFloat(value);
        else if (code === "220") current.ext[1] = parseFloat(value);
        else if (code === "230") current.ext[2] = parseFloat(value);
      }
      else if (inVertex) {
        // 頂点はVERTEXエンティティ内でのみ収集する
        // (POLYLINEヘッダ自体にも10/20/30があるDXF(Rhino等)を誤読しないため)
        if (code === "10") x = parseFloat(value);
        else if (code === "20") y = parseFloat(value);
        else if (code === "30") current.verts.push([x, y, parseFloat(value)]);
      } else {
        // POLYLINEヘッダ: 押し出し方向(210/220/230)のみ読む
        if (code === "210") current.ext[0] = parseFloat(value);
        else if (code === "220") current.ext[1] = parseFloat(value);
        else if (code === "230") current.ext[2] = parseFloat(value);
      }
    }
    // 大規模ファイルでUIが固まらないよう、定期的にブラウザへ制御を返す
    if (onProgress && (i & 0x3FFFF) === 0 && i > 0) {
      onProgress(i / totalPairs);
      await nextFrame();
    }
  }
  finalizeLw();  // 末尾がLWPOLYLINEで終わるファイルの取りこぼしを防ぐ

  /* 閉じたLWPOLYLINEを優先する。一般的なCADのDXFは断面線などの開いた線を
     含むことがあり、それらを輪郭として扱うと無意味な属性が生まれるため。
     ただし閉じフラグを立てないツールもあるので、閉じたものが1つも無い場合に限り
     開いたものを採用する(0個で行き止まりになるのを避ける) */
  let openUsed = 0;
  if (polylines.length === 0 && openLw.length > 0) {
    openUsed = openLw.length;
    for (const pl of openLw) polylines.push(pl);
  }
  // 呼び出し側への補足情報(配列の要素数は変えずにプロパティで渡す)
  polylines.bulges = bulges;
  polylines.openSkipped = openUsed > 0 ? 0 : openLw.length;
  polylines.openUsed = openUsed;
  return polylines;
}

function newellNormal(verts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i], q = verts[(i + 1) % verts.length];
    nx += (p[1] - q[1]) * (p[2] + q[2]);
    ny += (p[2] - q[2]) * (p[0] + q[0]);
    nz += (p[0] - q[0]) * (p[1] + q[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

function convexHull2D(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function minAreaRect2D(hull) {
  let best = null, minArea = Infinity;
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const p1 = hull[i], p2 = hull[(i + 1) % n];
    const ex = p2[0] - p1[0], ey = p2[1] - p1[1];
    const len = Math.hypot(ex, ey);
    if (len < 1e-12) continue;
    const ux = ex / len, uy = ey / len;   // 辺方向
    const vx = -uy, vy = ux;              // 垂直方向
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [px, py] of hull) {
      const pu = px * ux + py * uy, pv = px * vx + py * vy;
      if (pu < minU) minU = pu; if (pu > maxU) maxU = pu;
      if (pv < minV) minV = pv; if (pv > maxV) maxV = pv;
    }
    const w = maxU - minU, h = maxV - minV, area = w * h;
    if (area < minArea) {
      minArea = area;
      // 矩形の中心(投影2D座標系での位置)も保持する
      const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
      best = {
        w, h, axisU: [ux, uy], axisV: [vx, vy],
        center: [ux * cu + vx * cv, uy * cu + vy * cv],
      };
    }
  }
  return best;
}

function computeContourAttributes(verts) {
  // フィット平面の基底(法線 + 面内の直交2軸)
  const normal = newellNormal(verts);
  // 法線がゼロに退化した輪郭(面積が完全に相殺する自己交差など)は計算不能として扱う
  if (normal[0] === 0 && normal[1] === 0 && normal[2] === 0) return null;
  let ref = Math.abs(normal[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
  const dot = ref[0] * normal[0] + ref[1] * normal[1] + ref[2] * normal[2];
  let u = [ref[0] - normal[0] * dot, ref[1] - normal[1] * dot, ref[2] - normal[2] * dot];
  const ulen = Math.hypot(...u) || 1;
  u = [u[0] / ulen, u[1] / ulen, u[2] / ulen];
  const v = [
    normal[1] * u[2] - normal[2] * u[1],
    normal[2] * u[0] - normal[0] * u[2],
    normal[0] * u[1] - normal[1] * u[0],
  ];

  // 重心を原点として平面(u, v)に投影
  const cx = verts.reduce((s, p) => s + p[0], 0) / verts.length;
  const cy = verts.reduce((s, p) => s + p[1], 0) / verts.length;
  const cz = verts.reduce((s, p) => s + p[2], 0) / verts.length;
  const pts2d = verts.map((p) => {
    const rx = p[0] - cx, ry = p[1] - cy, rz = p[2] - cz;
    return [rx * u[0] + ry * u[1] + rz * u[2], rx * v[0] + ry * v[1] + rz * v[2]];
  });

  // 面積(靴ひも公式)
  let area = 0;
  for (let i = 0; i < pts2d.length; i++) {
    const p = pts2d[i], q = pts2d[(i + 1) % pts2d.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  area = Math.abs(area) / 2;

  // 最小外接矩形
  const hull = convexHull2D(pts2d);
  const rect = minAreaRect2D(hull);
  if (!rect) return null;

  // 矩形の2軸を3Dに戻し、水平に近い方(Z成分が小さい方)をWidthとする
  const axis1 = [
    u[0] * rect.axisU[0] + v[0] * rect.axisU[1],
    u[1] * rect.axisU[0] + v[1] * rect.axisU[1],
    u[2] * rect.axisU[0] + v[2] * rect.axisU[1],
  ];
  const axis2 = [
    u[0] * rect.axisV[0] + v[0] * rect.axisV[1],
    u[1] * rect.axisV[0] + v[1] * rect.axisV[1],
    u[2] * rect.axisV[0] + v[2] * rect.axisV[1],
  ];
  let width, height, widthAxis;
  if (Math.abs(axis1[2]) <= Math.abs(axis2[2])) {
    width = rect.w; height = rect.h; widthAxis = axis1;
  } else {
    width = rect.h; height = rect.w; widthAxis = axis2;
  }

  const fillRate = (rect.w * rect.h) > 0 ? area / (rect.w * rect.h) : 0;

  // 法線と +Z ベクトルのなす角(傾斜角、度)を計算する
  // 法線は Newell 法で符号が決まるため、上下どちらを向いていても
  // 「面がどれだけ傾いているか」を表すよう 0〜90度に正規化する
  let tilt = Math.acos(Math.min(1, Math.max(-1, Math.abs(normal[2])))) * 180 / Math.PI;

  // 外接矩形の水平辺(widthAxis)が、面内での水平基準に対して
  // 反時計回りに何度回転しているかを符号付きで求める(RectAngle)。
  //   面内水平基準 h = 法線 × +Z を正規化したもの(面と水平面の交線 = 走向方向)
  //   面内鉛直基準 vv = 法線 × h (面内で上向き)
  //   widthAxis を (h, vv) 座標に射影し、atan2 で角度を出す
  const nz = [0, 0, 1];
  let h = [
    normal[1] * nz[2] - normal[2] * nz[1],
    normal[2] * nz[0] - normal[0] * nz[2],
    normal[0] * nz[1] - normal[1] * nz[0],
  ];
  let hlen = Math.hypot(...h);
  let rectAngle;
  let alignedWA = widthAxis;  // 符号を揃えた幅軸(中心線の描画に使う)
  if (hlen < 1e-9) {
    // 面がほぼ水平で「面内水平」が定義できない場合は角度0とする
    rectAngle = 0;
  } else {
    h = [h[0] / hlen, h[1] / hlen, h[2] / hlen];
    const vv = [
      normal[1] * h[2] - normal[2] * h[1],
      normal[2] * h[0] - normal[0] * h[2],
      normal[0] * h[1] - normal[1] * h[0],
    ];
    // widthAxis は向きが2通りあるので、面内水平基準と同じ側(h方向成分が正)に揃える
    let wa = widthAxis.slice();
    const dotH = wa[0] * h[0] + wa[1] * h[1] + wa[2] * h[2];
    if (dotH < 0) wa = [-wa[0], -wa[1], -wa[2]];
    alignedWA = wa;
    const compH = wa[0] * h[0] + wa[1] * h[1] + wa[2] * h[2];
    const compV = wa[0] * vv[0] + wa[1] * vv[1] + wa[2] * vv[2];
    // 反時計回り(面内上向き成分が正)をプラスにする
    rectAngle = Math.atan2(compV, compH) * 180 / Math.PI;
  }

  // 中心線(傾きライン): 外接矩形の水平寄りの軸に沿った、矩形中心を通る線分の3D端点。
  // 矩形回転角の可視化(石の「通り」の分析)に使う
  const rcx = cx + u[0] * rect.center[0] + v[0] * rect.center[1];
  const rcy = cy + u[1] * rect.center[0] + v[1] * rect.center[1];
  const rcz = cz + u[2] * rect.center[0] + v[2] * rect.center[1];
  const halfW = width / 2;
  const rectLine = {
    a: [rcx - alignedWA[0] * halfW, rcy - alignedWA[1] * halfW, rcz - alignedWA[2] * halfW],
    b: [rcx + alignedWA[0] * halfW, rcy + alignedWA[1] * halfW, rcz + alignedWA[2] * halfW],
    n: normal.slice(),  // 面の法線(描画時に面から浮かせるために使う)
  };

  // 平面性: フィット平面(重心を通る)からの最大ズレ距離
  let flatness = 0;
  for (const p of verts) {
    const d = Math.abs((p[0] - cx) * normal[0] + (p[1] - cy) * normal[1] + (p[2] - cz) * normal[2]);
    if (d > flatness) flatness = d;
  }

  // 自己交差: 投影した2D輪郭で、頂点を共有しない辺どうしの交差を調べ、
  // 「交差の大きさ」を0〜0.5の実数で返す(0=交差なし)。
  //
  // 値の定義: 交差点で輪郭はちょうど2つのループに分かれる。その小さい側の
  // 面積が、その交差によって生じた誤差の実体である。全体に対する比を値とする。
  // 二重に周回する小ループは靴ひも面積で打ち消されるため、**Areaはこの値の
  // 2倍だけ過小評価される**(比0.01ならAreaが約2%小さく出る)。
  // しきい値を「許容できるAreaの誤差÷2」で決められるようにするための定義。
  //
  // 0/1の二値にしないのは、輪郭が視線方向に折り返している石(オーバーハングを
  // 回り込んだ輪郭など)では投影の結果として必ず小さな交差が出るため。
  // 実測ではそれは面積比3%以下に収まり、頂点の順序が壊れた輪郭(中央値12.6%)
  // とは桁で分かれる。二値にすると両者を区別できない。詳細は SPECIFICATION §5.1.1。
  //
  // 向きの判定を三値(-1/0/+1)にしているのが要点。二値(cr > 0)で書くと共有頂点や
  // 長さ0の辺で外積が厳密に0になったとき「負」へ倒れ、正常な輪郭を交差と誤判定する。
  // かつてはこれをリング距離Kで迂回していたが、Kは離れた辺どうしの本物の交差まで
  // 捨てていた(12頂点以上の輪郭で15%前後を見逃していた)。
  const SX_EPS = 1e-12;  // 外積を辺長で正規化した相対値。角度の正弦がこれ未満なら共線とみなす
  const sxOrient = (o, p, q) => {
    const ux = p[0] - o[0], uy = p[1] - o[1], vx = q[0] - o[0], vy = q[1] - o[1];
    const cr = ux * vy - uy * vx;
    const sc = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    if (!(Math.abs(cr) > SX_EPS * sc)) return 0;   // NaNもここで0に落ちる
    return cr > 0 ? 1 : -1;
  };
  const sxArea = (pts) => {
    let s = 0;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  };
  let selfIntersect = 0;
  const np = pts2d.length;
  for (let i = 0; i < np; i++) {
    const a = pts2d[i], b = pts2d[(i + 1) % np];
    // 辺のAABBが重ならないペアを先に捨てる。三値判定はhypotを使うぶん重く、
    // これが無いと1万輪郭で6倍(12ms→80ms)かかる
    const ax0 = Math.min(a[0], b[0]), ax1 = Math.max(a[0], b[0]);
    const ay0 = Math.min(a[1], b[1]), ay1 = Math.max(a[1], b[1]);
    for (let j = i + 1; j < np; j++) {
      if ((i + 1) % np === j || (j + 1) % np === i) continue;  // 頂点を共有する辺は対象外
      const c = pts2d[j], d = pts2d[(j + 1) % np];
      if (Math.min(c[0], d[0]) > ax1 || Math.max(c[0], d[0]) < ax0) continue;
      if (Math.min(c[1], d[1]) > ay1 || Math.max(c[1], d[1]) < ay0) continue;
      const d1 = sxOrient(c, d, a), d2 = sxOrient(c, d, b);
      const d3 = sxOrient(a, b, c), d4 = sxOrient(a, b, d);
      if (!(d1 && d2 && d3 && d4 && d1 !== d2 && d3 !== d4)) continue;
      // 交点を求め、そこで分かれる2つのループの面積を比べる
      const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
      const den = rx * sy - ry * sx;
      if (den === 0) continue;
      const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
      const P = [a[0] + t * rx, a[1] + t * ry];
      const loopA = [P], loopB = [P];
      for (let k = i + 1; k <= j; k++) loopA.push(pts2d[k % np]);
      for (let k = j + 1; k <= i + np; k++) loopB.push(pts2d[k % np]);
      const sA = sxArea(loopA), sB = sxArea(loopB), all = sA + sB;
      // 交差が複数ある輪郭では、この分割は厳密でなくなる(各ループ自体がさらに
      // 交差しており、靴ひも面積では逆向きの周回が相殺されるため)。
      // ずれは両方向に出る。実測ではしきい値0.01をまたいで判断が変わるのは
      // 交差2個以上の2.8%だけなので許容している。詳細は §5.1.1
      if (all > 0) selfIntersect = Math.max(selfIntersect, Math.min(sA, sB) / all);
    }
  }

  // アスペクト比: 幅÷高さ。1より大きいほど横長、小さいほど縦長。
  // 高さが0に潰れた輪郭でInfinityにならないよう保護する(その場合はnull=値なし)
  const aspect = height > 1e-12 ? width / height : null;
  return { width, height, area, fillRate, tilt, rectAngle, flatness, selfIntersect, aspect, rectLine, pts2d };
}

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = i % 6;
  const r = [v, q, p, p, t, v][m], g = [t, v, v, q, p, p][m], b = [p, p, t, v, v, q][m];
  return [r, g, b];
}

function hexToRgb01(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function lerpColor(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function numericToColor(value, vmin, vmax, preset, cLow, cHigh, useMid, cMid, invert) {
  let t = vmax === vmin ? 0.5 : Math.max(0, Math.min(1, (value - vmin) / (vmax - vmin)));
  if (!Number.isFinite(t)) t = 0.5;  // NaN/Infinityの防御(通常経路では到達しないが純関数として保証)
  if (invert) t = 1 - t;
  if (preset === "CUSTOM") {
    if (useMid) {
      return t <= 0.5 ? lerpColor(cLow, cMid, t / 0.5) : lerpColor(cMid, cHigh, (t - 0.5) / 0.5);
    }
    return lerpColor(cLow, cHigh, t);
  }
  if (preset === "GRAYSCALE") return [t, t, t];
  const [h0, h1] = HUE_RANGES[preset] || HUE_RANGES.RED_BLUE;
  return hsvToRgb(h0 + (h1 - h0) * t, 0.85, 0.95);
}

function isNumericColumn(rows, col) {
  for (const row of rows) {
    const v = (row[col] ?? "").toString().trim();
    if (v === "") continue;
    if (!Number.isFinite(Number(v))) return false;
  }
  return true;
}

function symmetricAngleColor(angle, centerRGB, edgeRGB) {
  const t = Math.max(0, Math.min(1, Math.abs(angle) / 45));
  return [
    centerRGB[0] + (edgeRGB[0] - centerRGB[0]) * t,
    centerRGB[1] + (edgeRGB[1] - centerRGB[1]) * t,
    centerRGB[2] + (edgeRGB[2] - centerRGB[2]) * t,
  ];
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function formatValue(v) {
  const n = Number(v);
  return (String(v).trim() !== "" && Number.isFinite(n)) ? String(Number(n.toPrecision(5))) : String(v);
}

function labelText(key, v) {
  const s = formatValue(v);
  if (key !== NOTE_COL) return s;
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > NOTE_LABEL_MAX ? oneLine.slice(0, NOTE_LABEL_MAX) + "…" : oneLine;
}

function categoryColorByIndex(i) {
  if (i < PALETTE.length) return PALETTE[i];
  // 黄金角による自動生成(彩度・明度を交互に変えて識別性を補う)
  const hue = (i * 0.381966) % 1;
  const alt = i % 2 === 0;
  return hsvToRgb(hue, alt ? 0.80 : 0.55, alt ? 0.92 : 0.75);
}

function solveFitDistance(pts, tanH, tanV, radius) {
  function feasible(d) {
    let loU = -Infinity, hiU = Infinity, loV = -Infinity, hiV = Infinity;
    for (const p of pts) {
      const z = d + p.f;
      if (z <= 1e-9) return null;  // 頂点がカメラの後ろに来る距離は不可
      loU = Math.max(loU, p.u - z * tanH); hiU = Math.min(hiU, p.u + z * tanH);
      loV = Math.max(loV, p.v - z * tanV); hiV = Math.min(hiV, p.v + z * tanV);
    }
    if (loU > hiU || loV > hiV) return null;
    return { su: (loU + hiU) / 2, sv: (loV + hiV) / 2 };  // 区間中央=余白が対称
  }
  // 二分探索(上限は外接球フィットの距離。必ず実行可能)
  let lo = 1e-4;
  let hi = radius / Math.sin(Math.atan(Math.min(tanV, tanH))) + radius;
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    if (feasible(mid)) hi = mid; else lo = mid;
  }
  const s = feasible(hi);
  return { distance: hi, su: s.su, sv: s.sv };
}

function solveFitOrtho(minU, maxU, minV, maxV, aspect, margin = 0.05) {
  const halfW = (maxU - minU) / 2 / (1 - 2 * margin);
  const halfH = (maxV - minV) / 2 / (1 - 2 * margin);
  return {
    halfHeight: Math.max(halfH, halfW / aspect, 1e-6),
    cu: (minU + maxU) / 2,
    cv: (minV + maxV) / 2,
  };
}

function flipTriangleWinding(srcArr) {
  const out = new srcArr.constructor(srcArr.length);
  for (let t = 0; t < srcArr.length; t += 3) {
    out[t] = srcArr[t];
    out[t + 1] = srcArr[t + 2];
    out[t + 2] = srcArr[t + 1];
  }
  return out;
}

function parseGLB(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  // ヘッダー(12バイト)に満たないファイルをそのまま読むと、DataViewが
  // 英語の内部エラーを投げて利用者に意味が伝わらないため先に弾く
  if (dv.byteLength < 12) throw new Error("ファイルが空か、GLBとしては短すぎます");
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("GLB形式ではありません(マジックナンバー不一致)");
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error(`glTFバージョン${version}は未対応です(2のみ対応)`);

  let offset = 12;
  let json = null, bin = null;
  while (offset < dv.byteLength) {
    const chunkLen = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkType === 0x4e4f534a) { // JSON
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, chunkStart, chunkLen)));
    } else if (chunkType === 0x004e4942) { // BIN
      bin = arrayBuffer.slice(chunkStart, chunkStart + chunkLen);
    }
    offset = chunkStart + chunkLen;
  }
  if (!json) throw new Error("JSONチャンクが見つかりません");
  return { json, bin };
}

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC32_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function deflateRaw(bytes) {
  if (typeof CompressionStream === "undefined") return null;
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function buildZip(entries) {
  const enc = new TextEncoder();
  const body = [], central = [];
  let offset = 0;
  // 更新日時はMS-DOS形式(日付と時刻を16bitずつ、秒は2秒単位)
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const raw = enc.encode(e.text);
    let data = await deflateRaw(raw);
    let method = 8;
    if (!data || data.length >= raw.length) { data = raw; method = 0; }  // 縮まないなら無圧縮
    const crc = crc32(raw);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);       // 展開に必要なバージョン(2.0)
    local.setUint16(6, 0x0800, true);   // bit11: ファイル名はUTF-8
    local.setUint16(8, method, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, nameBytes.length, true);
    body.push(new Uint8Array(local.buffer), nameBytes, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);         // 作成バージョン
    dir.setUint16(6, 20, true);         // 展開に必要なバージョン
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, method, true);
    dir.setUint16(12, dosTime, true);
    dir.setUint16(14, dosDate, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, raw.length, true);
    dir.setUint16(28, nameBytes.length, true);
    dir.setUint32(42, offset, true);    // このファイルのローカルヘッダ位置
    central.push(new Uint8Array(dir.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);      // 中央ディレクトリの開始位置
  return new Blob([...body, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

function contourToSegments(p) {
  const n = Math.floor(p.length / 3);
  if (n < 2) return new Float32Array(0);
  const seg = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, o = i * 6;
    seg[o] = p[i * 3]; seg[o + 1] = p[i * 3 + 1]; seg[o + 2] = p[i * 3 + 2];
    seg[o + 3] = p[j * 3]; seg[o + 4] = p[j * 3 + 1]; seg[o + 5] = p[j * 3 + 2];
  }
  return seg;
}

function thickLineAttributes(seg) {
  const n = Math.floor(seg.length / 6);
  const pos = new Float32Array(n * 4 * 3);
  const aStart = new Float32Array(n * 4 * 3);
  const aEnd = new Float32Array(n * 4 * 3);
  const aExpand = new Float32Array(n * 4 * 2);
  const verts = n * 4;
  const idx = verts > 65535 ? new Uint32Array(n * 6) : new Uint16Array(n * 6);
  const side = [1, -1, 1, -1];      // 線に直交する向き
  const which = [-1, -1, 1, 1];     // -1: 始点側  +1: 終点側
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const sx = seg[o], sy = seg[o + 1], sz = seg[o + 2];
    const ex = seg[o + 3], ey = seg[o + 4], ez = seg[o + 5];
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k, p = v * 3;
      const atEnd = which[k] > 0;
      pos[p] = atEnd ? ex : sx; pos[p + 1] = atEnd ? ey : sy; pos[p + 2] = atEnd ? ez : sz;
      aStart[p] = sx; aStart[p + 1] = sy; aStart[p + 2] = sz;
      aEnd[p] = ex; aEnd[p + 1] = ey; aEnd[p + 2] = ez;
      aExpand[v * 2] = side[k];
      aExpand[v * 2 + 1] = which[k];
    }
    const b = i * 4;
    idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2;
    idx[o + 3] = b + 2; idx[o + 4] = b + 1; idx[o + 5] = b + 3;
  }
  return { position: pos, aStart: aStart, aEnd: aEnd, aExpand: aExpand, index: idx };
}

function distToSegmentSq(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0;
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  const qx = x0 + t * dx, qy = y0 + t * dy;
  return (px - qx) * (px - qx) + (py - qy) * (py - qy);
}

function normalizeClassValue(v) {
  let s = String(v == null ? "" : v);
  if (s.normalize) s = s.normalize("NFKC");
  s = s.replace(/[\s　]+/g, " ");
  return s.trim();
}

function isReservedColumn(name, idCol) {
  const n = String(name == null ? "" : name).trim();
  if (n === "") return true;
  if (Object.prototype.hasOwnProperty.call(ATTR_INFO, n)) return true;
  if (idCol && n === idCol) return true;
  if (n.toLowerCase() === "id") return true;
  return false;
}

module.exports = { PALETTE, NOTE_COL, NOTE_LABEL_MAX, ATTR_INFO, normalizeId, ocsToWcs, parseDXF, newellNormal, convexHull2D, minAreaRect2D, computeContourAttributes, hsvToRgb, hexToRgb01, lerpColor, numericToColor, isNumericColumn, symmetricAngleColor, csvEscape, formatValue, labelText, categoryColorByIndex, solveFitDistance, solveFitOrtho, flipTriangleWinding, parseGLB, crc32, deflateRaw, buildZip, contourToSegments, thickLineAttributes, distToSegmentSq, normalizeClassValue, isReservedColumn };
