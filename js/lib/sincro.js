// Gana la versión con `actualizada` más reciente; lo que falta de un lado se copia.
export function planSincro(locales, remotas) {
  const rem = new Map(remotas.map(r => [r.id, r]));
  const loc = new Set(locales.map(l => l.id));
  const subir = [], bajar = [];
  for (const l of locales) {
    const r = rem.get(l.id);
    if (!r || l.actualizada > r.actualizada) subir.push(l.id);
    else if (r.actualizada > l.actualizada) bajar.push(l.id);
  }
  for (const r of remotas) if (!loc.has(r.id)) bajar.push(r.id);
  return { subir, bajar };
}
