// services/ubireal.js
import { onCamionLocationChange } from "./firebase.js";

let map, camionMarker, lastPos = null;
const notified = new Set();
const RADIO_NOTIFICACION = 150; // metros
const RADIO_MUY_CERCA = 50; // metros

// Ruta predefinida con nombres descriptivos
const ruta = [
  {
    coords: [-17.770539633794648, -63.20992613361338],
    nombre: "Plaza Principal",
    zona: "Centro"
  },
  {
    coords: [-17.772068557215775, -63.20394188927357],
    nombre: "Mercado Municipal",
    zona: "Zona Norte"
  },
  {
    coords: [-17.777305289438623, -63.205537769465565],
    nombre: "Barrio San Antonio",
    zona: "Zona Sur"
  },
  {
    coords: [-17.777448567255117, -63.21572145849559],
    nombre: "Terminal de Buses",
    zona: "Zona Este"
  }
];

function toRad(x) { 
  return x * Math.PI / 180; 
}

function distancia(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + 
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("Este navegador no soporta notificaciones");
    return Promise.resolve(false);
  }

  if (Notification.permission === "granted") {
    return Promise.resolve(true);
  }

  if (Notification.permission === "denied") {
    console.warn("Notificaciones bloqueadas por el usuario");
    return Promise.resolve(false);
  }

  return Notification.requestPermission().then(permission => {
    return permission === "granted";
  });
}

function mostrarNotificacion(titulo, mensaje, icono = "🚛") {
  requestNotificationPermission().then(granted => {
    if (granted) {
      const notification = new Notification(titulo, {
        body: mensaje,
        icon: "assets/images/camion.png", // Ícono personalizado
        badge: "assets/images/badge.png", // Badge pequeño
        tag: "basurero-notif", // Evita notificaciones duplicadas
        requireInteraction: false, // Se cierra automáticamente
        silent: false // Con sonido
      });

      // Auto-cerrar después de 5 segundos
      setTimeout(() => notification.close(), 5000);
      
      // Opcional: manejar clicks en la notificación
      notification.onclick = function() {
        window.focus(); // Enfocar la ventana
        this.close();
      };
    } else {
      // Fallback: mostrar alerta en la página
      mostrarAlertaEnPagina(titulo, mensaje);
    }
  });
}

function mostrarAlertaEnPagina(titulo, mensaje) {
  // Crear elemento de alerta si no existe
  let alertContainer = document.getElementById('alert-container');
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'alert-container';
    alertContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 300px;
    `;
    document.body.appendChild(alertContainer);
  }

  // Crear alerta
  const alert = document.createElement('div');
  alert.style.cssText = `
    background: #4CAF50;
    color: white;
    padding: 15px;
    margin: 5px 0;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    font-family: Arial, sans-serif;
    animation: slideIn 0.3s ease-out;
  `;
  
  alert.innerHTML = `
    <strong>${titulo}</strong><br>
    <span style="font-size: 0.9em;">${mensaje}</span>
  `;

  alertContainer.appendChild(alert);

  // Auto-remover después de 5 segundos
  setTimeout(() => {
    if (alert.parentNode) {
      alert.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => alert.remove(), 300);
    }
  }, 5000);
}

function calcularTiempoEstimado(distanciaMetros) {
  // Asumiendo velocidad promedio de 20 km/h en zona urbana
  const velocidadPromedio = 20 / 3.6; // m/s
  const tiempoSegundos = distanciaMetros / velocidadPromedio;
  const minutos = Math.round(tiempoSegundos / 60);
  
  if (minutos < 1) return "menos de 1 minuto";
  if (minutos === 1) return "1 minuto";
  return `${minutos} minutos`;
}

export function initUbicacionReal() {
  // Inicializar mapa
  map = L.map("mapa-ubicacion").setView([-17.7850, -63.1737], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  // Dibujar ruta
  const coordenadas = ruta.map(punto => punto.coords);
  const poly = L.polyline(coordenadas, { 
    color: "red", 
    weight: 4, 
    opacity: 0.8 
  }).addTo(map);

  // Agregar marcadores de puntos con información detallada
  ruta.forEach((punto, i) => {
    const marker = L.marker(punto.coords).addTo(map);
    marker.bindPopup(`
      <strong>${punto.nombre}</strong><br>
      <em>${punto.zona}</em><br>
      <small>Punto ${i + 1} de la ruta</small>
    `);

    // Agregar círculo de notificación (visual)
    L.circle(punto.coords, {
      color: 'orange',
      fillColor: '#ff7800',
      fillOpacity: 0.1,
      radius: RADIO_NOTIFICACION
    }).addTo(map);
  });

  map.fitBounds(poly.getBounds());

  // Solicitar permisos de notificación al iniciar
  requestNotificationPermission();

  // Escuchar cambios de ubicación del camión
  onCamionLocationChange(({ lat, lng, timestamp }) => {
    const pos = [lat, lng];
    const moved = !lastPos || pos[0] !== lastPos[0] || pos[1] !== lastPos[1];

    // Crear o actualizar marcador del camión
    if (!camionMarker) {
      camionMarker = L.marker(pos, {
        icon: L.icon({
          iconUrl: "assets/images/camion.png",
          iconSize: [35, 35],
          iconAnchor: [17, 35]
        })
      }).addTo(map).bindPopup("🚛 Camión recolector").openPopup();
      
      // Notificación inicial
      mostrarNotificacion(
        "🚛 Camión en Ruta",
        "El camión recolector ha iniciado su recorrido"
      );
    } else if (moved) {
      camionMarker.setLatLng(pos);
      camionMarker.getPopup().setContent("🚛 Camión en movimiento").openOn(map);
    }

    lastPos = pos;

    // Verificar proximidad a cada punto de la ruta
    ruta.forEach((punto, idx) => {
      const distanciaActual = distancia(lat, lng, punto.coords[0], punto.coords[1]);
      const puntoId = `punto-${idx}`;

      // Notificación cuando se acerca (150m)
      if (distanciaActual <= RADIO_NOTIFICACION && !notified.has(puntoId)) {
        const tiempoEstimado = calcularTiempoEstimado(distanciaActual);
        
        mostrarNotificacion(
          `🔔 Camión Aproximándose`,
          `Se acerca a ${punto.nombre} en aproximadamente ${tiempoEstimado}`
        );
        
        notified.add(puntoId);

        // Programar notificación de llegada si está muy cerca
        if (distanciaActual <= RADIO_MUY_CERCA) {
          setTimeout(() => {
            if (!notified.has(`${puntoId}-llegada`)) {
              mostrarNotificacion(
                `📍 Camión en el Punto`,
                `¡El camión está en ${punto.nombre}! Es momento de sacar la basura`
              );
              notified.add(`${puntoId}-llegada`);
            }
          }, 1000);
        }
      }
    });

    // Limpiar notificaciones antiguas si el camión se aleja mucho
    ruta.forEach((punto, idx) => {
      const distanciaActual = distancia(lat, lng, punto.coords[0], punto.coords[1]);
      const puntoId = `punto-${idx}`;
      
      if (distanciaActual > RADIO_NOTIFICACION * 2) {
        notified.delete(puntoId);
        notified.delete(`${puntoId}-llegada`);
      }
    });
  });
}

// CSS para animaciones (agregar a tu archivo CSS)
const css = `
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}
`;

// Inyectar CSS si no existe
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = css;
  document.head.appendChild(style);
}