/**
 * main.js — Arranque de Monte Adentro: portada, partida nueva o continuar.
 *
 * Nada sale del dispositivo: la partida se guarda en el propio navegador.
 */
import { Partida } from './partida.js';
import { partidaNueva, cargar, hayPartida, borrar } from './nucleo/estado.js';
import { el, boton, vaciar } from './ui/base.js';
import { nombreFecha } from './mundo/clima.js';

export function iniciarJuego(raiz) {
  const contenedor = el('div', { id: 'juego' });
  const lienzo = el('canvas', { id: 'lienzo' });
  contenedor.appendChild(lienzo);
  raiz.appendChild(contenedor);

  let partida = null;

  function portada() {
    const guardada = hayPartida() ? cargar() : null;
    const entrada = el('input', { attr: { maxlength: '14', value: guardada?.nombre || 'Tino', 'aria-label': 'Nombre del niño' } });

    const empezar = async (estado) => {
      capa.remove();
      partida = new Partida({
        raiz: contenedor, lienzo, estado,
        alSalir: (motivo) => {
          partida?.destruir();
          if (motivo === 'nueva') borrar();
          vaciar(contenedor).appendChild(lienzo);
          portada();
        },
      });
      try {
        await partida.iniciar();
      } catch (err) {
        contenedor.appendChild(el('div', { clase: 'capa' }, [
          el('div', { clase: 'tarjeta', estilo: 'position:absolute;inset:auto 20px 20px 20px;padding:18px' }, [
            el('h3', { texto: 'No se pudo arrancar el motor gráfico' }),
            el('p', { clase: 'nota', texto: err.message }),
            el('p', { clase: 'nota', texto: 'Probá con otro navegador o actualizá el que usás: el juego necesita WebGL2 o WebGPU.' }),
          ]),
        ]));
      }
    };

    const capa = el('div', { id: 'portada' }, [
      el('div', { clase: 'marco' }, [
        el('div', { estilo: 'font-size:44px;line-height:1' , texto: '🌄' }),
        el('h1', { texto: 'Monte Adentro' }),
        el('p', { clase: 'lema', texto: 'Un niño del campo, un río que hay que subir a cántaros, una milpa que no perdona el olvido y un monte que da de comer al que aprende a mirarlo.' }),
        el('div', { clase: 'campo' }, [el('span', { texto: '🧒' }), entrada]),
        el('div', { clase: 'acciones' }, [
          guardada ? boton(`Seguir — día ${guardada.dia}, ${nombreFecha(guardada.dia)}`, {
            clase: 'primario',
            alPulsar: () => { guardada.nombre = entrada.value.trim() || guardada.nombre; empezar(guardada); },
          }) : null,
          boton(guardada ? 'Empezar de nuevo' : 'Empezar', {
            clase: guardada ? '' : 'primario',
            alPulsar: () => {
              if (guardada && !confirm('¿Seguro? Se borra la partida guardada.')) return;
              borrar();
              empezar(partidaNueva({ nombre: entrada.value.trim() || 'Tino' }));
            },
          }),
        ]),
        el('div', { clase: 'tecla-ayuda' }, [
          el('span', { texto: 'WASD moverse' }),
          el('span', { texto: 'Shift correr' }),
          el('span', { texto: 'C agacharse' }),
          el('span', { texto: 'E interactuar' }),
          el('span', { texto: 'Espacio acción' }),
          el('span', { texto: 'I canasta · J diario' }),
          el('span', { texto: 'Arrastrar para mirar' }),
        ]),
        el('div', { clase: 'pie', texto: 'En el móvil se juega con el dedo: palanca a la izquierda, botones a la derecha. También funciona con mando. Todo se guarda en tu dispositivo.' }),
      ]),
    ]);
    contenedor.appendChild(capa);
  }

  portada();
  return { get partida() { return partida; } };
}

// Arranque automatico: igual que la aplicacion, el juego se monta solo dentro
// de #app. Asi el mismo archivo sirve para la pagina con modulos sueltos y
// para el empaquetado de dist/ sin necesidad de codigo pegamento.
const raizJuego = typeof document !== 'undefined' ? document.getElementById('app') : null;
if (raizJuego) {
  raizJuego.innerHTML = '';
  window.monteAdentro = iniciarJuego(raizJuego);
}
