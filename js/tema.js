// Tema: 'auto' sigue al aparato; 'claro' u 'oscuro' lo fijan. index.html lo aplica antes de pintar.
import { refrescarColores } from './fondo.js';

export const leerTema = () => { try { return localStorage.getItem('tema') || 'auto'; } catch { return 'auto'; } };

export function elegirTema(tema) {
  try { tema === 'auto' ? localStorage.removeItem('tema') : localStorage.setItem('tema', tema); } catch {}
  if (tema === 'auto') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
  refrescarColores();
}
