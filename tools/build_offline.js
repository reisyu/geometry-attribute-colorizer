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

  /* 配布物にはライセンス表示を必ず入れる。

     この単一HTMLは **LICENSE から切り離されて単体で配られる**ので、
     ファイル自身が表示を持っていないとMITの条件を満たさない
     (「著作権表示と許諾表示を、すべての複製物に含めること」)。
     同梱するThree.jsとPapaParseも同じ理由で表示が要る。

     本文はリポジトリの LICENSE をそのまま読む。書き写すと、
     権利表示を直したときに配布物だけ古いまま残る。

     HTMLコメントの中では ** を2つ続ける書き方(ハイフン2つ)が使えないので、
     区切りはイコールで引く */
  const licenseText = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8").trim();
  const indent = (t) => t.split(NEWLINE).map((l) => (l ? "  " + l : "")).join(NEWLINE);
  const version = (html.match(/APP_VERSION = "([0-9.]+)"/) || [])[1] || "";
  const banner = [
    "<!--",
    "  Geometry Attribute Colorizer" + (version ? " v" + version : "") + " — オフライン配布版(単一ファイル)",
    "  https://github.com/reisyu/geometry-attribute-colorizer",
    "",
    indent(licenseText),
    "",
    "  ==================================================================",
    "  同梱しているライブラリ (いずれもMIT License。条文は上と同じものです)",
    "  ==================================================================",
    "",
    "  Three.js r128",
    "  Copyright (c) 2010-2021 three.js authors",
    "  https://github.com/mrdoob/three.js",
    "",
    "  Papa Parse 5.4.1",
    "  Copyright (c) 2015 Matthew Holt",
    "  https://github.com/mholt/PapaParse",
    "-->",
    "",
  ].join(NEWLINE);

  // DOCTYPEの前にコメントを置かない(古いブラウザで互換モードに落ちる)
  const doctype = html.match(/^<!DOCTYPE[^>]*>/i);
  html = doctype
    ? html.slice(0, doctype[0].length) + NEWLINE + banner + html.slice(doctype[0].length)
    : banner + html;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, html, "utf8");

  // 「操作ガイド」は別ファイルなので、隣に置かないとリンクが切れる。
  // 配布はこのフォルダごと渡す前提にする
  fs.copyFileSync(path.join(ROOT, "help.html"), path.join(OUT_DIR, "help.html"));
  fs.copyFileSync(path.join(ROOT, "sample_ishigaki.dxf"), path.join(OUT_DIR, "sample_ishigaki.dxf"));
  fs.copyFileSync(path.join(ROOT, "quickstart.html"), path.join(OUT_DIR, "quickstart.html"));
  fs.copyFileSync(path.join(ROOT, "add-columns.html"), path.join(OUT_DIR, "add-columns.html"));
  // 配布フォルダ自体にも利用条件を入れる。help/quickstartは本体とは別ファイルなので、
  // フォルダごと渡したときにどれを見ても条件が分かる状態にしておく
  fs.copyFileSync(path.join(ROOT, "LICENSE"), path.join(OUT_DIR, "LICENSE"));

  // 受け取った人が最初に開くファイルを迷わないようにする
  fs.writeFileSync(path.join(OUT_DIR, "はじめにお読みください.txt"), [
    "Geometry Attribute Colorizer 配布フォルダ",
    "",
    "1. quickstart.html          ... 使い方の1枚もの(印刷用)。まずこれを読む",
    "2. geometry-attribute-colorizer_offline.html",
    "                            ... アプリ本体。ダブルクリックで開く",
    "3. sample_ishigaki.dxf      ... 練習用の石垣データ。アプリにドラッグして読み込む",
    "4. add-columns.html        ... 石ごとの項目(属性・点検項目)を追加する手引き",
    "5. help.html                ... 詳しい操作ガイド(アプリの右上からも開ける)",
    "6. LICENSE                  ... 利用条件(MIT License)",
    "",
    "インターネット接続は不要です。",
    "読み込んだデータは手元のブラウザ内だけで処理され、外部に送信されません。",
    "",
    "このソフトウェアはMIT Licenseで公開されています。",
    "複製・改変・再配布は自由ですが、著作権表示と許諾表示を残してください。",
    "全文は同梱の LICENSE、またはアプリ本体の冒頭(HTMLコメント)にあります。",
    "",
  ].join(String.fromCharCode(13) + String.fromCharCode(10)), "utf8");
  console.log(NEWLINE + "作成しました: " + OUT);
  console.log("大きさ: " + Math.round(fs.statSync(OUT).size / 1024) + " KB");
  console.log("同梱: quickstart.html(1枚手順書) / add-columns.html(項目の追加) / help.html(操作ガイド) / sample_ishigaki.dxf(練習用データ)");
  console.log("配布するときは dist フォルダごと渡してください(ネットワーク不要)。");
})();
