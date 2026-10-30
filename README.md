# ConstruMatch

Marketplace para conectar clientes validados con empresas de construcción habilitadas. El repositorio contiene la experiencia web publicada en `dist/`, la API TypeScript en `server/` y el esquema PostgreSQL en `db/`.

## Seguridad aplicada

- Contraseñas con `crypto.scrypt`, sal aleatoria y parámetros almacenados.
- Sesiones mediante tokens aleatorios; PostgreSQL conserva solamente su hash SHA-256.
- Cookies `HttpOnly`, `Secure` en producción y `SameSite=Lax`.
- HSTS, CSP, `nosniff`, verificación de origen y límites de tamaño.
- Bloqueo tras 5 fallos por cuenta/IP o 30 por IP en 15 minutos.
- Consultas parametrizadas en todas las rutas; no se concatena entrada del usuario en SQL.
- Autorización por rol, validación de cuenta y propiedad/participación del recurso.
- Transacción con `FOR UPDATE` e índice parcial único para una sola cotización aceptada.
- Imágenes limitadas a 5 MB y verificadas por firma real JPG, PNG o WebP.
- Acciones críticas registradas en `audit_log`.

## Ejecución local

1. Copia `.env.example` como `.env` y reemplaza los valores.
2. Crea una base PostgreSQL 17 y ejecuta `psql "$DATABASE_URL" -f db/schema.sql`.
3. Ejecuta `npm install` y luego `npm start` con Node.js 23.6 o superior.
4. Sirve `dist/` desde `http://localhost:4173` o ajusta `APP_ORIGIN` a tu frontend.

No subas `.env`, respaldos, documentos de identidad ni credenciales al repositorio. En producción, los binarios de verificación y las imágenes deben almacenarse cifrados en un object store privado; PostgreSQL solo conserva referencias y metadatos.

## GitHub y Cloudflare

El repositorio incluye CI y un despliegue del frontend mediante Cloudflare Workers Static Assets. Para activarlo, crea un repositorio en GitHub y configura los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; el workflow publica `dist/` al actualizar `main`.

La API Express no debe desplegarse como un sitio estático. Debe ejecutarse en un servicio Node.js con acceso privado a PostgreSQL 17. Configura `APP_ORIGIN` con la URL pública de Cloudflare y mantén `DATABASE_URL` solamente en el gestor de secretos del servicio.
