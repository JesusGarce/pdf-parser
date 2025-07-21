# PDF Extractor - Estructura Modular

## Descripción

El PDF Extractor ha sido reestructurado para soportar múltiples proveedores con una arquitectura modular y extensible.

## Estructura del Proyecto

```
src/
├── pdfExtractor.js          # Clase principal del extractor
├── providers/               # Proveedores específicos
│   ├── BaseProvider.js      # Clase base para todos los proveedores
│   ├── ACLProvider.js       # Proveedor específico para ACL
│   ├── GenericProvider.js   # Proveedor genérico
│   └── index.js             # Índice de proveedores
├── utils/                   # Utilidades comunes
│   └── textUtils.js         # Funciones de procesamiento de texto
└── config/                  # Configuración centralizada
    └── patterns.js          # Patrones regex y configuración
```

## Características Principales

### 1. Arquitectura Modular
- **BaseProvider**: Clase base que define la interfaz común para todos los proveedores
- **Proveedores Específicos**: Cada proveedor implementa su propia lógica de extracción
- **Detección Automática**: El sistema detecta automáticamente el proveedor basado en el contenido

### 2. Configuración Centralizada
- **Patrones Regex**: Todos los patrones están centralizados en `config/patterns.js`
- **Umbrales**: Configuración de valores mínimos y máximos
- **Palabras Clave**: Definición de términos para identificar secciones

### 3. Utilidades Comunes
- **Procesamiento de Texto**: Funciones reutilizables para limpieza y normalización
- **Validación**: Verificación de formatos y tipos de datos
- **Conversión**: Transformación de datos del PDF a texto plano

## Uso Básico

```javascript
const PDFExtractor = require('./src/pdfExtractor');

const extractor = new PDFExtractor();

// Extracción con detección automática de proveedor
const result = await extractor.extractInvoiceData('path/to/invoice.pdf');

// Extracción con proveedor específico
const result = await extractor.extractInvoiceData('path/to/invoice.pdf', 'ACL');
```

## Agregar un Nuevo Proveedor

1. **Crear el proveedor**:
```javascript
const BaseProvider = require('./BaseProvider');

class NewProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'NEW_PROVIDER';
    this.keywords = ['keyword1', 'keyword2'];
  }

  canHandle(text) {
    return this.keywords.some(keyword => 
      text.toUpperCase().includes(keyword.toUpperCase())
    );
  }

  async extractData(pdfPath, extractor) {
    // Implementar lógica específica del proveedor
  }
}
```

2. **Registrar el proveedor**:
```javascript
const extractor = new PDFExtractor();
extractor.registerProvider('NEW_PROVIDER', new NewProvider());
```

## Proveedores Disponibles

### ACL Provider
- **Palabras clave**: ACL, Arco Logística, ArcoLogística
- **Características**: Extracción optimizada para tablas de ACL
- **Método preferido**: Extracción de tabla

### Gestinlib Provider
- **Palabras clave**: Gestinlib, GESTINLIB, gestinlib
- **Características**: Extracción de códigos EAN desde imágenes + datos de tabla
- **Método preferido**: Extracción de tabla + OCR para códigos de barras
- **Formato**: [TITULO, CANTIDAD, PRECIO] + códigos EAN en imágenes

### Generic Provider
- **Palabras clave**: Ninguna (maneja cualquier PDF)
- **Características**: Métodos generales de extracción de texto
- **Método preferido**: Extracción de texto nativo + OCR

## Configuración

### Patrones Regex
Los patrones están organizados por categoría:
- `itemCode`: Códigos de producto
- `quantity`: Cantidades
- `price`: Precios
- `total`: Totales
- `supplier`: Información del proveedor
- `date`: Fechas
- `invoiceNumber`: Números de factura

### Umbrales
- `minTextLength`: Longitud mínima del texto extraído
- `minItemNameLength`: Longitud mínima del nombre del producto
- `maxItemNameLength`: Longitud máxima del nombre del producto
- `minPriceThreshold`: Precio mínimo válido
- `maxPriceThreshold`: Precio máximo válido

## Métodos de Extracción

### 1. Extracción Nativa
- Extrae texto directamente del PDF
- Más rápido y preciso para PDFs con texto
- Método preferido cuando está disponible

### 2. Extracción OCR
- Usa Tesseract.js para PDFs escaneados
- Más lento pero necesario para imágenes
- Se usa como fallback cuando la extracción nativa falla

### 3. Extracción de Tabla
- Usa pdfreader para extraer datos tabulares
- Específico para proveedores con formatos de tabla conocidos
- Más preciso para datos estructurados

### 4. Extracción de Tabla + OCR (Gestinlib)
- Combina extracción de tabla con OCR para códigos de barras
- Extrae datos estructurados de la tabla
- Usa OCR para leer códigos EAN desde imágenes
- Validación de códigos EAN con algoritmo de checksum

## Comparación de Documentos

```javascript
const comparison = extractor.compareDocuments(doc1Data, doc2Data);
```

La comparación incluye:
- Artículos comunes y únicos
- Diferencias de precios y cantidades
- Comparación de totales
- Resumen estadístico

## Optimizaciones Implementadas

1. **Reutilización de Código**: Funciones comunes centralizadas
2. **Configuración Centralizada**: Patrones y umbrales en un solo lugar
3. **Detección Automática**: No requiere especificar proveedor manualmente
4. **Manejo de Errores**: Mejor gestión de errores y logging
5. **Extensibilidad**: Fácil agregar nuevos proveedores
6. **Mantenibilidad**: Código más limpio y organizado

## Caso Especial: Gestinlib Provider

El proveedor Gestinlib maneja un caso especial donde los códigos EAN están embebidos como imágenes dentro de las tablas del PDF.

### Características Específicas:
- **Detección automática**: Identifica el formato [TITULO, CANTIDAD, PRECIO]
- **Extracción de imágenes**: Extrae imágenes de celdas específicas del PDF
- **OCR de códigos EAN**: Usa Tesseract.js para leer códigos de barras
- **Validación EAN**: Valida códigos usando algoritmo de checksum
- **Fallback**: Asigna códigos temporales si no se puede extraer el EAN

### Uso:
```javascript
const extractor = new PDFExtractor();

// Detección automática
const result = await extractor.extractInvoiceData('gestinlib_invoice.pdf');

// Proveedor específico
const result = await extractor.extractInvoiceData('gestinlib_invoice.pdf', 'GESTINLIB');

console.log('Códigos EAN encontrados:', result.processedData.metadata.eanCodesFound);
```

### Estructura de Datos:
```javascript
{
  supplier: 'GESTINLIB',
  items: [
    {
      codigo: '9788497591234', // Código EAN extraído
      titulo: 'LAS ABANDONADAS',
      cantidad: 1,
      precio: 21.90
    }
  ],
  metadata: {
    eanCodesFound: 12, // Número de códigos EAN extraídos
    provider: 'GESTINLIB'
  }
}
```

## Próximos Pasos

1. Agregar más proveedores específicos
2. Implementar cache de patrones compilados
3. Agregar validación de datos extraídos
4. Implementar tests unitarios
5. Agregar soporte para más formatos de salida
6. Mejorar extracción de imágenes de PDFs
7. Implementar detección automática de códigos de barras 