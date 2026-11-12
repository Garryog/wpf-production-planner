// B10 (Job B part 6) shared bits: a real-shape Cienapps UPLOAD file (27 columns, the create-cienapps-upload skill's format:
// 5 lines per house — K8 kitchen with fitting kit + door kit as CHILDREN 1 & 2, K2 utility, K1 quartz, two robes; trailing
// spaces in "HOUSE TYPE B QUARTZ " and "TYPE 2 ROBE 1800 " and in the header words), plus a helper that turns an
// array-of-arrays into an .xlsx / .csv File inside the page.
const HDR = ['Qty ', 'Floor', 'Unit ', 'Product', 'Name', 'Description', 'Price'];
for (let k = 1; k <= 4; k++) HDR.push('CHILDREN ' + k + ' QTY', 'CHILDREN ' + k + ' PRODUCT ', 'CHILDREN ' + k + ' NAME', 'CHILDREN ' + k + ' DESCRIPTION', 'CHILDREN ' + k + ' PRICE');
const pad = r => { const x = r.slice(); while (x.length < 27) x.push(''); return x; };
function houseB(floor, unit, hand) {
  return [pad([1, floor, unit, 'K8', 'HOUSE TYPE B ' + hand, 'KITCHEN TYPE 1 ' + hand, 3950, 1, 'AA_KIT_T1', 'ASPECT ATHENRY FITTING KIT TYPE 1 (A & B HOUSES)', '', '', 1, 'AA_DOOR KIT T1', 'AA_DOOR KIT T1', '', '']),
    pad([1, floor, unit, 'K2', 'HOUSE TYPE B UTILITY ' + hand, 'UTILITY TYPE 1 ' + hand, 1920]),
    pad([1, floor, unit, 'K1', 'HOUSE TYPE B QUARTZ ', '', 1580]),
    pad([1, floor, unit, 'W2', 'HOUSE TYPE B BED 1', 'TYPE 2 ROBE 1800 ', 700]),
    pad([1, floor, unit, 'W1', 'HOUSE TYPE B BED 2', 'TYPE 4 ' + hand + ' (O EXP) 900', 400])];
}
function houseC(floor, unit, hand) {
  return [pad([1, floor, unit, 'K8', 'HOUSE TYPE C ' + hand, 'KITCHEN TYPE 2 ' + hand, 4220, 1, 'AA_T2_KIT', 'ASPECT ATHENRY FITTING KIT TYPE 2 (TYPE C,C2,D HOUSE )', '', '', 1, 'AA_DOOR KIT T2', 'DOOR KIT TYPE 2 KITCHEN (HOUSE C&D)', '', '']),
    pad([1, floor, unit, 'K2', 'HOUSE TYPE C UTILITY ' + hand, 'UTILITY TYPE 2 ' + hand, 610]),
    pad([1, floor, unit, 'K1', 'HOUSE TYPE C QUARTZ', '', 1580]),
    pad([1, floor, unit, 'W2', 'HOUSE TYPE C BED 1', 'TYPE 1 ' + hand + ' (LH EXP)', 700]),
    pad([1, floor, unit, 'W2', 'HOUSE TYPE C BED 2', 'TYPE 1 ' + hand + ' (LH EXP)', 700])];
}
// File(s) built in the page with the app's own SheetJS → window.__upFile (a File) ; csv: true → a .csv
async function makeFile(page, aoa, name, csv) {
  return page.evaluate(({ aoa, name, csv }) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    let u8;
    if (csv) u8 = new TextEncoder().encode(XLSX.utils.sheet_to_csv(ws));
    else { const bin = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' }); u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 255; }
    window.__upFile = new File([u8], name || 'upload.xlsx'); return u8.length;
  }, { aoa, name, csv: !!csv });
}
// the same file as bytes in node (for a real file chooser)
async function fileBytes(page, aoa, csv) {
  const a = await page.evaluate(({ aoa, csv }) => { const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    if (csv) return Array.from(new TextEncoder().encode(XLSX.utils.sheet_to_csv(ws)));
    const bin = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' }); const out = []; for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i) & 255); return out; }, { aoa, csv: !!csv });
  return Buffer.from(a);
}
// press ⬆ Cienapps file and give the file chooser this file
async function upload(page, aoa, name, sel) {
  const buf = await fileBytes(page, aoa, /\.csv$/i.test(name || ''));
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.evaluate(s => document.querySelector(s || '#seq-up').click(), sel || null)]);
  await fc.setFiles({ name: name || 'upload.xlsx', mimeType: 'application/octet-stream', buffer: buf });
  await new Promise(r => setTimeout(r, 500));
}
// the preview window as text + its numbers
const preview = page => page.evaluate(() => { const o = document.querySelector('.squ-dlg'); if (!o) return null; const t = o.innerText;
  const n = re => { const m = re.exec(t); return m ? +m[1] : null; };
  return { t, add: n(/Will be added \((\d+)\)/), skip: n(/Skipped — already in the sequence \((\d+)\)/), uns: n(/Might already be there \((\d+)\)/), ok: (o.querySelector('#squ-ok') || {}).textContent || '', dis: !!(o.querySelector('#squ-ok') || {}).disabled,
    start: !!o.querySelector('#squ-start'), startOn: !!(o.querySelector('#squ-start') || {}).checked, err: (o.querySelector('.squ-err') || {}).textContent || '' }; });
module.exports = { HDR, pad, houseB, houseC, makeFile, fileBytes, upload, preview };
