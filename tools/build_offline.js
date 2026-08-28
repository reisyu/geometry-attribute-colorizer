#!/usr/bin/env node
/*
 * オフライン版(単一HTMLファイル)を作る。
 *
 *   node tools/build_offline.js
 *   → dist/geometry-attribute-colorizer_offline.html
 *
 * 通常版はThree.jsとPapaParseをCDNから読み込むため、ネットワークが無い/
 * CDNがブロックされている環境では起動できない。講習会など会場のネットワークが
 * 当てにならない場面のために、2つのライブラリを本体に埋め込んだ単一ファイルを作る。
 *
 * ・USBメモリ等で配り、ダブルクリックで開けば動く(file:// で動作する)
 * ・公開版はCDN方式のまま。こちらは配布用の保険で、常用はしない
 *   (ライブラリ更新のたびに作り直しが必要になるため)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const BACKSLASH = String.fromCharCode(92);
const NEWLINE = String.fromCharCode(10);

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist");
const OUT = path.join(OUT_DIR, "geometry-attribute-colorizer_offline.html");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(url + " -> HTTP " + res.statusCode));
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

(async () => {
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const tags = [...html.matchAll(/<script src="(https:[^"]+)"><\/script>/g)];
  if (!tags.length) {
    console.error("CDNのscriptタグが見つかりません。index.htmlの構成を確認してください。");
    process.exit(1);
  }

  for (const [tag, url] of tags) {
    process.stdout.write("取得中: " + url + " ... ");
    let code = await fetchText(url);
    // 埋め込むJSの中に閉じタグの文字列があると、そこでscriptタグが終わってしまう
    code = code.split("</script").join("<" + BACKSLASH + "/script");
    console.log(Math.round(code.length / 1024) + " KB");

    // 置換は必ず関数で渡すこと。文字列で渡すと、minifyされたJSに含まれる
    // ドル記号+記号の並びが置換パターンとして解釈され、コードが静かに壊れる
    // (実際にPapaParseがこれで壊れ、CSVだけ動かない状態になった)
    const inlined = "<script>/* " + url + " */" + NEWLINE + code + NEWLINE + "</script>";
    html = html.replace(tag, () => inlined);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, html, "utf8");

  // 「操作ガイド」は別ファイルなので、隣に置かないとリンクが切れる。
  // 配布はこのフォルダごと渡す前提にする
  fs.copyFileSync(path.join(ROOT, "help.html"), path.join(OUT_DIR, "help.html"));
  fs.copyFileSync(path.join(ROOT, "sample_ishigaki.dxf"), path.join(OUT_DIR, "sample_ishigaki.dxf"));
  fs.copyFileSync(path.join(ROOT, "quickstart.html"), path.join(OUT_DIR, "quickstart.html"));

  // 受け取った人が最初に開くファイルを迷わないようにする
  fs.writeFileSync(path.join(OUT_DIR, "はじめにお読みください.txt"), [
    "Geometry Attribute Colorizer 配布フォルダ",
    "",
    "1. quickstart.html          ... 使い方の1枚もの(印刷用)。まずこれを読む",
    "2. geometry-attribute-colorizer_offline.html",
    "                            ... アプリ本体。ダブルクリックで開く",
    "3. sample_ishigaki.dxf      ... 練習用の石垣データ。アプリにドラッグして読み込む",
    "4. help.html                ... 詳しい操作ガイド(アプリの右上からも開ける)",
    "",
    "インターネット接続は不要です。",
    "読み込んだデータは手元のブラウザ内だけで処理され、外部に送信されません。",
    "",
  ].join(String.fromCharCode(13) + String.fromCharCode(10)), "utf8");
  console.log(NEWLINE + "作成しました: " + OUT);
  console.log("大きさ: " + Math.round(fs.statSync(OUT).size / 1024) + " KB");
  console.log("同梱: quickstart.html(1枚手順書) / help.html(操作ガイド) / sample_ishigaki.dxf(練習用データ)");
  console.log("配布するときは dist フォルダごと渡してください(ネットワーク不要)。");
})();
