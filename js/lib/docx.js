// .docx mínimo (zip sin compresión) armado a mano, para que funcione sin internet en el celular.
import { bloques, nombreHablante } from './exportar.js';

const esc = s => String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = (t, props = '') => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const parrafo = (...runs) => `<w:p>${runs.join('')}</w:p>`;

function documento(e) {
  const p = [parrafo(run(e.titulo || 'Entrevista', '<w:b/><w:sz w:val="36"/>'))];
  if (e.resumen) {
    p.push(parrafo(run('Resumen', '<w:b/><w:sz w:val="28"/>')));
    for (const linea of e.resumen.trim().split('\n')) p.push(parrafo(run(linea)));
    p.push(parrafo(run('Transcripción', '<w:b/><w:sz w:val="28"/>')));
  }
  for (const b of bloques(e)) p.push(parrafo(run(nombreHablante(e, b.hablante) + ': ', '<w:b/>'), run(b.texto)));
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
    + p.join('') + '</w:body></w:document>';
}

const TIPOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

const TABLA = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b) {
  let c = 0xffffffff;
  for (const x of b) c = TABLA[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(archivos) {
  const enc = new TextEncoder();
  const locales = [], centrales = [];
  let offset = 0;
  for (const [nombre, contenido] of archivos) {
    const n = enc.encode(nombre), d = enc.encode(contenido), crc = crc32(d);
    const l = new DataView(new ArrayBuffer(30));
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(8, 0, true);
    l.setUint32(14, crc, true); l.setUint32(18, d.length, true); l.setUint32(22, d.length, true); l.setUint16(26, n.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true);
    c.setUint32(42, offset, true);
    locales.push(new Uint8Array(l.buffer), n, d);
    centrales.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + d.length;
  }
  const tamCentral = centrales.reduce((a, b) => a + b.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true);
  const partes = [...locales, ...centrales, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(partes.reduce((a, b) => a + b.length, 0));
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
}

export function crearDocx(e) {
  return zip([['[Content_Types].xml', TIPOS], ['_rels/.rels', RELS], ['word/document.xml', documento(e)]]);
}
