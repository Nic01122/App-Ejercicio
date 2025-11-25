document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN DE CONEXIÓN ---
    // PEGA AQUÍ ABAJO LA URL QUE COPIASTE DEL SCRIPT DE GOOGLE (entre las comillas)
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwaHBN0B6zWWmOZIjiru1ki7wwJjwkqLAUCIElF4jfpHoB6E3RwF9GKPjjikNnL3UiJ/exec"; 

    // --- CONFIGURACIÓN INICIAL ---
    // El script ahora lee la variable `LISTA_DE_POSTURAS` del archivo `posturas.js`.
    const posturas = LISTA_DE_POSTURAS.map(nombre => {
        const nombreSinExtension = nombre.split('.')[0]; 
        const id = nombreSinExtension.toLowerCase().replace(/\s+/g, '-'); 
        return { id: id, nombre: nombreSinExtension, img: nombre };
    });

    // --- SONIDOS ---
    const SONIDO_INICIO_RUTINA = new Audio('Sonidos/tiktak1 5 segundos.mp3'); 
    const SONIDO_INICIO_EJERCICIO = new Audio('Sonidos/japan-eas-alarma 2 segundos.mp3'); 
    const SONIDO_TRANSICION = new Audio('Sonidos/relaxing-guitar-loop-10 segundos.mp3');          
    const SONIDO_FIN_EJERCICIO = new Audio('Sonidos/alarm-7 segundos.mp3');    

    const FOTOS_PATH = './FOTOSPOSTURAS/';

    // --- ELEMENTOS DEL DOM ---
    const gallery = document.getElementById('posture-gallery');
    const setupScreen = document.getElementById('setup-screen');
    const routineScreen = document.getElementById('routine-screen');
    const startBtn = document.getElementById('start-routine-btn');
    const searchInput = document.getElementById('search-input');
    const pauseBtn = document.getElementById('pause-routine-btn');
    const endBtn = document.getElementById('end-routine-btn');
    const timeInput = document.getElementById('time-per-pose');
    const transitionScreen = document.getElementById('transition-screen');
    const transitionMessage = document.getElementById('transition-message');
    const totalDurationEl = document.getElementById('total-duration');
    const transitionTimer = document.getElementById('transition-timer');
    const transitionImage = document.getElementById('transition-image');

    const poseNameEl = document.getElementById('pose-name');
    const timerEl = document.getElementById('timer');
    const poseImageEl = document.getElementById('pose-image');
    const progressTextEl = document.getElementById('progress-text');

    // --- ESTADO DE LA APP ---
    let seleccionTemporal = []; 
    let rutinaActiva = false;
    let isPaused = false;
    let ejercicioActualIndex = 0;
    let tiempoRestante = 0;
    let intervalID;
    let transitionIntervalID;


    // --- LÓGICA ---

    // 1. Cargar las posturas en la galería
    function cargarGaleria() {
        gallery.innerHTML = '';
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }
        posturas.forEach(postura => {
            const div = document.createElement('div');
            div.classList.add('posture-card');
            div.dataset.id = postura.id;
            div.innerHTML = `
                <div class="selection-order"></div>
                <span class="extra-time-display"></span>
                <button class="time-btn">+10s</button>
                <button class="bilateral-btn">2x</button>
                <img src="${FOTOS_PATH}${postura.img}" alt="${postura.nombre}" loading="lazy">
                <p>${postura.nombre}</p>
            `;
            
            div.querySelector('img').addEventListener('click', () => toggleSeleccion(postura.id, div));
            div.querySelector('p').addEventListener('click', () => toggleSeleccion(postura.id, div));

            div.querySelector('.bilateral-btn').addEventListener('click', (e) => {
                e.stopPropagation(); 
                toggleBilateral(postura.id, div);
            });

            div.querySelector('.time-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                addExtraTime(postura.id, div);
            });

            gallery.appendChild(div);
        });
    }

    // 2. Marcar/desmarcar una postura para la rutina
    function toggleSeleccion(id, element) {
        const index = seleccionTemporal.findIndex(p => p.id === id);
        if (index > -1) { 
            seleccionTemporal.splice(index, 1);
            element.classList.remove('selected');
            element.classList.remove('bilateral-selected'); 
        } else {
            seleccionTemporal.push({ id: id, bilateral: false, extraTime: 0 });
            element.classList.add('selected');
        }
        actualizarNumerosDeOrden();
        actualizarDuracionTotal();
    }

    function toggleBilateral(id, element) {
        const seleccion = seleccionTemporal.find(p => p.id === id);
        if (seleccion) { 
            seleccion.bilateral = !seleccion.bilateral;
            element.classList.toggle('bilateral-selected');
            actualizarNumerosDeOrden();
            actualizarDuracionTotal();
        } else {
            alert('Primero selecciona la postura para marcarla como 2x.');
        }
    }

    function addExtraTime(id, element) {
        const seleccion = seleccionTemporal.find(p => p.id === id);
        if (seleccion) {
            seleccion.extraTime += 10;
            const displayEl = element.querySelector('.extra-time-display');
            displayEl.textContent = `+${seleccion.extraTime}s`;
            actualizarDuracionTotal();
        } else {
            alert('Primero selecciona la postura para añadirle tiempo extra.');
        }
    }


    // 3. Iniciar la rutina
    function iniciarRutina() {
        if (seleccionTemporal.length === 0) {
            alert('¡Debes seleccionar al menos una postura para comenzar!');
            return;
        }

        if (rutinaActiva) { 
            alert('¡Ya hay una rutina en curso!');
            return;
        }

        rutinaActiva = true;
        isPaused = false;
        ejercicioActualIndex = 0;
        
        SONIDO_INICIO_RUTINA.play();
        iniciarContador('Prepárate', 5, mostrarEjercicioActual);
    }

    // 4. Mostrar el ejercicio actual y empezar el cronómetro
    function mostrarEjercicioActual() {
        const rutinaFinal = construirRutinaFinal();
        pauseBtn.textContent = 'Pausar';
        const posturaActual = rutinaFinal[ejercicioActualIndex];

        poseNameEl.textContent = posturaActual.nombre;
        poseImageEl.src = `${FOTOS_PATH}${posturaActual.img}`;
        progressTextEl.textContent = `Postura ${ejercicioActualIndex + 1} de ${rutinaFinal.length}`;
        
        const tiempoBase = parseInt(timeInput.value, 10);
        tiempoRestante = tiempoBase + (posturaActual.extraTime || 0);
        timerEl.textContent = tiempoRestante || 30; 

        clearInterval(intervalID); 
        intervalID = setInterval(actualizarCronometro, 1000);
    }

    // 5. Actualizar el cronómetro cada segundo
    function actualizarCronometro() {
        tiempoRestante--;
        timerEl.textContent = tiempoRestante;
        
        if (tiempoRestante === 7) {
            SONIDO_FIN_EJERCICIO.play();
        }
        if (tiempoRestante <= 0) {
            siguienteEjercicio();
        }
    }

    // 6. Pasar al siguiente ejercicio o finalizar
    function siguienteEjercicio() {
        if (!rutinaActiva) return; 

        clearInterval(intervalID);
        const rutinaFinal = construirRutinaFinal();
        ejercicioActualIndex++; 

        if (ejercicioActualIndex < rutinaFinal.length) {
            SONIDO_TRANSICION.play();
            const siguientePostura = rutinaFinal[ejercicioActualIndex];
            iniciarContador(`Siguiente: ${siguientePostura.nombre}`, 10, mostrarEjercicioActual);
        } else {
            finalizarRutina('¡Felicidades! Has completado tu rutina.');
        }
    }

    function iniciarContador(mensaje, duracion, callback) {
        setupScreen.classList.add('hidden');
        routineScreen.classList.add('hidden'); 
        transitionScreen.classList.remove('hidden'); 

        const siguientePostura = construirRutinaFinal()[ejercicioActualIndex] || seleccionTemporal[0];
        transitionImage.src = `${FOTOS_PATH}${siguientePostura.img}`;
        transitionImage.style.display = 'block';

        transitionMessage.textContent = mensaje;
        let tiempo = duracion;
        transitionTimer.textContent = tiempo;

        transitionIntervalID = setInterval(() => {
            tiempo--;
            transitionTimer.textContent = tiempo;
            if (tiempo <= 0) {
                SONIDO_INICIO_EJERCICIO.play(); 
                clearInterval(transitionIntervalID);
                transitionScreen.classList.add('hidden');
                routineScreen.classList.remove('hidden'); 
                callback(); 
            }
        }, 1000);
    }

    // 7. Finalizar la rutina (MODIFICADA PARA GUARDAR)
    function finalizarRutina(mensaje) {
        rutinaActiva = false;
        isPaused = false;
        detenerTodosLosSonidos();
        SONIDO_INICIO_RUTINA.play(); // ¡Añadimos el sonido de finalización!

        // Preguntar al usuario si quiere guardar
        let quiereGuardar = confirm(mensaje + "\n\n¿Quieres guardar este registro en tu historial?");

        if (quiereGuardar) {
            guardarRutinaEnDrive();
        } else {
            resetearInterfaz();
        }
    }

    // Función auxiliar para limpiar la pantalla (se usa al terminar o al guardar)
    function resetearInterfaz() {
        seleccionTemporal = [];
        routineScreen.classList.add('hidden');
        setupScreen.classList.remove('hidden');
        actualizarDuracionTotal();
        cargarGaleria(); // Recarga la galería para quitar las selecciones visuales
    }

    // --- FUNCIÓN PARA ENVIAR DATOS A GOOGLE SHEETS ---
    function guardarRutinaEnDrive() {
        // 1. Obtener la lista real de ejercicios realizados
        const rutinaHecha = construirRutinaFinal();
        const nombresEjercicios = rutinaHecha.map(p => p.nombre).join(", ");

        // 2. Obtener la duración
        let duracionTexto = totalDurationEl.textContent.replace('Duración: ', '');

        // 3. Preguntar sensación
        let sensacion = prompt("¿Cómo te sientes? (Ej: Bien, Cansado, Energético)");
        if (sensacion === null) sensacion = "-"; 

        // 4. Empaquetar los datos
        const datos = {
            duracion: duracionTexto,
            ejercicios: nombresEjercicios,
            sensacion: sensacion
        };

        // 5. Enviar al Portero (Google Script)
        fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", 
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datos)
        })
        .then(() => {
            alert("✅ ¡Rutina guardada con éxito!");
            resetearInterfaz();
        })
        .catch(error => {
            console.error("Error:", error);
            alert("❌ Hubo un error de conexión al intentar guardar.");
            resetearInterfaz();
        });
    }

    // --- Funciones Auxiliares ---

    function construirRutinaFinal() {
        const rutinaFinal = [];
        seleccionTemporal.forEach(sel => {
            const posturaBase = posturas.find(p => p.id === sel.id);
            if (sel.bilateral) {
                rutinaFinal.push({ ...posturaBase, nombre: `${posturaBase.nombre} (Izquierda)`, extraTime: sel.extraTime });
                rutinaFinal.push({ ...posturaBase, nombre: `${posturaBase.nombre} (Derecha)`, extraTime: sel.extraTime });
            } else {
                rutinaFinal.push({ ...posturaBase, extraTime: sel.extraTime });
            }
        });
        return rutinaFinal;
    }

    function actualizarNumerosDeOrden() {
        let ordenActual = 1;
        document.querySelectorAll('.selection-order').forEach(el => el.textContent = '');

        seleccionTemporal.forEach(sel => {
            const card = document.querySelector(`.posture-card[data-id="${sel.id}"]`);
            if (card) {
                const orderEl = card.querySelector('.selection-order');
                if (sel.bilateral) {
                    orderEl.textContent = `${ordenActual}-${ordenActual + 1}`;
                    ordenActual += 2;
                } else {
                    orderEl.textContent = ordenActual;
                    ordenActual += 1;
                }
            }
        });
    }

    function actualizarDuracionTotal() {
        const segundosPorPostura = parseInt(timeInput.value, 10) || 0;
        let tiempoTotalEjercicios = 0;
        let numeroTotalEjercicios = 0;

        seleccionTemporal.forEach(sel => {
            const repeticiones = sel.bilateral ? 2 : 1;
            numeroTotalEjercicios += repeticiones;
            tiempoTotalEjercicios += repeticiones * (segundosPorPostura + sel.extraTime);
        });

        if (numeroTotalEjercicios === 0) {
            totalDurationEl.textContent = 'Duración: 00:00';
            return;
        }

        const tiempoTransiciones = (numeroTotalEjercicios - 1) * 10;
        const tiempoPreparacion = 5;
        const duracionTotalSegundos = tiempoTotalEjercicios + tiempoTransiciones + tiempoPreparacion;

        const minutos = Math.floor(duracionTotalSegundos / 60);
        const segundos = duracionTotalSegundos % 60;
        totalDurationEl.textContent = `Duración: ${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
    }

    // --- EVENT LISTENERS ---
    startBtn.addEventListener('click', iniciarRutina);
    searchInput.addEventListener('input', filtrarGaleria);
    pauseBtn.addEventListener('click', togglePausa);
    endBtn.addEventListener('click', () => finalizarRutina('Rutina terminada manualmente.'));
    timeInput.addEventListener('input', actualizarDuracionTotal);

    function togglePausa() {
        if (!rutinaActiva) return;

        isPaused = !isPaused;

        if (isPaused) {
            detenerTodosLosSonidos();
            clearInterval(intervalID);
            clearInterval(transitionIntervalID);
            pauseBtn.textContent = 'Reanudar';
        } else {
            pauseBtn.textContent = 'Pausar';
            if (transitionScreen.classList.contains('hidden')) {
                intervalID = setInterval(actualizarCronometro, 1000);
            } else {
                const tiempoActualTransicion = parseInt(transitionTimer.textContent, 10);
                if (tiempoActualTransicion > 0) {
                     // Nota: Simplificación para reanudar transición
                     // En una implementación perfecta, re-llamaríamos a iniciarContador con el tiempo restante.
                     // Pero dado que iniciarContador configura el DOM, solo reiniciamos el intervalo simple aquí.
                     transitionIntervalID = setInterval(() => {
                        let t = parseInt(transitionTimer.textContent);
                        t--;
                        transitionTimer.textContent = t;
                        if (t <= 0) {
                            SONIDO_INICIO_EJERCICIO.play();
                            clearInterval(transitionIntervalID);
                            transitionScreen.classList.add('hidden');
                            routineScreen.classList.remove('hidden');
                            mostrarEjercicioActual(); 
                        }
                    }, 1000);
                }
            }
        }
    }

    function detenerTodosLosSonidos() {
        const sonidos = [SONIDO_INICIO_RUTINA, SONIDO_INICIO_EJERCICIO, SONIDO_TRANSICION, SONIDO_FIN_EJERCICIO];
        sonidos.forEach(sonido => {
            sonido.pause();
            sonido.currentTime = 0; 
        });
    }

    function filtrarGaleria() {
        const textoBusqueda = searchInput.value.toLowerCase();
        const todasLasPosturas = document.querySelectorAll('.posture-card');

        todasLasPosturas.forEach(card => {
            const nombrePostura = card.querySelector('p').textContent.toLowerCase();
            if (nombrePostura.includes(textoBusqueda)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // --- INICIALIZACIÓN ---
    cargarGaleria();
});

