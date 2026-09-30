"use strict";
/*
 * ZIPを読む側の検証。
 *
 * 書く側(buildZip)は test_zip.js が構造を見ている。こちらは**往復**を見る。
 * 現場一式(台紙GLB・台帳CSV・記録CSV)を1つのZIPで持ち運ぶため、
 * 自分で書いたものを自分で読み戻せることが前提になる。
 *
 * 壊れたZIPを渡されたときに、黙って空を返さず理由を出すところまで確かめる。
 * 読めないのに「0件でした」と返すと、記録が消えたように見える。
 */
const { buildZip, unzip, readZipEntries } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

const dec = new TextDecoder();
const toBuf = async (blob) => new Uint8Array(await blob.arrayBuffer());

(async () => {
  /* ---------- 往復(テキスト) ---------- */
  {
    const entries = [
      { name: "台帳.csv", text: "ID,Width\n1,0.42\n2,0.51\n" },
      { name: "記録_山田.csv", text: "ID,SurveyDate,調査者,Note\n21,2026-09-30,山田,北側に孕み出し\n" },
    ];
    const back = await unzip(await toBuf(await buildZip(entries)));
    ok(back.length === 2, "2つ入れたら2つ戻る", "戻り " + back.length);
    ok(back[0].name === "台帳.csv" && back[1].name === "記録_山田.csv",
       "名前が順番どおりに戻る");
    ok(dec.decode(back[0].bytes) === entries[0].text, "中身が一致する(台帳)");
    ok(dec.decode(back[1].bytes) === entries[1].text, "中身が一致する(記録)");
  }

  /* ---------- 日本語のファイル名 ---------- */
  {
    const name = "本丸東面_記録_2026-09-30.csv";
    const back = await unzip(await toBuf(await buildZip([{ name, text: "ID\n1\n" }])));
    ok(back[0].name === name, "日本語のファイル名がそのまま戻る", back[0].name);
  }

  /* ---------- バイト列(GLBを想定) ---------- */
  {
    // 先頭が "glTF" のバイナリ。テキストに直せないものが往復すること
    const bin = new Uint8Array(512);
    bin.set([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00], 0);
    for (let i = 8; i < bin.length; i++) bin[i] = (i * 37) & 0xFF;
    const back = await unzip(await toBuf(await buildZip([{ name: "model.glb", bytes: bin }])));
    const got = back[0].bytes;
    ok(got.length === bin.length, "バイト列の長さが戻る", got.length + " / " + bin.length);
    let same = true;
    for (let i = 0; i < bin.length; i++) if (got[i] !== bin[i]) { same = false; break; }
    ok(same, "バイト列が1バイトも変わらずに戻る");
  }

  /* ---------- 圧縮されない中身(store)も読める ---------- */
  {
    // ごく短い中身はdeflateで縮まないので、書く側が無圧縮で格納する
    const back = await unzip(await toBuf(await buildZip([{ name: "a.txt", text: "x" }])));
    const raw = await readZipEntries(await toBuf(await buildZip([{ name: "a.txt", text: "x" }])));
    ok(raw[0].method === 0, "縮まない中身は無圧縮で格納される", "method=" + raw[0].method);
    ok(dec.decode(back[0].bytes) === "x", "無圧縮でも読み戻せる");
  }

  /* ---------- 圧縮された中身も読める ---------- */
  {
    const text = "ID,SurveyDate,Note\n" + "21,2026-09-30,孕み出し\n".repeat(200);
    const buf = await toBuf(await buildZip([{ name: "big.csv", text }]));
    const raw = await readZipEntries(buf);
    ok(raw[0].method === 8, "よく縮む中身はdeflateで格納される", "method=" + raw[0].method);
    ok(buf.length < text.length / 2, "実際に小さくなっている",
       buf.length + " < " + Math.round(text.length / 2));
    const back = await unzip(buf);
    ok(dec.decode(back[0].bytes) === text, "圧縮されていても元どおりに戻る");
  }

  /* ---------- たくさん入っていても全部戻る ---------- */
  {
    const many = [];
    for (let i = 0; i < 12; i++) many.push({ name: "記録_" + i + ".csv", text: "ID,Note\n" + i + ",所見" + i + "\n" });
    const back = await unzip(await toBuf(await buildZip(many)));
    ok(back.length === 12, "12個入れたら12個戻る", "戻り " + back.length);
    ok(back.every((e, i) => dec.decode(e.bytes).includes("所見" + i)), "どれも中身が入れ違っていない");
  }

  /* ---------- フォルダの項目は落とす ---------- */
  {
    const back = await unzip(await toBuf(await buildZip([
      { name: "記録/", text: "" },
      { name: "記録/山田.csv", text: "ID\n1\n" },
    ])));
    ok(back.length === 1 && back[0].name === "記録/山田.csv",
       "フォルダの項目は返さず、中のファイルだけ返す");
  }

  /* ---------- 壊れている / ZIPでないものは、理由を出して断る ---------- */
  const rejects = async (bytes, label) => {
    let msg = null;
    try { await unzip(bytes); } catch (e) { msg = e.message; }
    ok(msg !== null, label + "は断る", msg ? "「" + msg + "」" : "断らなかった");
    return msg;
  };
  await rejects(new Uint8Array(0), "空のファイル");
  await rejects(new TextEncoder().encode("これはZIPではありません"), "ZIPでないファイル");
  {
    // 終端レコードはあるが目次の位置が嘘
    const buf = await toBuf(await buildZip([{ name: "a.csv", text: "ID\n1\n" }]));
    const broken = buf.slice();
    const dv = new DataView(broken.buffer);
    let eocd = -1;
    for (let i = broken.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    dv.setUint32(eocd + 16, 3, true);   // 目次の位置をずらす
    await rejects(broken, "目次の位置が壊れたZIP");
  }
  {
    // 後ろを切り落とす
    const buf = await toBuf(await buildZip([{ name: "a.csv", text: "ID\n1\n".repeat(50) }]));
    await rejects(buf.slice(0, Math.floor(buf.length / 2)), "途中で切れたZIP");
  }

  console.log("");
  console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
  process.exit(fail ? 1 : 0);
})();
