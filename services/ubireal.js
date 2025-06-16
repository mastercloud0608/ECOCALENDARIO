let map;
let userMarker;

function initMap() {
    map = L.map('mapa-ubicacion').setView([-17.7850, -63.1737], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Ruta predefinida
    const routeCoordinates = [
        [-17.770539633794648, -63.20992613361338],
        [-17.772068557215775, -63.20394188927357],
        [-17.777305289438623, -63.205537769465565],
        [-17.777448567255117, -63.21572145849559]
    ];

    const routeLine = L.polyline(routeCoordinates, {
        color: 'red',
        weight: 4,
        opacity: 0.8
    }).addTo(map);

    map.fitBounds(routeLine.getBounds());

    routeCoordinates.forEach((coord, i) => {
        L.marker(coord).addTo(map).bindPopup(`Punto ${i + 1}`);
    });

    startTracking();
}

function startTracking() {
    if (!navigator.geolocation) {
        alert("La geolocalización no es soportada por este navegador.");
        return;
    }

    navigator.geolocation.watchPosition(updatePosition, handleError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000
    });
}

function updatePosition(position) {
    const { latitude, longitude } = position.coords;
    const userLatLng = [latitude, longitude];

    if (!userMarker) {
        userMarker = L.marker(userLatLng, { title: "Tu ubicación", icon: L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png',
            iconSize: [25, 25]
        }) }).addTo(map).bindPopup("Estás aquí");
    } else {
        userMarker.setLatLng(userLatLng);
    }

    map.setView(userLatLng);
}

function handleError(error) {
    console.error("Error al obtener la ubicación:", error.message);
}
