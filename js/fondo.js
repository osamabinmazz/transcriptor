// Fondo de partículas: puntos que flotan despacio con los colores de las voces.
// Mientras se graba, se aceleran y crecen con el volumen de la voz.
const CLAVE = 'particulas';
export const activado = () => { try { return localStorage.getItem(CLAVE) !== 'no'; } catch { return true; } };

let lienzo, ctx, puntos = [], colores = [], cuadro = null, nivel = 0, objetivo = 0, ancho = 0, alto = 0;
const quieto = matchMedia('(prefers-reduced-motion: reduce)');

function leerColores() {
  const css = getComputedStyle(document.documentElement);
  colores = ['--h1', '--h2', '--h3', '--h4', '--h5', '--rojo'].map(v => css.getPropertyValue(v).trim() || '#888');
}

function crearPuntos() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  ancho = innerWidth; alto = innerHeight;
  lienzo.width = ancho * dpr; lienzo.height = alto * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cantidad = Math.min(70, Math.round(ancho * alto / 11000));
  puntos = Array.from({ length: cantidad }, () => ({
    x: Math.random() * ancho, y: Math.random() * alto,
    r: 1.2 + Math.random() * 2.6, v: 0.08 + Math.random() * 0.25,
    fase: Math.random() * Math.PI * 2, c: colores[Math.floor(Math.random() * colores.length)], a: 0.18 + Math.random() * 0.3,
  }));
}

function dibujar(t = 0) {
  nivel += (objetivo - nivel) * 0.15;
  ctx.clearRect(0, 0, ancho, alto);
  const cx = ancho / 2, cy = alto * 0.4;
  for (const p of puntos) {
    if (!quieto.matches) {
      p.y -= p.v * (1 + nivel * 6);
      p.x += Math.sin(t / 2400 + p.fase) * 0.2;
      // con voz, los puntos se abren desde el centro como una onda
      if (nivel > 0.02) { const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1; p.x += dx / d * nivel * 1.6; p.y += dy / d * nivel * 1.6; }
      if (p.y < -10 || p.x < -10 || p.x > ancho + 10 || p.y > alto + 10) { p.y = alto + 8; p.x = Math.random() * ancho; }
    }
    ctx.globalAlpha = Math.min(0.85, p.a + nivel * 0.5);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1 + nivel * 1.4), 0, Math.PI * 2);
    ctx.fill();
  }
  cuadro = quieto.matches || document.hidden ? null : requestAnimationFrame(dibujar);
}

export function nivelVoz(n) { objetivo = Math.max(0, Math.min(1, n)); }

export function refrescarColores() {
  if (!lienzo) return;
  leerColores();
  puntos.forEach(p => { p.c = colores[Math.floor(Math.random() * colores.length)]; });
}

export function activar(si) {
  try { localStorage.setItem(CLAVE, si ? 'si' : 'no'); } catch {}
  si ? iniciarFondo() : detener();
}

function detener() {
  if (cuadro) cancelAnimationFrame(cuadro);
  cuadro = null;
  lienzo?.remove();
  lienzo = null;
}

export function iniciarFondo() {
  if (lienzo || !activado()) return;
  lienzo = document.createElement('canvas');
  lienzo.className = 'fondo';
  lienzo.setAttribute('aria-hidden', 'true');
  document.body.prepend(lienzo);
  ctx = lienzo.getContext('2d');
  leerColores();
  crearPuntos();
  dibujar();
}

addEventListener('resize', () => { if (lienzo) crearPuntos(); });
document.addEventListener('visibilitychange', () => { if (lienzo && !document.hidden && !cuadro) dibujar(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refrescarColores);
