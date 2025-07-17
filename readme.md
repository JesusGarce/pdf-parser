# Configuración Node.js en Plesk (Hosting Compartido)

## ✅ Ventajas de Node.js en Plesk

- **Sin SSH necesario**: Plesk maneja las dependencias automáticamente
- **Interfaz gráfica**: Configuración desde el panel web
- **Escalabilidad**: Mejor rendimiento que PHP para este tipo de tareas
- **Gestión automática**: Plesk reinicia la aplicación si falla

## 📋 Pasos de Configuración

### 1. **Crear la Aplicación Node.js**

1. **Ir a tu dominio en Plesk**
2. **Buscar "Node.js" en las aplicaciones**
3. **Hacer clic en "Crear aplicación Node.js"**
4. **Configurar:**
   - **Versión Node.js**: 18.x o superior
   - **Modo de aplicación**: Producción
   - **Directorio de la aplicación**: `httpdocs` (o subdirectorio)
   - **Archivo de inicio**: `server.js`

### 2. **Subir los Archivos**

Crear la siguiente estructura en tu directorio web:

```
httpdocs/
├── server.js          # Código principal
├── package.json       # Dependencias
├── public/            # Archivos estáticos (opcional)
└── tmp/              # Archivos temporales
```

### 3. **Configurar package.json**

Plesk leerá automáticamente el `package.json` e instalará las dependencias.

### 4. **Configurar Variables de Entorno**

En el panel de Node.js de Plesk:

```
NODE_ENV=production
PORT=3000
MAX_FILE_SIZE=16777216
```

### 5. **Iniciar la Aplicación**

1. **Hacer clic en "Instalar dependencias"**
2. **Verificar que todas las dependencias se instalaron**
3. **Hacer clic en "Iniciar aplicación"**

## 🔧 Configuración Avanzada

### **Configurar Proxy (Opcional)**

Si quieres que tu aplicación sea accesible desde la raíz del dominio:

1. **Ir a "Configuración de Apache y nginx"**
2. **Añadir reglas de proxy:**

```nginx
# Configuración nginx
location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 16M;
}

location /upload {
    proxy_pass http://localhost:3000/upload;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 16M;
}
```

### **Configurar Límites de Subida**

En el panel de Plesk:

1. **Ir a "Configuración de Apache y nginx"**
2. **Añadir directiva:**

```apache
# Para Apache
<Directory "/var/www/vhosts/tu-dominio.com/httpdocs">
    LimitRequestBody 16777216
</Directory>
```

## 🚀 Despliegue Paso a Paso

### **1. Crear server.js**

Copia el código de la aplicación Node.js al archivo `server.js` en tu directorio web.

### **2. Crear package.json**

```json
{
  "name": "pdf-invoice-parser",
  "version": "1.0.0",
  "description": "Parser de PDFs para facturas y albaranes",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "pdf-parse": "^1.1.1",
    "uuid": "^9.0.0"
  }
}
```

### **3. Configurar en Plesk**

1. **Panel Plesk → Tu dominio → Node.js**
2. **Crear nueva aplicación:**
   - Versión: Node.js 18.x
   - Modo: Producción
   - Directorio: httpdocs
   - Archivo de inicio: server.js

### **4. Instalar y Ejecutar**

1. **Hacer clic en "Instalar dependencias"**
2. **Esperar a que se instalen todas las dependencias**
3. **Hacer clic en "Iniciar aplicación"**

### **5. Verificar Funcionamiento**

```bash
# Verificar que funciona
curl http://tu-dominio.com:3000/health

# O desde el navegador:
http://tu-dominio.com:3000/
```

## 🔍 Monitoreo y Debugging

### **Ver Logs**

En el panel de Node.js:

1. **Ir a "Registros"**
2. **Ver logs de aplicación**
3. **Ver logs de error**

### **Comandos Útiles**

```bash
# Reiniciar aplicación
# (Se hace desde el panel de Plesk)

# Ver estado
# (Se ve en el panel de Plesk)

# Actualizar dependencias
# (Se hace desde el panel de Plesk)
```

## 📱 Uso de la Aplicación

### **Interfaz Web**

Accede a: `http://tu-dominio.com:3000`

### **API REST**

```bash
# Procesar PDF
curl -X POST -F "file=@factura.pdf" http://tu-dominio.com:3000/api