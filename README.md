# 📋 Gestión Corporativa de Revisiones

Aplicación web para gestionar revisiones técnicas con almacenamiento centralizado en **Firebase** y **Vercel**.

## 🚀 Acceso Rápido

### 🌐 Dirección Pública
**[https://alberto8a-mtto.github.io/agenda/](https://alberto8a-mtto.github.io/agenda/)**

### 👥 Usuarios por Defecto

| Usuario | Contraseña | Rol | Empresa |
|---------|-----------|-----|---------|
| admin | 1234 | ADMIN | A8A |
| coordinador | 1234 | COORDINADOR | A8A |
| empresa | 1234 | EMPRESA | TRANSEGOVIA |

## ⚙️ Configuración Firebase + Vercel

### 1️⃣ Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea proyecto: **"agenda-revisiones"**
3. Activa **Firestore Database** (modo producción)
4. Configuración → Cuentas de Servicio → Descarga clave JSON

### 2️⃣ Variables de Entorno

Copia `.env.example` a `.env`:

```bash
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=agenda-revisiones
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

### 3️⃣ Deploy en Vercel

1. Ve a [Vercel](https://vercel.com)
2. Importa proyecto desde GitHub
3. Agrega variables de entorno (igual que arriba)
4. Deploy automático en cada push

## 📂 Estructura

```
proyecto-revisiones/
├── api/
│   └── index.js         → Backend Express + Firebase
├── lib/
│   └── initialize-db.js → Script inicialización
├── login.html           → Pantalla de inicio
├── index.html           → App principal
├── script.js            → Lógica cliente
├── style.css            → Estilos
├── package.json         → Dependencias Node.js
├── vercel.json          → Configuración Vercel
└── .env.example         → Plantilla variables
```

## 🔐 Características

✅ Almacenamiento centralizado en Firebase Firestore
✅ Control de acceso por roles (ADMIN, COORDINADOR, EMPRESA)
✅ Gestión de usuarios y permisos
✅ Carga y descarga de PDFs
✅ Aislamiento de datos por empresa
✅ Interfaz responsiva

## 📝 API Backend

### Autenticación
- `POST /api/auth/login` - Iniciar sesión

### Usuarios
- `GET /api/users` - Listar todos
- `POST /api/users` - Crear
- `DELETE /api/users/:id` - Eliminar
- `PATCH /api/users/:id/block` - Bloquear/desbloquear
- `PATCH /api/users/:id/password` - Cambiar contraseña

### Citas
- `GET /api/appointments` - Listar todos
- `POST /api/appointments` - Crear
- `PATCH /api/appointments/:id` - Actualizar
- `DELETE /api/appointments/:id` - Eliminar

## 🛠️ Stack Tecnológico

- **Frontend:** HTML5, CSS3, JavaScript ES6+
- **Backend:** Node.js + Express
- **BD:** Google Firestore
- **Hosting:** Vercel + GitHub
- **Control:** Git

## ⚠️ Tareas Pendientes (Seguridad)

- [ ] Cambiar contraseñas por defecto
- [ ] Implementar JWT tokens
- [ ] Usar bcrypt para hashes
- [ ] Configurar reglas de Firestore
- [ ] HTTPS en todas las conexiones

---

**Desarrollado para A8A - Gestión Corporativa**
