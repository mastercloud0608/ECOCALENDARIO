// services/ubireal.js
import { onCamionLocationChange } from "./firebase.js";

let map, camionMarker, lastPos = null;
const notified = new Set();

// Ruta predefinida
const ruta = [
  [-17.770539633794648, -63.20992613361338],
  [-17.772068557215775, -63.20394188927357],
  [-17.777305289438623, -63.205537769465565],
  [-17.777448567255117, -63.21572145849559]
];

function toRad(x){ return x * Math.PI/180; }
function distancia(a1,b1,a2,b2){
  const R=6371000, dLat=toRad(a2-a1), dLon=toRad(b2-b1);
  const A=Math.sin(dLat/2)**2 +
    Math.cos(toRad(a1))*Math.cos(toRad(a2))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(A),Math.sqrt(1-A));
}

function notify(m){
  if (!("Notification" in window)) return;
  if (Notification.permission==="granted") new Notification(m);
  else if (Notification.permission!=="denied"){
    Notification.requestPermission().then(p=> p==="granted" && new Notification(m));
  }
}

export function initUbicacionReal(){
  map = L.map("mapa-ubicacion").setView([-17.7850, -63.1737], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:"© OpenStreetMap contributors"
  }).addTo(map);

  const poly = L.polyline(ruta, { color:"red",weight:4,opacity:0.8 }).addTo(map);
  ruta.forEach((c,i)=> L.marker(c).addTo(map).bindPopup(`Punto ${i+1}`));
  map.fitBounds(poly.getBounds());

  onCamionLocationChange(({lat,lng})=>{
    const pos=[lat,lng], moved=!lastPos||pos[0]!==lastPos[0]||pos[1]!==lastPos[1];
    if (!camionMarker){
      camionMarker = L.marker(pos,{
        icon:L.icon({
          iconUrl:"assets/images/camion.png",
          iconSize:[25,25],iconAnchor:[12,25]
        })
      }).addTo(map).bindPopup("Camión en ruta").openPopup();
      lastPos=pos;
    } else {
      camionMarker.setLatLng(pos);
      if (moved){
        camionMarker.getPopup().setContent("🚚 Camión en movimiento").openOn(map);
        lastPos=pos;
      }
    }
    ruta.forEach((p,idx)=>{
      const d = distancia(lat,lng,p[0],p[1]);
      if (d<100 && !notified.has(idx)){
        notify(`📍 Camión cerca del Punto ${idx+1}`);
        notified.add(idx);
      }
    });
  });
}
