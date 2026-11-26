// 상품 목록(CSV) 생성: 공개 쇼핑몰 상품 페이지를 읽어 toss_catalog.csv 로 저장
import { writeFileSync } from 'node:fs';

const SITE = 'https://atelierfaye.co.kr';
const CATE_NO = 28;
const BRAND = '아뜰리에페이';
const EXCLUDE_NO = ['50', '133', '169'];
const IMAGE_OVERRIDE = { '125': SITE + '/toss_custom_layering_set_20261124.jpg' };
const COLS = ['id', 'title', 'brand', 'image_url', 'landing_url', 'price', 'sale_price', 'availability'];

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; catalog-feed/1.0)' } });
      if (r.ok) return await r.text();
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}

const unesc = s => s.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const meta = (h, p) => (h.match(new RegExp('property="' + p + '" content="([^"]*)"')) || [])[1] || '';
const cell = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

const seen = new Set(); const nos = [];
for (let page = 1; page <= 20; page++) {
  const html = await get(SITE + '/product/list.html?cate_no=' + CATE_NO + '&page=' + page);
  if (!html) break;
  let added = 0;
  for (const m of html.matchAll(/<li id="anchorBoxId_(\d+)"/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); nos.push(m[1]); added++; }
  }
  if (!added) break;
}

const lines = [COLS.join(',')];
for (const no of nos.filter(n => !EXCLUDE_NO.includes(n))) {
  const h = await get(SITE + '/product/detail.html?product_no=' + no);
  if (!h) continue;
  const id = (h.match(/<a href="#" alt="(P0\w+)"/) || [])[1];
  const title = unesc(meta(h, 'og:title')).replace(new RegExp(' - ' + BRAND + '$'), '');
  const image = IMAGE_OVERRIDE[no] || meta(h, 'og:image');
  const url = unesc(meta(h, 'og:url'));
  const price = meta(h, 'product:price:amount');
  const sale = meta(h, 'product:sale_price:amount');
  if (!id || !title || !image || !url || !price) continue;
  const landing = url.replace(/^(https?:\/\/[^\/]+)(\/.*)$/, (_, host, path) => host.replace('http://', 'https://') + encodeURI(path));
  const row = { id, title, brand: BRAND, image_url: image, landing_url: landing, price,
    sale_price: sale && Number(sale) < Number(price) ? sale : '', availability: 'in stock' };
  lines.push(COLS.map(c => cell(row[c])).join(','));
}

if (lines.length < 30) { console.error('상품 수 이상: ' + (lines.length - 1)); process.exit(1); }
writeFileSync('toss_catalog.csv', lines.join('\n') + '\n', 'utf8');
console.log('rows', lines.length - 1);
