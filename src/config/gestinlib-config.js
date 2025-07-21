/**
 * Configuración específica para el proveedor Gestinlib
 */

// Configuración de detección de productos
const PRODUCT_DETECTION = {
  // Palabras que indican que NO es un producto
  excludeKeywords: [
    'código', 'concepto', 'cantida', 'precio', 'observaciones',
    'base imponible', 'imp. i.v.a.', 'imp. re.', 'importe total',
    'total', 'subtotal', 'iva', 'base'
  ],
  
  // Patrones para identificar filas de producto
  productPatterns: {
    title: {
      minLength: 10,
      maxLength: 200
    },
    quantity: {
      pattern: /^\d+$/,
      minValue: 1,
      maxValue: 999
    },
    price: {
      pattern: /\d+[.,]\d{2}\s*€/,
      minValue: 0.01,
      maxValue: 999999.99
    }
  }
};

// Configuración de códigos EAN
const EAN_CONFIG = {
  // Tipos de códigos soportados
  supportedTypes: [
    { name: 'EAN-13', length: 13, pattern: /^\d{13}$/ },
    { name: 'EAN-8', length: 8, pattern: /^\d{8}$/ },
    { name: 'EAN-12', length: 12, pattern: /^\d{12}$/ }
  ],
  
  // Configuración de OCR para códigos EAN
  ocr: {
    language: 'eng',
    config: {
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: '7', // Single uniform block of text
      tessedit_ocr_engine_mode: '3' // Default, based on what is available
    }
  },
  
  // Validación de códigos EAN
  validation: {
    enableChecksum: true,
    allowInvalidChecksum: false,
    minConfidence: 0.8
  }
};

// Configuración de extracción de imágenes
const IMAGE_EXTRACTION = {
  // Límites aproximados de la tabla (se pueden ajustar según el PDF)
  tableBounds: {
    x: 50,
    y: 200,
    width: 500,
    height: 600
  },
  
  // Configuración de celdas
  cellConfig: {
    eanColumn: 0, // Columna donde están los códigos EAN
    titleColumn: 0, // Columna del título (mismo que EAN en este caso)
    quantityColumn: 1, // Columna de cantidad
    priceColumn: 2 // Columna de precio
  },
  
  // Configuración de imagen
  image: {
    format: 'png',
    quality: 300, // DPI
    background: 'white'
  }
};

// Configuración de procesamiento
const PROCESSING_CONFIG = {
  // Umbrales para validación
  thresholds: {
    minProducts: 1,
    maxProducts: 1000,
    minTotalAmount: 0.01,
    maxTotalAmount: 999999.99,
    minEANSuccessRate: 0.5 // 50% de códigos EAN extraídos exitosamente
  },
  
  // Configuración de logging
  logging: {
    enableDetailedLogs: true,
    logEANExtraction: true,
    logImageExtraction: true
  },
  
  // Configuración de fallback
  fallback: {
    enableTemporaryCodes: true,
    temporaryCodePrefix: 'GESTINLIB_',
    enableGenericExtraction: true
  }
};

// Configuración de validación de datos
const VALIDATION_CONFIG = {
  // Validación de productos
  products: {
    requireTitle: true,
    requirePrice: true,
    requireQuantity: true,
    requireCode: false, // Los códigos EAN pueden fallar
    minTitleLength: 5,
    maxTitleLength: 200,
    minPrice: 0.01,
    maxPrice: 999999.99,
    minQuantity: 1,
    maxQuantity: 999
  },
  
  // Validación de totales
  totals: {
    requireTotal: false,
    requireSubtotal: false,
    tolerance: 0.01 // Tolerancia para diferencias de redondeo
  },
  
  // Validación de metadatos
  metadata: {
    requireSupplier: true,
    requireExtractionDate: true,
    requireProcessingDate: true
  }
};

module.exports = {
  PRODUCT_DETECTION,
  EAN_CONFIG,
  IMAGE_EXTRACTION,
  PROCESSING_CONFIG,
  VALIDATION_CONFIG
}; 