// Verificar login
if (localStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'login.html';
}

// Inicializar Firebase (debe estar cargado en el HTML)
let db;
try {
    db = firebase.database();
    console.log('✅ Firebase inicializado correctamente');
} catch (error) {
    console.error('❌ Error inicializando Firebase:', error);
}

let map, userMarker;
let watchId = null;
let tracking = false;
let camionActual = '';
let lastUpdate = Date.now();
let keepAliveInterval = null;

window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-ubicacion');
    const selectCamion = document.getElementById('select-camion');
    const statusDiv = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    const coordsText = document.getElementById('coords-text');

    // Cargar nombre del usuario si existe
    const usuario = JSON.parse(localStorage.getItem('usuarioActivo') || '{}');
    const nombreElement = document.getElementById('camionero-nombre');
    if (usuario.nombre && nombreElement) {
        nombreElement.innerText = `Bienvenido, ${usuario.nombre}`;
    }

    // Recuperar camión seleccionado previamente
    const camionGuardado = localStorage.getItem('camionSeleccionado');
    if (camionGuardado && selectCamion) {
        selectCamion.value = camionGuardado;
        camionActual = camionGuardado;
        btn.disabled = false;
        btn.textContent = 'Activar Ubicación';
    }

    // Recuperar estado de tracking
    const ubicacionActiva = localStorage.getItem('ubicacionActiva') === 'true';
    if (ubicacionActiva && camionActual) {
        console.log('🔄 Restaurando sesión de tracking...');
        iniciarSeguimiento();
    }

    // Event listener para selector de camión
    if (selectCamion) {
        selectCamion.addEventListener('change', (e) => {
            camionActual = e.target.value;
            
            if (camionActual) {
                // Guardar selección
                localStorage.setItem('camionSeleccionado', camionActual);
                
                btn.disabled = false;
                btn.textContent = 'Activar Ubicación';
                
                // Si estaba trackeando, detener
                if (tracking) {
                    detenerSeguimiento();
                }

                console.log(`📦 Camión seleccionado: ${camionActual}`);
            } else {
                localStorage.removeItem('camionSeleccionado');
                btn.disabled = true;
                btn.textContent = 'Selecciona un camión primero';
            }
        });
    }

    // Event listener para botón de ubicación
    if (btn) {
        btn.addEventListener('click', () => {
            if (!tracking) {
                solicitarPermisoYIniciar();
            } else {
                detenerSeguimiento();
            }
        });
    }

    function solicitarPermisoYIniciar() {
        if (!camionActual) {
            alert("⚠️ Por favor, selecciona un camión primero.");
            return;
        }

        if (!navigator.geolocation) {
            alert("❌ La geolocalización no es soportada por este navegador.");
            return;
        }

        // Verificar si ya se dio permiso antes
        const permisoGuardado = localStorage.getItem('gpsPermisoOtorgado');
        
        if (permisoGuardado === 'true') {
            console.log('✅ Permiso previamente otorgado, iniciando...');
            iniciarSeguimiento();
            return;
        }

        // Verificar permiso del navegador
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then(result => {
                if (result.state === 'granted') {
                    console.log('✅ Permiso ya otorgado');
                    localStorage.setItem('gpsPermisoOtorgado', 'true');
                    iniciarSeguimiento();
                } else if (result.state === 'prompt') {
                    console.log('❓ Solicitando permiso...');
                    iniciarSeguimiento();
                } else {
                    alert('⚠️ Permisos de ubicación bloqueados.\n\n' +
                          'Toca el candado 🔒 y permite "Ubicación"');
                }
            }).catch(err => {
                console.warn('⚠️ API de permisos no disponible');
                iniciarSeguimiento();
            });
        } else {
            iniciarSeguimiento();
        }
    }

    function mostrarGuiaActivacion() {
        const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const guia = esIOS
            ? "🔧 iPhone/iPad:\n\n" +
              "1. Abre Ajustes del dispositivo\n" +
              "2. Busca 'Chrome' o 'Safari'\n" +
              "3. Toca en 'Ubicación'\n" +
              "4. Selecciona 'Al usar la app' o 'Siempre'\n\n" +
              "También verifica en Ajustes > Privacidad > Ubicación que esté activado.\n\n" +
              "Luego vuelve aquí y toca 'Activar Ubicación'."
            : "🔧 Android/PC:\n\n" +
              "Android:\n" +
              "1. Ve a Ajustes > Ubicación\n" +
              "2. Activa 'Usar ubicación'\n" +
              "3. Verifica permisos de Chrome/navegador\n\n" +
              "PC/Escritorio:\n" +
              "1. Toca el candado 🔒 en la barra de direcciones\n" +
              "2. Permite 'Ubicación' para este sitio\n" +
              "3. Recarga la página\n\n" +
              "Luego toca nuevamente 'Activar Ubicación'.";

        alert(guia);
    }

    function iniciarSeguimiento() {
        if (!camionActual) {
            console.error('❌ No hay camión seleccionado');
            return;
        }

        tracking = true;
        btn.classList.add('active');
        btn.textContent = 'Detener Ubicación';
        btn.style.backgroundColor = '#f44336';
        localStorage.setItem('ubicacionActiva', 'true');

        if (selectCamion) {
            selectCamion.disabled = true;
        }

        if (statusDiv) {
            statusDiv.classList.add('active');
        }
        
        if (statusText && selectCamion) {
            const camionTexto = selectCamion.options[selectCamion.selectedIndex].text;
            statusText.textContent = `Activo (${camionTexto})`;
        }

        // Inicializar mapa si existe el contenedor
        inicializarMapa();

        console.log(`🟢 Iniciando tracking para ${camionActual}...`);

        // Watchposition para actualización continua
        watchId = navigator.geolocation.watchPosition(position => {
            const { latitude, longitude, accuracy } = position.coords;

            const payload = {
                lat: latitude,
                lng: longitude,
                accuracy: accuracy,
                timestamp: position.timestamp,
                camionId: camionActual
            };

            lastUpdate = Date.now();

            // Guardar en Firebase
            if (db) {
                db.ref(`ubicaciones/${camionActual}`).set(payload)
                    .then(() => {
                        console.log(`✅ Ubicación enviada a Firebase para ${camionActual}`);
                        
                        if (coordsText) {
                            coordsText.textContent = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)} | Precisión: ${Math.round(accuracy)}m`;
                        }
                    })
                    .catch(error => {
                        console.error('❌ Error enviando a Firebase:', error);
                    });
            }

            // Guardar en localStorage como backup
            const ubicacionBackup = {
                lat: latitude,
                lng: longitude,
                timestamp: Date.now(),
                accuracy: accuracy,
                camionId: camionActual
            };
            localStorage.setItem('camioneroUbicacion', JSON.stringify(ubicacionBackup));

            // Actualizar mapa si está inicializado
            actualizarMapa(latitude, longitude);

        }, error => {
            console.error("❌ Error durante seguimiento:", error.message);
            
            if (error.code === error.PERMISSION_DENIED) {
                alert("⚠️ Permiso de ubicación denegado.\n\n" +
                      "Para usar esta función:\n" +
                      "1. Toca el candado 🔒 en la barra de direcciones\n" +
                      "2. Permite 'Ubicación' para este sitio\n" +
                      "3. Recarga la página");
                detenerSeguimiento();
            } else {
                console.warn("⚠️ Error temporal, continuando...");
            }
        }, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 27000
        });

        // Sistema keep-alive
        keepAliveInterval = setInterval(() => {
            const timeSinceUpdate = Date.now() - lastUpdate;
            
            if (timeSinceUpdate > 30000) {
                console.warn('⚠️ Sin actualizaciones, reiniciando...');
                
                if (watchId !== null) {
                    navigator.geolocation.clearWatch(watchId);
                }
                
                // Reiniciar sin cambiar UI
                watchId = navigator.geolocation.watchPosition(position => {
                    const payload = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp,
                        camionId: camionActual
                    };
                    
                    lastUpdate = Date.now();
                    
                    if (db) {
                        db.ref(`ubicaciones/${camionActual}`).set(payload)
                            .then(() => console.log(`✅ Ubicación actualizada`))
                            .catch(e => console.error(e));
                    }
                    
                    actualizarMapa(position.coords.latitude, position.coords.longitude);
                }, err => {
                    console.warn("⚠️ Error:", err.message);
                }, {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 27000
                });
            }
            
            console.log(`💚 Keep-alive: última actualización hace ${Math.round(timeSinceUpdate/1000)}s`);
        }, 10000);

        console.log(`📡 WatchPosition iniciado con ID: ${watchId}`);
    }

    function detenerSeguimiento() {
        console.log('🛑 Deteniendo seguimiento...');

        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
            console.log('⏸️ WatchPosition detenido');
        }

        if (keepAliveInterval !== null) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
            console.log('⏸️ Keep-alive detenido');
        }

        // Eliminar ubicación de Firebase
        if (db && camionActual) {
            db.ref(`ubicaciones/${camionActual}`).remove()
                .then(() => {
                    console.log(`🗑️ Ubicación eliminada de Firebase para ${camionActual}`);
                })
                .catch(error => {
                    console.error('❌ Error eliminando de Firebase:', error);
                });
        }

        tracking = false;
        btn.classList.remove('active');
        btn.textContent = 'Activar Ubicación';
        btn.style.backgroundColor = '#4CAF50';

        if (selectCamion) {
            selectCamion.disabled = false;
        }

        if (statusDiv) {
            statusDiv.classList.remove('active');
        }

        if (statusText) {
            statusText.textContent = 'Inactivo';
        }

        if (coordsText) {
            coordsText.textContent = '';
        }

        localStorage.removeItem('camioneroUbicacion');
        localStorage.setItem('ubicacionActiva', 'false');

        console.log('🔴 Tracking detenido completamente');
    }

    function inicializarMapa() {
        const mapaContenedor = document.getElementById('mapa-ubicacion');
        
        // Solo inicializar si existe el contenedor y no está ya inicializado
        if (!mapaContenedor || map) return;

        console.log('🗺️ Inicializando mapa...');

        map = L.map('mapa-ubicacion').setView([-17.7850, -63.1737], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        console.log('✅ Mapa inicializado');
    }

    function actualizarMapa(lat, lng) {
        if (!map) return;

        const pos = [lat, lng];

        if (!userMarker) {
            userMarker = L.marker(pos, {
                title: "Tu ubicación",
                icon: L.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                })
            }).addTo(map).bindPopup("📍 Tu ubicación actual").openPopup();
        } else {
            userMarker.setLatLng(pos);
        }

        map.setView(pos, 16);
    }
});

// Función de logout
function logout() {
    console.log('👋 Cerrando sesión...');
    
    // Detener tracking si está activo
    if (watchId !== null && camionActual && db) {
        navigator.geolocation.clearWatch(watchId);
        db.ref(`ubicaciones/${camionActual}`).remove()
            .then(() => console.log('🗑️ Ubicación limpiada al cerrar sesión'))
            .catch(e => console.error('Error limpiando ubicación:', e));
    }

    // Limpiar localStorage
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('camioneroUbicacion');
    localStorage.removeItem('ubicacionActiva');
    localStorage.removeItem('camionSeleccionado');
    localStorage.removeItem('usuarioActivo');
    
    // Redirigir a login
    window.location.href = 'login.html';
}

// Limpiar ubicación al cerrar/recargar la página
window.addEventListener('beforeunload', () => {
    if (watchId !== null && camionActual && db) {
        console.log('🚪 Página cerrándose, limpiando ubicación...');
        // Uso de sendBeacon para envío garantizado al cerrar
        const data = JSON.stringify({ camionId: camionActual, action: 'remove' });
        navigator.sendBeacon(`https://ecocalendario-51a84-default-rtdb.firebaseio.com/ubicaciones/${camionActual}.json`, 
            JSON.stringify(null));
    }
});

// Detectar cambios de visibilidad de la página
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('📱 Página en segundo plano - tracking continúa');
    } else {
        console.log('👁️ Página visible nuevamente');
        lastUpdate = Date.now(); // Resetear contador
    }
});