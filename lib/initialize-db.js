const admin = require('firebase-admin');
require('dotenv').config();

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function initializeDatabase() {
  try {
    console.log('🚀 Inicializando base de datos...');

    // Crear usuarios por defecto
    const defaultUsers = [
      {
        fullName: 'Administrador',
        username: 'admin',
        password: '1234',
        role: 'ADMIN',
        company: 'A8A',
        blocked: false
      },
      {
        fullName: 'Coordinador',
        username: 'coordinador',
        password: '1234',
        role: 'COORDINADOR',
        company: 'A8A',
        blocked: false
      },
      {
        fullName: 'Usuario Empresa',
        username: 'empresa',
        password: '1234',
        role: 'EMPRESA',
        company: 'TRANSEGOVIA',
        blocked: false
      }
    ];

    // Limpiar usuarios existentes
    const usersSnapshot = await db.collection('users').get();
    for (const doc of usersSnapshot.docs) {
      await doc.ref.delete();
    }

    // Agregar nuevos usuarios
    for (const user of defaultUsers) {
      await db.collection('users').add(user);
      console.log(`✅ Usuario creado: ${user.username}`);
    }

    console.log('✅ Base de datos inicializada correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

initializeDatabase();
