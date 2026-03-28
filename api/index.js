require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

let db = null;

function getStorageBucketName(projectId) {
  return process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
}

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    db = admin.firestore();
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido.');
    }

    // Vercel guarda saltos de línea escapados en private_key.
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    const resolvedProjectId = projectId || serviceAccount.project_id;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: resolvedProjectId,
      storageBucket: getStorageBucketName(resolvedProjectId)
    });
    db = admin.firestore();
    return;
  }

  // Fallback local si existe ADC en la máquina.
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
    storageBucket: getStorageBucketName(projectId)
  });
  db = admin.firestore();
}

function getDb() {
  if (!db) {
    initializeFirebaseAdmin();
  }
  return db;
}

function getStorageBucket() {
  if (!admin.apps.length) {
    initializeFirebaseAdmin();
  }
  return admin.storage().bucket();
}

function sanitizeFileName(fileName) {
  return path.basename(fileName || 'informe.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ==================== AUTENTICACIÓN ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    const db = getDb();
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
    const db = getDb();
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
    res.status(500).json({ error: `Error al obtener usuarios: ${error.message}` });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const db = getDb();
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
    const db = getDb();
    await db.collection('users').doc(req.params.id).delete();
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const db = getDb();
    const allowedFields = ['fullName', 'username', 'role', 'company', 'blocked'];
    const payload = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        payload[field] = req.body[field];
      }
    }

    if (!Object.keys(payload).length) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    await db.collection('users').doc(req.params.id).update(payload);
    res.json({ message: 'Usuario actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.patch('/api/users/:id/block', async (req, res) => {
  try {
    const db = getDb();
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
    const db = getDb();
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

app.post('/api/uploads/pdfs/sign', async (req, res) => {
  try {
    const { appointmentId, fileName, contentType } = req.body;

    if (!appointmentId || !fileName) {
      return res.status(400).json({ error: 'appointmentId y fileName son requeridos' });
    }

    const bucket = getStorageBucket();
    const safeFileName = sanitizeFileName(fileName);
    const storagePath = `appointment-pdfs/${appointmentId}/${Date.now()}-${safeFileName}`;
    const file = bucket.file(storagePath);
    const uploadContentType = contentType || 'application/pdf';

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: uploadContentType
    });

    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: new Date('2100-01-01T00:00:00.000Z')
    });

    res.json({ uploadUrl, downloadUrl, storagePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al preparar carga de PDF' });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
    await db.collection('appointments').doc(req.params.id).update(req.body);
    res.json({ message: 'Cita actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar cita' });
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const db = getDb();
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
const publicPath = path.join(__dirname, '..');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'login.html'));
});

const PORT = process.env.PORT || 3000;

// En Vercel se exporta la app como función serverless; localmente sí levantamos puerto.
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
}

module.exports = app;
