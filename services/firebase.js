// services/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
  get
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAh5BW3Yg6pFNfDVynYXcHOiA96G5ZPr2w",
  authDomain: "ecocalendario-51a84.firebaseapp.com",
  projectId: "ecocalendario-51a84",
  storageBucket: "ecocalendario-51a84.firebasestorage.app",
  messagingSenderId: "276857323066",
  appId: "1:276857323066:web:99b3f8f2e9d0d471d97f03",
  measurementId: "G-VXCZYN6WNC",
  databaseURL: "https://ecocalendario-51a84-default-rtdb.firebaseio.com/"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Lista de IDs de camiones disponibles
const CAMIONES_IDS = ['camionero1', 'camionero2', 'camionero3', 'camionero4', 'camionero5'];

/**
 * Obtiene la referencia de un camión específico
 * @param {string} camionId - ID del camión (camionero1, camionero2, etc.)
 * @returns {DatabaseReference}
 */
function getCamionRef(camionId) {
  return ref(db, `ubicaciones/${camionId}`);
}

/**
 * Lee en tiempo real la ubicación de un camión específico
 * @param {string} camionId - ID del camión
 * @param {Function} callback - Función que recibe los datos {lat, lng, accuracy, timestamp}
 * @returns {Function} - Función para cancelar la suscripción
 */
function onCamionLocationChange(camionId, callback) {
  const camionRef = getCamionRef(camionId);
  
  const unsubscribe = onValue(camionRef, (snap) => {
    const data = snap.val();
    if (data && data.lat != null && data.lng != null) {
      callback(data);
    } else {
      // Si no hay datos, enviar null para indicar que el camión está desconectado
      callback(null);
    }
  }, (error) => {
    console.error(`Error leyendo ubicación de ${camionId}:`, error);
    callback(null);
  });

  // Retornar función para cancelar la suscripción
  return unsubscribe;
}

/**
 * Lee en tiempo real la ubicación de TODOS los camiones
 * @param {Function} callback - Función que recibe un objeto con todos los camiones activos
 * @returns {Function} - Función para cancelar todas las suscripciones
 */
function onAllCamionesLocationChange(callback) {
  const ubicacionesRef = ref(db, 'ubicaciones');
  
  const unsubscribe = onValue(ubicacionesRef, (snap) => {
    const data = snap.val() || {};
    callback(data);
  }, (error) => {
    console.error('Error leyendo todas las ubicaciones:', error);
    callback({});
  });

  return unsubscribe;
}

/**
 * Escribe o actualiza la ubicación de un camión en RTDB
 * @param {string} camionId - ID del camión
 * @param {Object} location - Objeto con {lat, lng, accuracy, timestamp, camionId}
 * @returns {Promise}
 */
function setCamionLocation(camionId, location) {
  const camionRef = getCamionRef(camionId);
  
  const payload = {
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy || null,
    timestamp: location.timestamp || Date.now(),
    camionId: camionId
  };

  return set(camionRef, payload);
}

/**
 * Elimina la ubicación de un camión (cuando se desconecta)
 * @param {string} camionId - ID del camión
 * @returns {Promise}
 */
function removeCamionLocation(camionId) {
  const camionRef = getCamionRef(camionId);
  return remove(camionRef);
}

/**
 * Obtiene la ubicación actual de un camión (una sola vez, no en tiempo real)
 * @param {string} camionId - ID del camión
 * @returns {Promise<Object|null>}
 */
async function getCamionLocation(camionId) {
  const camionRef = getCamionRef(camionId);
  
  try {
    const snapshot = await get(camionRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error(`Error obteniendo ubicación de ${camionId}:`, error);
    return null;
  }
}

/**
 * Obtiene todas las ubicaciones de camiones actualmente (una sola vez)
 * @returns {Promise<Object>}
 */
async function getAllCamionesLocations() {
  const ubicacionesRef = ref(db, 'ubicaciones');
  
  try {
    const snapshot = await get(ubicacionesRef);
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return {};
  } catch (error) {
    console.error('Error obteniendo todas las ubicaciones:', error);
    return {};
  }
}

/**
 * Verifica si un camión está activo/conectado
 * @param {string} camionId - ID del camión
 * @returns {Promise<boolean>}
 */
async function isCamionActive(camionId) {
  const location = await getCamionLocation(camionId);
  
  if (!location) return false;
  
  // Verificar si la última actualización fue hace menos de 2 minutos
  const now = Date.now();
  const lastUpdate = location.timestamp || 0;
  const timeDiff = now - lastUpdate;
  
  return timeDiff < 120000; // 2 minutos
}

/**
 * Limpia ubicaciones antiguas (más de 5 minutos sin actualización)
 * Útil para ejecutar periódicamente y limpiar camiones "fantasma"
 * @returns {Promise<Array>} - Array de IDs de camiones limpiados
 */
async function cleanOldLocations() {
  const allLocations = await getAllCamionesLocations();
  const now = Date.now();
  const cleanedCamiones = [];
  
  for (const [camionId, location] of Object.entries(allLocations)) {
    const lastUpdate = location.timestamp || 0;
    const timeDiff = now - lastUpdate;
    
    // Si tiene más de 5 minutos sin actualizar
    if (timeDiff > 300000) {
      await removeCamionLocation(camionId);
      cleanedCamiones.push(camionId);
      console.log(`🧹 Limpiado camión inactivo: ${camionId}`);
    }
  }
  
  return cleanedCamiones;
}

// Exportar funciones y constantes
export {
  // Constantes
  CAMIONES_IDS,
  
  // Funciones principales
  onCamionLocationChange,
  onAllCamionesLocationChange,
  setCamionLocation,
  removeCamionLocation,
  
  // Funciones auxiliares
  getCamionLocation,
  getAllCamionesLocations,
  isCamionActive,
  cleanOldLocations,
  
  // Referencias directas (por si se necesitan)
  db
};