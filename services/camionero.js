if (localStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'login.html';
}

window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-ubicacion');
    let tracking = false;
    let watchId = null;

    if (localStorage.getItem('ubicacionActiva') === 'true') {
        iniciarSeguimiento();
    }

    btn.addEventListener('click', () => {
        if (!tracking) {
            solicitarPermisoYIniciar();
        } else {
            detenerSeguimiento();
        }
    });

    function solicitarPermisoYIniciar() {
        if (!navigator.geolocation) {
            alert("La geolocalización no es soportada por este navegador.");
            return;
        }

        navigator.geolocation.getCurrentPosition(pos => {
            console.log("Permiso de ubicación concedido.");
            iniciarSeguimiento();
        }, err => {
            console.warn("Permiso denegado o error:", err.message);

            const deseaAyuda = confirm(
                "⚠️ No se pudo obtener tu ubicación. Esto puede deberse a que:\n\n" +
                "- No diste permisos al navegador\n" +
                "- La ubicación está desactivada\n\n" +
                "¿Deseas ver cómo activarla?"
            );

            if (deseaAyuda) {
                mostrarGuiaActivacion();
            }
        }, {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 0
        });
    }

    function mostrarGuiaActivacion() {
        const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const guia = esIOS
            ? "🔧 iPhone (Safari o Chrome):\n\n" +
              "1. Abrí Ajustes del iPhone.\n" +
              "2. Buscá 'Chrome' o 'Safari'.\n" +
              "3. Entrá en 'Ubicación'.\n" +
              "4. Elegí 'Al usar la app' o 'Siempre'.\n\n" +
              "Luego volvé aquí y tocá nuevamente 'Activar Ubicación'."
            : "🔧 Android o PC:\n\n" +
              "1. Asegurate de que la ubicación esté activada.\n" +
              "2. Verificá que el navegador tenga permisos para acceder.\n" +
              "3. Tocá el candado 🔒 en la barra de direcciones y permití 'Ubicación'.\n\n" +
              "Luego recargá la página o tocá nuevamente 'Activar Ubicación'.";

        alert(guia);
    }

    function iniciarSeguimiento() {
        tracking = true;
        btn.classList.add('active');
        btn.textContent = 'Desactivar Ubicación';
        btn.style.backgroundColor = '#27ae60';
        localStorage.setItem('ubicacionActiva', 'true');

        watchId = navigator.geolocation.watchPosition(position => {
            const { latitude, longitude, accuracy } = position.coords;

            if (accuracy > 50) {
                console.warn("Ubicación descartada por baja precisión:", accuracy);
                return;
            }

            const nuevaUbicacion = {
                lat: latitude,
                lng: longitude,
                timestamp: Date.now()
            };

            const anterior = JSON.parse(localStorage.getItem('camioneroUbicacion') || '{}');
            const moved = !anterior.lat || Math.abs(anterior.lat - latitude) > 0.00005 || Math.abs(anterior.lng - longitude) > 0.00005;

            if (moved) {
                localStorage.setItem('camioneroUbicacion', JSON.stringify(nuevaUbicacion));
                console.log("Ubicación actualizada:", nuevaUbicacion);
            }

        }, error => {
            console.error("Error durante seguimiento:", error.message);
        }, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 7000
        });
    }

    function detenerSeguimiento() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }

        tracking = false;
        btn.classList.remove('active');
        btn.textContent = 'Activar Ubicación';
        btn.style.backgroundColor = '#2c3e50';

        localStorage.removeItem('camioneroUbicacion');
        localStorage.setItem('ubicacionActiva', 'false');
    }
});

function logout() {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('camioneroUbicacion');
    localStorage.removeItem('ubicacionActiva');
    window.location.href = 'login.html';
}
