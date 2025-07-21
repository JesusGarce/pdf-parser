/**
 * Configuración centralizada de patrones regex
 * Patrones comunes utilizados por todos los proveedores
 */

const PATTERNS = {
  // Patrones para códigos de producto
  itemCode: [
    /(?:código|code|cod|ref|referencia|sku|art|artículo)[:\s]*([A-Z0-9\-_]{3,20})/gi,
    /\b([A-Z]{2,4}[-_]??\d{3,8})\b/g,
    /\b(\d{6,13})\b/g,
    /\b([A-Z0-9]{4,12})\b/g
  ],

  // Patrones para cantidades
  quantity: [
    /(?:cantidad|cant|qty|unidades|ud|pcs|un)[:\s]*(\d+(?:[.,]\d+)?)/gi,
    /^(\d+(?:[.,]\d+)?)\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)?$/gm,
    /\b(\d+(?:[.,]\d+)?)\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)\b/gi
  ],

  // Patrones para precios
  price: [
    /(\d+(?:[.,]\d{2}))\s*[€$]/g,
    /[€$]\s*(\d+(?:[.,]\d{2}))/g,
    /precio[:\s]*(\d+(?:[.,]\d{2}))/gi,
    /importe[:\s]*(\d+(?:[.,]\d{2}))/gi,
    /\b(\d+(?:[.,]\d{2}))\s*€/g
  ],

  // Patrones para nombres de productos
  itemName: [
    /(?:descripción|description|producto|article|item)[:\s]*([^0-9\n]{3,50})/gi,
    /^([A-Za-zÀ-ÿ\s]{10,50})(?:\s+\d)/gm
  ],

  // Patrones para totales
  total: [
    /(?:total|subtotal|importe|suma)[:\s]*(\d+(?:[.,]\d{2}))/gi,
    /total[:\s]*(\d+(?:[.,]\d{2}))\s*€/gi,
    /(?:total|subtotal|importe)[:\s]*(\d+(?:[.,]\d{2}))\s*€/gi,
    /\b(\d+(?:[.,]\d{2}))\s*€\s*(?:total|subtotal|importe)/gi
  ],

  // Patrones para proveedores
  supplier: [
    /(?:proveedor|supplier|empresa|company)[:\s]*([^0-9\n]{3,50})/gi,
    /^([A-Za-zÀ-ÿ\s\.]{5,50})(?:\s+[A-Z]{2}\d{8})?/gm
  ],

  // Patrones para fechas
  date: [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g,
    /(?:fecha|date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi
  ],

  // Patrones para números de factura
  invoiceNumber: [
    /(?:factura|invoice|número|number)[:\s]*([A-Z0-9\-_]{3,20})/gi,
    /\b([A-Z]{2,4}\d{6,10})\b/g
  ]
};

// Palabras clave para identificar secciones
const KEYWORDS = {
  items: ['descripción', 'producto', 'artículo', 'código', 'cantidad', 'precio', 'importe'],
  header: ['factura', 'albarán', 'fecha', 'número', 'cliente', 'proveedor'],
  footer: ['total', 'subtotal', 'iva', 'base']
};

// Configuración de umbrales
const THRESHOLDS = {
  minTextLength: 100,
  minItemNameLength: 3,
  maxItemNameLength: 100,
  minPriceThreshold: 0.01,
  maxPriceThreshold: 1000000
};

module.exports = {
  PATTERNS,
  KEYWORDS,
  THRESHOLDS
}; 