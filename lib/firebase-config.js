// Firebase Client Config
// Este archivo contiene la configuración para el SDK de Firebase en el navegador

const firebaseConfig = {
  apiKey: "AIzaSyDkSh6HCKWq1lGctsP-iOwI5DzDGuYpGis",
  authDomain: "agenda-revisiones.firebaseapp.com",
  projectId: "agenda-revisiones",
  storageBucket: "agenda-revisiones.firebasestorage.app",
  messagingSenderId: "18108519053",
  appId: "1:18108519053:web:ff495023c42deda5e948c4",
  measurementId: "G-EQT33S4C1B"
};

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseConfig;
}
