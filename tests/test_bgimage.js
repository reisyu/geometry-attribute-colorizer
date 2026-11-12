"use strict";
/*
 * 図面(SVG)に入れる背景モデルの画像(§8.8)。
 *
 * 背景モデル(フォトグラメトリのOBJ)は写真つきの面なので、図面には画像として
 * 埋め込む。描く処理そのものはWebGLに依るのでここでは扱えない。検証するのは
 * 「何画素で作るか」と「どれだけ大きくなるかの見積もり」を決める純関数。
 *
 * 画素数を誤ると、粗くて印刷に耐えない図か、端末が扱えずに何も描けない図になる。
 * 大きさの見積もりは、まとめ書き出しの確認ダイアログに出す数字で、
 * 利用者はこれを見て入れるかどうかを決める。
 */
const { backgroundImageSize, approxMB } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };
const j = (a) => JSON.stringify(a);

/* ---------- 何画素で作るか ---------- */
{
  // 図は横1700px前後。2倍の画素数で作る(印刷で粗く見えないように)
  const s = backgroundImageSize(1700, 1100, 16384);
  ok(s.w === 3400 && s.h === 2200, "**図の2倍の画素数で作る**", j(s));
}
{
  // 端末が扱える上限を超えない。超えると描画先を作れず、何も描けない
  const s = backgroundImageSize(1700, 1100, 2048);
  ok(s.w === 2048, "**端末の上限で抑える**(横)", j(s));
  ok(Math.abs(s.w / s.h - 1700 / 1100) < 0.01, "**縦横比は保つ**(保たないと輪郭と写真がずれる)", j(s));
}
{
  // 上限はこちらでも決めておく(長辺4096)。端末が大きな値を返しても、ファイルを膨らませない
  const s = backgroundImageSize(1700, 4000, 16384);
  ok(s.h === 4096 && s.w < 3400, "長辺は4096まで(縦長の壁でも抑える)", j(s));
  ok(Math.abs(s.w / s.h - 1700 / 4000) < 0.01, "縦長でも縦横比は保つ", j(s));
}
{
  // 小さい図は2倍止まり。上限まで引き伸ばさない
  const s = backgroundImageSize(400, 300, 16384);
  ok(s.w === 800 && s.h === 600, "小さい図を上限まで引き伸ばさない(2倍まで)", j(s));
}
{
  const s = backgroundImageSize(1700.4, 1100.6, 16384);
  ok(Number.isInteger(s.w) && Number.isInteger(s.h), "画素数は整数にする", j(s));
}
ok(backgroundImageSize(0, 100, 4096) === null, "幅0は作れない(null)");
ok(backgroundImageSize(100, -5, 4096) === null, "負の高さは作れない(null)");
ok(backgroundImageSize(NaN, 100, 4096) === null, "数でない幅は作れない(null)");
ok(backgroundImageSize(null, null, 4096) === null, "nullでも落ちない");
{
  // 端末の上限が取れない(0・未定義)ときは、こちらの上限だけで決める
  const a = backgroundImageSize(1700, 1100, 0), b = backgroundImageSize(1700, 1100, undefined);
  ok(a.w === 3400 && b.w === 3400, "端末の上限が取れなくても作れる", j([a, b]));
}
{
  const s = backgroundImageSize(100000, 10, 4096);
  ok(s.w === 4096 && s.h >= 1, "極端に細長くても、高さが0にならない", j(s));
}

/* ---------- どれだけ大きくなるか ---------- */
/* 画像はSVGの中に文字(base64)のまま入るので、文字数がほぼそのままバイト数になる */
ok(approxMB(1024 * 1024, 1) === 1, "100万字強で約1MB", j(approxMB(1024 * 1024, 1)));
ok(approxMB(2 * 1024 * 1024, 10) === 20, "**枚数分かける**(2MBの画像が10枚で20MB)", j(approxMB(2 * 1024 * 1024, 10)));
ok(approxMB(1.94 * 1024 * 1024, 1) === 1.9, "小数1桁に丸める", j(approxMB(1.94 * 1024 * 1024, 1)));
ok(approxMB(500000, 0) === approxMB(500000, 1), "枚数0は1枚として扱う(0MBと出さない)");
ok(approxMB(500000, undefined) === approxMB(500000, 1), "枚数が無くても落ちない");
ok(approxMB(0, 5) === 0, "画像が無ければ0");

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
