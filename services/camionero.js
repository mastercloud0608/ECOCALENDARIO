// services/camionero.js - VERSIÓN CORREGIDA

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
        console.log(`📦 [${camionGuardado}] Camión restaurado desde localStorage`);
    }

    // Recuperar estado de tracking
    const ubicacionActiva = localStorage.getItem('ubicacionActiva') === 'true';
    if (ubicacionActiva && camionActual) {
        console.log(`🔄 [${camionActual}] Restaurando sesión de tracking...`);
        iniciarSeguimiento();
    }

    // Event listener para selector de camión
    if (selectCamion) {
        selectCamion.addEventListener('change', (e) => {
            const camionAnterior = camionActual;
            camionActual = e.target.value;
            
            if (camionActual) {
                // Guardar selección
                localStorage.setItem('camionSeleccionado', camionActual);
                console.log(`🔄 Camión cambiado: ${camionAnterior || 'ninguno'} → ${camionActual}`);
                
                btn.disabled = false;
                btn.textContent = 'Activar Ubicación';
                
                // Si estaba trackeando, detener
                if (tracking) {
                    detenerSeguimiento();
                }
            } else {
                localStorage.removeItem('camionSeleccionado');
                btn.disabled = true;
                btn.textContent = 'Selecciona un camión primero';
                console.log('⚠️ Camión deseleccionado');
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
            console.log(`✅ [${camionActual}] Permiso previamente otorgado, iniciando...`);
            iniciarSeguimiento();
            return;
        }

        // Verificar permiso del navegador
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then(result => {
                if (result.state === 'granted') {
                    console.log(`✅ [${camionActual}] Permiso ya otorgado`);
                    localStorage.setItem('gpsPermisoOtorgado', 'true');
                    iniciarSeguimiento();
                } else if (result.state === 'prompt') {
                    console.log(`❓ [${camionActual}] Solicitando permiso...`);
                    iniciarSeguimiento();
                } else {
                    alert('⚠️ Permisos de ubicación bloqueados.\n\nToca el candado 🔒 y permite "Ubicación"');
                }
            }).catch(err => {
                console.warn(`⚠️ [${camionActual}] API de permisos no disponible`);
                iniciarSeguimiento();
            });
        } else {
            iniciarSeguimiento();
        }
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

        console.log(`🟢 [${camionActual}] Iniciando tracking...`);

        // Watchposition para actualización continua
        watchId = navigator.geolocation.watchPosition(position => {
            const { latitude, longitude, accuracy } = position.coords;

            // CRÍTICO: Usar timestamp consistente
            const timestamp = Date.now();

            const payload = {
                lat: latitude,
                lng: longitude,
                accuracy: accuracy,
                timestamp: timestamp,
                camionId: camionActual
            };

            lastUpdate = timestamp;

            // IMPORTANTE: Escribir en la ruta específica del camión
            if (db) {
                db.ref(`ubicaciones/${camionActual}`).set(payload)
                    .then(() => {
                        console.log(`✅ [${camionActual}] Ubicación actualizada:`, {
                            lat: latitude.toFixed(6),
                            lng: longitude.toFixed(6),
                            timestamp: new Date(timestamp).toLocaleTimeString()
                        });
                        
                        if (coordsText) {
                            coordsText.textContent = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)} | Precisión: ${Math.round(accuracy)}m`;
                        }
                    })
                    .catch(error => {
                        console.error(`❌ [${camionActual}] Error enviando a Firebase:`, error);
                    });
            }

            // Guardar en localStorage como backup
            const ubicacionBackup = {
                lat: latitude,
                lng: longitude,
                timestamp: timestamp,
                accuracy: accuracy,
                camionId: camionActual
            };
            localStorage.setItem('camioneroUbicacion', JSON.stringify(ubicacionBackup));

            // Actualizar mapa si está inicializado
            actualizarMapa(latitude, longitude);

        }, error => {
            console.error(`❌ [${camionActual}] Error durante seguimiento:`, error.message);
            
            if (error.code === error.PERMISSION_DENIED) {
                alert("⚠️ Permiso de ubicación denegado.\n\nPara usar esta función:\n1. Toca el candado 🔒 en la barra de direcciones\n2. Permite 'Ubicación' para este sitio\n3. Recarga la página");
                detenerSeguimiento();
            } else {
                console.warn(`⚠️ [${camionActual}] Error temporal, continuando...`);
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
                console.warn(`⚠️ [${camionActual}] Sin actualizaciones por ${Math.round(timeSinceUpdate/1000)}s, reiniciando...`);
                
                if (watchId !== null) {
                    navigator.geolocation.clearWatch(watchId);
                }
                
                // Reiniciar sin cambiar UI
                watchId = navigator.geolocation.watchPosition(position => {
                    const timestamp = Date.now();
                    const payload = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: timestamp,
                        camionId: camionActual
                    };
                    
                    lastUpdate = timestamp;
                    
                    if (db) {
                        db.ref(`ubicaciones/${camionActual}`).set(payload)
                            .then(() => console.log(`✅ [${camionActual}] Ubicación actualizada (reinicio)`))
                            .catch(e => console.error(`❌ [${camionActual}] Error:`, e));
                    }
                    
                    actualizarMapa(position.coords.latitude, position.coords.longitude);
                }, err => {
                    console.warn(`⚠️ [${camionActual}] Error:`, err.message);
                }, {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 27000
                });
            }
            
            console.log(`💚 [${camionActual}] Keep-alive: última actualización hace ${Math.round(timeSinceUpdate/1000)}s`);
        }, 10000);

        console.log(`📡 [${camionActual}] WatchPosition iniciado con ID: ${watchId}`);
    }

    function detenerSeguimiento() {
        console.log(`🛑 [${camionActual}] Deteniendo seguimiento...`);

        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
            console.log(`⏸️ [${camionActual}] WatchPosition detenido`);
        }

        if (keepAliveInterval !== null) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
            console.log(`⏸️ [${camionActual}] Keep-alive detenido`);
        }

        // CRÍTICO: Eliminar solo la ubicación de ESTE camión
        if (db && camionActual) {
            db.ref(`ubicaciones/${camionActual}`).remove()
                .then(() => {
                    console.log(`🗑️ [${camionActual}] Ubicación eliminada de Firebase`);
                })
                .catch(error => {
                    console.error(`❌ [${camionActual}] Error eliminando de Firebase:`, error);
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

        console.log(`🔴 [${camionActual}] Tracking detenido completamente`);
    }

    function inicializarMapa() {
        const mapaContenedor = document.getElementById('mapa-ubicacion');
        
        // Solo inicializar si existe el contenedor y no está ya inicializado
        if (!mapaContenedor || map) return;

        console.log(`🗺️ [${camionActual}] Inicializando mapa...`);

        map = L.map('mapa-ubicacion').setView([-17.7850, -63.1737], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        console.log(`✅ [${camionActual}] Mapa inicializado`);
    }

    function actualizarMapa(lat, lng) {
        if (!map) return;

        const pos = [lat, lng];

        if (!userMarker) {
            userMarker = L.marker(pos, {
                title: `${camionActual} - Tu ubicación`,
                icon: L.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                })
            }).addTo(map).bindPopup(`📍 ${camionActual}`).openPopup();
        } else {
            userMarker.setLatLng(pos);
        }

        map.setView(pos, 16);
    }
});

// Función de logout
function logout() {
    const camionActual = localStorage.getItem('camionSeleccionado') || '';
    console.log(`👋 [${camionActual}] Cerrando sesión...`);
    
    // Detener tracking si está activo
    if (watchId !== null && camionActual && db) {
        navigator.geolocation.clearWatch(watchId);
        db.ref(`ubicaciones/${camionActual}`).remove()
            .then(() => console.log(`🗑️ [${camionActual}] Ubicación limpiada al cerrar sesión`))
            .catch(e => console.error(`❌ [${camionActual}] Error limpiando ubicación:`, e));
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
    const camionActual = localStorage.getItem('camionSeleccionado') || '';
    
    if (watchId !== null && camionActual && db) {
        console.log(`🚪 [${camionActual}] Página cerrándose, limpiando ubicación...`);
        
        // Uso de sendBeacon para envío garantizado al cerrar
        const url = `https://ecocalendario-51a84-default-rtdb.firebaseio.com/ubicaciones/${camionActual}.json`;
        navigator.sendBeacon(url, JSON.stringify(null));
    }
});

// Detectar cambios de visibilidad de la página
document.addEventListener('visibilitychange', () => {
    const camionActual = localStorage.getItem('camionSeleccionado') || '';
    
    if (document.hidden) {
        console.log(`📱 [${camionActual}] Página en segundo plano - tracking continúa`);
    } else {
        console.log(`👁️ [${camionActual}] Página visible nuevamente`);
        lastUpdate = Date.now(); // Resetear contador
    }
});