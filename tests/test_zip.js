"use strict";
/*
 * ZIP書き出しの検証。
 *
 * まとめ書き出し(§8.7)は外部ライブラリを使わず、ZIPの構造を自前で
 * 組み立てている。ヘッダの位置やCRC32を1つ間違えるだけで
 * 「保存はできるが開けないファイル」ができ、しかも画面上は成功に見える。
 * ここでは実際に生成したZIPを解析し直し、展開まで通ることを確かめる。
 *
 * 検証は index.html の crc32 / buildZip を extracted.js 経由でそのまま呼ぶ。
 */
const zlib = require("zlib");
const F = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`  ${c ? "OK" : "NG!!"}: ${n}`); };
const enc = (s) => new TextEncoder().encode(s);

/* 生成したZIPを解析する(中央ディレクトリを正として読む) */
function parseZip(buf) {
  // 末尾から EOCD(終端レコード)を探す
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("EOCDが見つかりません");
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  const files = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("中央ディレクトリの署名が不正です");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const rawSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localAt = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8");

    // 中央ディレクトリが指す位置に、本当にローカルヘッダがあるか
    if (buf.readUInt32LE(localAt) !== 0x04034b50) throw new Error("ローカルヘッダの署名が不正です: " + name);
    const lNameLen = buf.readUInt16LE(localAt + 26);
    const lExtraLen = buf.readUInt16LE(localAt + 28);
    const dataAt = localAt + 30 + lNameLen + lExtraLen;
    const data = buf.slice(dataAt, dataAt + compSize);
    const text = (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8");

    files.push({ name, flags, method, crc, compSize, rawSize, text });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { count, cdSize, cdOffset, files };
}

(async () => {
  // --- CRC32: 広く使われている既知の値と一致すること ---
  ok(F.crc32(enc("")) === 0, "crc32(空) が 0");
  ok(F.crc32(enc("123456789")) === 0xCBF43926, `crc32("123456789") が 0xCBF43926 (実際: 0x${F.crc32(enc("123456789")).toString(16).toUpperCase()})`);
  ok(F.crc32(enc("a")) === 0xE8B7BE43, "crc32(a) が 0xE8B7BE43");
  ok(F.crc32(enc("石垣")) === F.crc32(enc("石垣")), "同じ内容なら同じCRCになる");
  ok(F.crc32(enc("石垣")) !== F.crc32(enc("石段")), "内容が違えばCRCも変わる");

  // --- ZIPの往復: 生成 → 解析 → 展開して元に戻るか ---
  const big = "<svg>" + "<polygon points='1,2 3,4 5,6' fill='#1a4ce6'/>".repeat(300) + "</svg>";
  const entries = [
    { name: "サンプル石垣_elevation_Width.svg", text: big },
    { name: "elevation_lines.svg", text: "<svg><line x1='0' y1='0' x2='1' y2='1'/></svg>" },
  ];
  const blob = await F.buildZip(entries);
  const buf = Buffer.from(await blob.arrayBuffer());

  ok(buf.readUInt32LE(0) === 0x04034b50, "先頭がローカルファイルヘッダの署名");
  ok(blob.type === "application/zip", "BlobのMIMEタイプがapplication/zip");

  const z = parseZip(buf);
  ok(z.count === 2, `格納数が2 (実際: ${z.count})`);
  ok(z.cdOffset + z.cdSize + 22 === buf.length, "中央ディレクトリの位置と大きさが実サイズと整合する");

  const byName = Object.fromEntries(z.files.map((f) => [f.name, f]));
  ok(!!byName["サンプル石垣_elevation_Width.svg"], "日本語のファイル名がそのまま復元される");
  ok(!!byName["elevation_lines.svg"], "2つ目のファイル名が復元される");

  const a = byName["サンプル石垣_elevation_Width.svg"];
  ok(a && a.text === big, "展開した中身が元のSVGと一致する");
  ok(a && a.crc === F.crc32(enc(big)), "記録されたCRCが中身のCRCと一致する");
  ok(a && a.rawSize === Buffer.byteLength(big), "元のサイズが正しく記録されている");
  ok(a && (a.flags & 0x0800) !== 0, "UTF-8フラグ(bit11)が立っている");
  ok(a && a.method === 8, `繰り返しの多いSVGはdeflateで格納される (実際のmethod: ${a && a.method})`);
  ok(a && a.compSize < a.rawSize, `圧縮で小さくなっている (${a && a.rawSize} -> ${a && a.compSize})`);

  const b = byName["elevation_lines.svg"];
  ok(b && b.text === entries[1].text, "2つ目の中身も一致する");

  // --- 1件だけ・空の中身でも壊れないこと ---
  const one = parseZip(Buffer.from(await (await F.buildZip([{ name: "a.svg", text: "" }])).arrayBuffer()));
  ok(one.count === 1 && one.files[0].text === "" && one.files[0].crc === 0, "空のファイル1件でもZIPとして成立する");

  console.log(`\n===== ${pass}成功 / ${fail}失敗 =====`);
  process.exit(fail ? 1 : 0);
})();
