require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

// ==================== AUTENTICACIÓN ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    // Buscar usuario
    const usersSnapshot = await db
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = usersSnapshot.docs[0].data();
    const userId = usersSnapshot.docs[0].id;

    // Verificar contraseña (en producción usar bcrypt)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar si está bloqueado
    if (user.blocked) {
      return res.status(403).json({ error: 'Cuenta bloqueada' });
    }

    res.json({
      userId,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      company: user.company
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

// ==================== USUARIOS ====================

app.get('/api/users', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = [];

    usersSnapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { fullName, username, password, role, company } = req.body;

    if (!fullName || !username || !password || !role || !company) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    const newUser = {
      fullName,
      username,
      password,
      role,
      company,
      blocked: false,
      createdAt: new Date()
    };

    const docRef = await db.collection('users').add(newUser);

    res.json({
      id: docRef.id,
      ...newUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.collection('users').doc(req.params.id).delete();
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

app.patch('/api/users/:id/block', async (req, res) => {
  try {
    const { blocked } = req.body;
    await db.collection('users').doc(req.params.id).update({ blocked });
    res.json({ message: 'Estado de bloqueo actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.patch('/api/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    await db.collection('users').doc(req.params.id).update({
      password,
      blocked: false
    });
    res.json({ message: 'Contraseña actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

// ==================== CITAS ====================

app.get('/api/appointments', async (req, res) => {
  try {
    const appointmentsSnapshot = await db.collection('appointments').get();
    const appointments = [];

    appointmentsSnapshot.forEach(doc => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(appointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const appointment = req.body;
    const docRef = await db.collection('appointments').add(appointment);

    res.json({
      id: docRef.id,
      ...appointment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear cita' });
  }
});

app.patch('/api/appointments/:id', async (req, res) => {
  try {
    await db.collection('appointments').doc(req.params.id).update(req.body);
    res.json({ message: 'Cita actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar cita' });
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    await db.collection('appointments').doc(req.params.id).delete();
    res.json({ message: 'Cita eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar cita' });
  }
});

// ==================== SALUD ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Servir frontend estático
app.use(express.static('../'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

module.exports = app;
