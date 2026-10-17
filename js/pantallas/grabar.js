import * as db from '../db.js';
import * as grabadora from '../grabadora.js';
import { reloj, nuevaEntrevista } from '../ui.js';
import { sonar } from '../sonidos.js';
import { nivelVoz } from '../fondo.js';

export default async function grabar(raiz) {
  raiz.innerHTML = `
    <section class="grabando">
      <p class="grab-estado"><span class="punto vivo" aria-hidden="true"></span><span class="grab-texto">Preparando el micrófono…</span></p>
      <p class="reloj" aria-live="off">00:00</p>
      <div class="nivel" aria-hidden="true"><span></span></div>
      <p class="nota">Dejá la pantalla encendida. Lo grabado se guarda solo cada 5 segundos.</p>
      <div class="botones">
        <button class="boton secundario" data-pausa disabled>Pausar</button>
        <button class="boton principal" data-terminar disabled>Terminar</button>
      </div>
    </section>`;
  const $ = s => raiz.querySelector(s);
  const id = db.nuevoId();
  const titulo = 'Entrevista del ' + new Date().toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  let terminado = false, tic;

  async function guardarFinal() {
    if (terminado) return;
    terminado = true;
    clearInterval(tic);
    nivelVoz(0);
    const r = await grabadora.terminar();
    if (!r) return;
    await db.guardarAudio(id, r.blob);
    await db.borrarPedazos(id);
    const e = await db.leer(id);
    await db.guardar({ ...e, estado: 'borrador', audio: { nombre: 'grabacion.' + (r.blob.type.includes('mp4') ? 'm4a' : 'webm'), tipo: r.blob.type, bytes: r.blob.size, duracion: r.segundos } });
  }

  await db.guardar({ ...nuevaEntrevista(id, titulo, null), estado: 'grabando' });
  try {
    await grabadora.iniciar(id, nivel => { $('.nivel span').style.transform = `scaleX(${nivel})`; nivelVoz(nivel); });
  } catch {
    terminado = true;
    await db.guardar({ ...(await db.leer(id)), deleted: true });
    raiz.innerHTML = `<section class="grabando"><p class="error">No se pudo usar el micrófono. Revisá que el navegador tenga permiso para usarlo y probá de nuevo.</p>
      <a class="boton" href="#/">Volver</a></section>`;
    return;
  }
  $('.grab-texto').textContent = 'Grabando';
  sonar('grabar');
  $('[data-pausa]').disabled = $('[data-terminar]').disabled = false;
  tic = setInterval(() => { $('.reloj').textContent = reloj(grabadora.segundos()); }, 250);

  $('[data-pausa]').addEventListener('click', ev => {
    sonar('pausa');
    if (grabadora.pausada()) { grabadora.seguir(); ev.target.textContent = 'Pausar'; $('.grab-texto').textContent = 'Grabando'; $('.punto').classList.add('vivo'); }
    else { grabadora.pausar(); ev.target.textContent = 'Seguir'; $('.grab-texto').textContent = 'En pausa'; $('.punto').classList.remove('vivo'); }
  });
  $('[data-terminar]').addEventListener('click', async ev => {
    ev.target.disabled = true;
    await guardarFinal();
    sonar('terminar');
    location.hash = '#/nueva/' + id;
  });
  // si se sale de la pantalla sin terminar, se guarda igual
  return guardarFinal;
}
