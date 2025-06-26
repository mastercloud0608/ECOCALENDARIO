// services/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set
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

// Referencia donde guardamos/laemos la ubicación
const camionRef = ref(db, "camiones/camion1/ubicacion");

/** Lee en tiempo real la ubic del camión */
function onCamionLocationChange(cb) {
  onValue(camionRef, snap => {
    const data = snap.val();
    if (data && data.lat != null && data.lng != null) {
      cb(data);
    }
  });
}

/** Escribe (o actualiza) la ubic en RTDB */
function setCamionLocation(loc) {
  return set(camionRef, loc);
}

export { onCamionLocationChange, setCamionLocation };
