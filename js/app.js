import { arrancar, estado, avisos } from './sincronizar.js';
import { sonar } from './sonidos.js';
import { avisar } from './ui.js';
import { iniciarFondo } from './fondo.js';
import { SOLO_ONLINE } from './modo.js';
import lista from './pantallas/lista.js';
import nueva from './pantallas/nueva.js';
import grabar from './pantallas/grabar.js';
import detalle from './pantallas/detalle.js';
import ajustes from './pantallas/ajustes.js';

const rutas = [
  [/^#\/?$/, lista],
  [/^#\/grabar$/, grabar],
  [/^#\/nueva\/([\w-]+)$/, nueva],
  [/^#\/e\/([\w-]+)$/, detalle],
  [/^#\/ajustes$/, ajustes],
];

let limpiar = null;
async function mostrar() {
  const anterior = limpiar;
  limpiar = null;
  await anterior?.();
  const raiz = document.getElementById('pantalla');
  for (const [re, pantalla] of rutas) {
    const m = re.exec(location.hash || '#/');
    if (!m) continue;
    raiz.replaceChildren();
    scrollTo(0, 0);
    limpiar = (await pantalla(raiz, ...m.slice(1))) || null;
    return;
  }
  location.hash = '#/';
}

function mostrarConexion() {
  const el = document.getElementById('conexion');
  const [clase, texto] = SOLO_ONLINE ? (estado.internet ? ['ok', 'Online'] : ['mal', 'Sin internet'])
    : estado.pc ? ['ok', 'PC conectada'] : estado.internet ? ['medio', 'Sin PC'] : ['mal', 'Sin internet'];
  el.className = 'conexion ' + clase;
  el.textContent = texto;
}

addEventListener('hashchange', mostrar);
avisos.addEventListener('estado', mostrarConexion);
avisos.addEventListener('terminada', ({ detail: e }) => {
  const bien = e.estado === 'listo';
  sonar(bien ? 'listo' : 'error');
  avisar(bien ? `«${e.titulo}» ya está transcripta.` : `«${e.titulo}» no se pudo transcribir.`);
});
navigator.serviceWorker?.register('sw.js').catch(() => {});
navigator.storage?.persist?.().catch(() => {});
mostrarConexion();
iniciarFondo();
mostrar();
arrancar();
