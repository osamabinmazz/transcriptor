export const nombreHablante = (e, h) => e.hablantes?.[h] || `Hablante ${h}`;

// Segmentos seguidos del mismo hablante, unidos en un solo párrafo.
export function bloques(e) {
  const out = [];
  for (const s of e.segmentos || []) {
    const texto = s.texto.trim();
    const ult = out.at(-1);
    if (ult && ult.hablante === s.hablante) ult.texto += ' ' + texto;
    else out.push({ hablante: s.hablante, ini: s.ini, texto });
  }
  return out;
}

export function aTexto(e) {
  const partes = [e.titulo || 'Entrevista'];
  if (e.resumen) partes.push('Resumen:\n' + e.resumen.trim());
  for (const b of bloques(e)) partes.push(`${nombreHablante(e, b.hablante)}: ${b.texto}`);
  return partes.join('\n\n') + '\n';
}

export function tiempoSrt(seg) {
  const ms = Math.round(seg * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

export function aSrt(e) {
  return (e.segmentos || []).map((s, i) =>
    `${i + 1}\n${tiempoSrt(s.ini)} --> ${tiempoSrt(s.fin)}\n${nombreHablante(e, s.hablante)}: ${s.texto.trim()}\n`).join('\n');
}

export function nombreArchivo(titulo) {
  const limpio = String(titulo || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80).trim();
  return limpio || 'entrevista';
}
