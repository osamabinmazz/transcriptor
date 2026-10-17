// Une los segmentos de texto con los turnos de hablante y convierte la salida de Speechmatics.

export function asignarHablantes(segs, turnos) {
  if (!turnos.length) return segs.map(s => ({ ...s, hablante: '1' }));
  const orden = new Map();
  return segs.map(s => {
    let mejor = turnos[0], puntaje = -Infinity;
    for (const t of turnos) {
      // solapamiento positivo, o distancia negativa si no se tocan
      const p = Math.min(s.fin, t.fin) - Math.max(s.ini, t.ini);
      if (p > puntaje) { puntaje = p; mejor = t; }
    }
    if (!orden.has(mejor.hablante)) orden.set(mejor.hablante, String(orden.size + 1));
    return { ...s, hablante: orden.get(mejor.hablante) };
  });
}

export function desdeSpeechmatics(json) {
  const segs = [];
  let act = null, prefijo = '';
  for (const r of json.results || []) {
    const alt = r.alternatives?.[0];
    if (!alt) continue;
    if (r.type === 'punctuation') {
      if (r.attaches_to === 'next' || !act) { prefijo += alt.content; continue; }
      act.texto += alt.content;
      act.cierre = /[.?!…]/.test(alt.content);
      continue;
    }
    const hablante = /^S(\d+)$/.exec(alt.speaker || '')?.[1] || '1';
    const nuevo = !act || act.hablante !== hablante || r.start_time - act.fin > 1.5 || (act.cierre && act.palabras > 40);
    const palabra = prefijo + alt.content;
    prefijo = '';
    if (nuevo) {
      act = { ini: r.start_time, fin: r.end_time, hablante, texto: palabra, palabras: 1, cierre: false };
      segs.push(act);
    } else {
      act.texto += ' ' + palabra;
      act.fin = r.end_time;
      act.palabras++;
      act.cierre = false;
    }
  }
  return segs.map(({ ini, fin, hablante, texto }) => ({ ini, fin, hablante, texto }));
}
