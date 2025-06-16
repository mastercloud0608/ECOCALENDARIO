if (localStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'login.html';
}

window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-ubicacion');
    let tracking = false;
    let watchId = null;

    // Restaurar estado al recargar si ya estaba activo
    if (localStorage.getItem('ubicacionActiva') === 'true') {
        iniciarSeguimiento();
    }

    btn.addEventListener('click', () => {
        if (!tracking) {
            iniciarSeguimiento();
        } else {
            detenerSeguimiento();
        }
    });

    function iniciarSeguimiento() {
        if (!navigator.geolocation) {
            alert("La geolocalización no es soportada por este navegador.");
            return;
        }

        tracking = true;
        btn.classList.add('active');
        btn.textContent = 'Desactivar Ubicación';
        btn.style.backgroundColor = '#27ae60';

        localStorage.setItem('ubicacionActiva', 'true');

        watchId = navigator.geolocation.watchPosition(position => {
            const { latitude, longitude } = position.coords;
            localStorage.setItem('camioneroUbicacion', JSON.stringify({ lat: latitude, lng: longitude, timestamp: Date.now() }));
            console.log("Ubicación guardada:", latitude, longitude);
        }, error => {
            console.error("Error obteniendo ubicación:", error.message);
        }, {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
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
