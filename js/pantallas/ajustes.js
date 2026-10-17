import { estado, avisos, clave, ciclo } from '../sincronizar.js';
import { avisar } from '../ui.js';
import * as sonidos from '../sonidos.js';
import * as fondo from '../fondo.js';
import { leerTema, elegirTema } from '../tema.js';
import { SOLO_ONLINE } from '../modo.js';

export default async function ajustes(raiz) {
  raiz.innerHTML = `
    <article class="ajustes">
      <a href="#/" class="volver">Volver</a>
      <h1>Ajustes</h1>
      ${SOLO_ONLINE ? '' : `<section>
        <h2>Tu PC</h2>
        <p class="estado-pc"></p>
      </section>`}
      <section>
        <h2>Servicio online</h2>
        <p>${SOLO_ONLINE
          ? 'Esta versión web transcribe con Speechmatics: separa las voces y hace el resumen. Con la cuenta gratis tenés crédito por 12 meses; cuando se termina, se frena y no cobra nada.'
          : 'Sirve para transcribir con la PC apagada. Usa Speechmatics con el crédito gratis de tu cuenta: cuando se termina, se frena y no cobra nada.'}</p>
        <form class="campo-clave">
          <label class="campo">Clave de Speechmatics
            <input type="password" name="clave" autocomplete="off" spellcheck="false" placeholder="Pegala acá">
          </label>
          <div class="botones">
            <button type="button" class="boton secundario" data-ver>Mostrar</button>
            <button class="boton principal">Guardar clave</button>
          </div>
        </form>
        <p><a href="guia.html#online">Cómo conseguir la clave</a></p>
      </section>
      <section>
        <h2>Apariencia</h2>
        <fieldset class="campo opciones tres">
          <legend>Tema</legend>
          ${[['auto', 'Automático', 'Como el aparato'], ['claro', 'Claro', ''], ['oscuro', 'Oscuro', '']].map(([v, t, d]) => `
            <label class="opcion"><input type="radio" name="tema" value="${v}"><span><strong>${t}</strong>${d ? `<small>${d}</small>` : ''}</span></label>`).join('')}
        </fieldset>
        <label class="interruptor">
          <input type="checkbox" name="particulas" role="switch">
          <span>Fondo con partículas (se mueven con tu voz mientras grabás)</span>
        </label>
      </section>
      <section>
        <h2>Sonidos</h2>
        <label class="interruptor">
          <input type="checkbox" name="sonidos" role="switch">
          <span>Sonido y vibración al empezar y terminar de grabar, y cuando una entrevista está lista</span>
        </label>
      </section>
      <section>
        <h2>Este aparato</h2>
        <p class="espacio"></p>
        <p><a href="guia.html">Guía de uso e instalación en el celular</a></p>
      </section>
    </article>`;
  const form = raiz.querySelector('form');
  form.clave.value = clave.leer();
  raiz.querySelector('[data-ver]').onclick = ev => {
    const ver = form.clave.type === 'password';
    form.clave.type = ver ? 'text' : 'password';
    ev.target.textContent = ver ? 'Ocultar' : 'Mostrar';
  };
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    clave.guardar(form.clave.value);
    avisar(form.clave.value.trim() ? 'Clave guardada.' : 'Clave borrada.');
    ciclo();
  });

  for (const r of raiz.querySelectorAll('[name=tema]')) {
    r.checked = r.value === leerTema();
    r.addEventListener('change', () => elegirTema(r.value));
  }
  const particulas = raiz.querySelector('[name=particulas]');
  particulas.checked = fondo.activado();
  particulas.addEventListener('change', () => fondo.activar(particulas.checked));

  const sonidosCaja = raiz.querySelector('[name=sonidos]');
  sonidosCaja.checked = sonidos.activados();
  sonidosCaja.addEventListener('change', () => {
    sonidos.activar(sonidosCaja.checked);
    if (sonidosCaja.checked) sonidos.sonar('listo');
  });

  const pintarPc = () => {
    const el = raiz.querySelector('.estado-pc');
    if (!el) return;
    el.textContent = estado.pc
      ? 'Conectada. Las entrevistas se transcriben en la PC y se guardan en Documentos\\Transcripciones.'
      : 'No responde. Revisá que esté prendida y, desde afuera de casa, que Tailscale esté activo en los dos aparatos.';
  };
  pintarPc();
  avisos.addEventListener('estado', pintarPc);
  const uso = await navigator.storage?.estimate?.().catch(() => null);
  raiz.querySelector('.espacio').textContent = uso
    ? `Las entrevistas guardadas en este aparato ocupan ${(uso.usage / 1048576).toFixed(0)} MB.`
    : '';
  return () => avisos.removeEventListener('estado', pintarPc);
}
