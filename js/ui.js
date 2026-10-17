import { clave } from './sincronizar.js';
// Ayudas de interfaz compartidas por las pantallas.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let temporizador;
export function avisar(texto) {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.classList.add('visible');
  clearTimeout(temporizador);
  temporizador = setTimeout(() => el.classList.remove('visible'), 2800);
}

export const fecha = ms => new Date(ms).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function duracion(seg) {
  if (!Number.isFinite(seg) || seg <= 0) return '';
  const s = Math.round(seg);
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s % 60;
  return h ? `${h} h ${m} min` : m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`;
}

export const reloj = seg => {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600), m = String(Math.floor(s / 60) % 60).padStart(2, '0'), r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${m}:${r}` : `${m}:${r}`;
};

// Clase de color por hablante (1..6, después se repite).
export const claseHablante = h => 'h' + (((Number(h) || 1) - 1) % 6 + 1);

export const normalizar = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function descargar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function medirDuracion(blob) {
  return new Promise(ok => {
    const a = new Audio();
    const fin = v => { URL.revokeObjectURL(a.src); ok(Number.isFinite(v) && v > 0 ? v : null); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => fin(a.duration);
    a.onerror = () => fin(null);
    setTimeout(() => fin(null), 4000);
    a.src = URL.createObjectURL(blob);
  });
}

// Qué decirle al usuario sobre el estado de una entrevista.
export function textoEstado(e, conexion) {
  switch (e.estado) {
    case 'borrador': return 'Sin enviar a transcribir';
    case 'grabando': return 'Grabación sin terminar';
    case 'transcribiendo': return `Transcribiendo ${e.motorUsado === 'online' ? 'online' : 'en la PC'}… ${e.progreso || 0} %`;
    case 'error': return e.error || 'Algo falló';
    case 'pendiente':
      if (e.motor === 'pc') return conexion.pc ? 'En cola en la PC' : 'Esperando a que la PC esté prendida';
      if (e.motor === 'online') return !clave.leer() ? 'Falta la clave del servicio online (Ajustes)' : conexion.internet ? 'Por mandar al servicio online' : 'Esperando internet';
      if (conexion.pc) return 'En cola en la PC';
      if (!clave.leer()) return 'Esperando a que la PC esté prendida';
      return conexion.internet ? 'Por mandar al servicio online' : 'Esperando PC o internet';
    default: return '';
  }
}

export function nuevaEntrevista(id, titulo, audio) {
  return {
    id, titulo, creada: Date.now(), estado: 'borrador', motor: 'auto', motorUsado: null, idioma: 'es', cantHablantes: 2,
    hablantes: {}, segmentos: [], resumen: null, progreso: 0, error: null, aviso: null, audio, audioSubido: false, deleted: false,
  };
}
