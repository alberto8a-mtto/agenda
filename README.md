# Agenda de Revisiones

Aplicación web sencilla para gestionar citas de revisiones de vehículos. No requiere servidor ni instalación de dependencias — se ejecuta directamente en el navegador.

## Cómo usar

1. Abre `login.html` en cualquier navegador moderno.
2. Inicia sesión con una cuenta válida:
  - **admin / 1234**
  - **coordinador / 1234**
3. El sistema redirige automáticamente a `index.html`.
4. Rellena el formulario y guarda citas.
5. Las citas se ordenan automáticamente por fecha y hora.

## Cambiar las credenciales

1. Inicia sesión.
2. Haz clic en **Cambiar mi usuario/clave**.
3. Ingresa la clave actual y luego define nuevo usuario y nueva clave.

Las credenciales quedan guardadas en `localStorage` para ese navegador.

## Estructura

```
proyecto-revisiones/
├── login.html   → Pantalla de inicio de sesión
├── index.html   → Agenda, consolidado y gestión
├── style.css    → Estilos y diseño responsive
├── login.js     → Lógica de autenticación en login
├── script.js    → Lógica principal (agenda, usuarios, consolidado)
├── README.md    → Este archivo
└── assets/      → Imágenes u otros recursos estáticos
```

## Almacenamiento

Las citas se guardan en el **localStorage** del navegador bajo la clave `revisiones_transporte_app_v2`.
Las credenciales se guardan en `localStorage` bajo la clave `revisiones_auth_config_v1`.
La sesión activa se guarda en `sessionStorage` bajo la clave `revisiones_active_session_v1`.
No se envía ningún dato a servidores externos.

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox, Safari).
- No requiere conexión a Internet.
