const { PATTERNS, KEYWORDS, THRESHOLDS } = require('../config/patterns');
const { 
  convertPDFDataToText, 
  normalizeNumber, 
  cleanText, 
  splitIntoLines 
} = require('../utils/textUtils');

/**
 * Clase base para todos los proveedores de PDF
 * Define la interfaz común que deben implementar todos los proveedores
 */
class BaseProvider {
  constructor() {
    this.name = 'BaseProvider';
    this.supportedFormats = ['native', 'ocr', 'table'];
    this.patterns = PATTERNS;
    this.keywords = KEYWORDS;
    this.thresholds = THRESHOLDS;
  }

  /**
   * Verifica si este proveedor puede manejar el contenido del PDF
   * @param {string} text - Texto extraído del PDF
   * @returns {boolean} True si puede manejar este PDF
   */
  canHandle(text) {
    return false; // Debe ser implementado por cada proveedor
  }

  /**
   * Extrae datos del PDF usando este proveedor
   * @param {string} pdfPath - Ruta del PDF
   * @param {PDFExtractor} extractor - Instancia del extractor principal
   * @returns {Promise<Object>} Datos extraídos
   */
  async extractData(pdfPath, extractor) {
    throw new Error('extractData debe ser implementado por cada proveedor');
  }

  /**
   * Procesa texto extraído y estructura los datos
   * @param {string} text - Texto extraído
   * @returns {Object} Datos estructurados
   */
  processText(text) {
    const lines = splitIntoLines(text);
    
    return {
      supplier: this.extractSupplierInfo(text),
      items: this.extractItems(text),
      totals: this.extractTotals(text),
      metadata: {
        totalLines: lines.length,
        processingDate: new Date(),
        provider: this.name
      }
    };
  }

  /**
   * Extrae información del proveedor del texto
   * @param {string} text - Texto extraído
   * @returns {string|null} Nombre del proveedor
   */
  extractSupplierInfo(text) {
    for (const pattern of this.patterns.supplier) {
      const matches = text.match(pattern);
      if (matches) {
        return cleanText(matches[0]);
      }
    }
    
    return null;
  }

  /**
   * Extrae artículos del texto
   * @param {string} text - Texto extraído
   * @returns {Array} Lista de artículos
   */
  extractItems(text) {
    const lines = splitIntoLines(text);
    const items = [];
    
    lines.forEach((line, index) => {
      if (this.looksLikeItemLine(line)) {
        const item = this.parseItemLine(line, lines, index);
        if (item && item.name && item.name.length >= this.thresholds.minItemNameLength) {
          items.push(item);
        }
      }
    });
    
    return items;
  }

  /**
   * Verifica si una línea parece contener información de producto
   * @param {string} line - Línea de texto
   * @returns {boolean} True si parece ser una línea de producto
   */
  looksLikeItemLine(line) {
    const hasCode = /\b[A-Z0-9\-_]{3,15}\b/.test(line);
    const hasQuantity = /\b[0-9]+(?:[.,][0-9]+)?\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)?\b/.test(line);
    const hasPrice = /[0-9]+(?:[.,][0-9]{2})\s*[€$]/.test(line);
    const hasDescription = /[A-Za-zÀ-ÿ\s]{5,}/.test(line);
    
    return [hasCode, hasQuantity, hasPrice, hasDescription].filter(Boolean).length >= 2;
  }

  /**
   * Parsea una línea de producto
   * @param {string} line - Línea de texto
   * @param {Array} allLines - Todas las líneas
   * @param {number} lineIndex - Índice de la línea
   * @returns {Object} Producto parseado
   */
  parseItemLine(line, allLines, lineIndex) {
    const item = {
      name: null,
      code: null,
      quantity: null,
      price: null,
      total: null,
      lineNumber: lineIndex + 1
    };
    
    // Extraer código
    for (const pattern of this.patterns.itemCode) {
      const match = line.match(pattern);
      if (match && !item.code) {
        item.code = cleanText(match[1] || match[0]);
        break;
      }
    }
    
    // Extraer cantidad
    for (const pattern of this.patterns.quantity) {
      const match = line.match(pattern);
      if (match && !item.quantity) {
        item.quantity = normalizeNumber(match[1] || match[0]);
        break;
      }
    }
    
    // Extraer precio
    for (const pattern of this.patterns.price) {
      const matches = line.match(pattern);
      if (matches && !item.price) {
        const priceStr = matches[0].replace(/[€$]/g, '').trim();
        item.price = normalizeNumber(priceStr);
        break;
      }
    }
    
    // Extraer nombre/descripción
    item.name = this.extractItemName(line, item);
    
    return item;
  }

  /**
   * Extrae el nombre del producto de una línea
   * @param {string} line - Línea de texto
   * @param {Object} item - Item ya parseado
   * @returns {string|null} Nombre del producto
   */
  extractItemName(line, item) {
    let description = line;
    
    // Remover elementos ya extraídos
    if (item.code) {
      description = description.replace(new RegExp(item.code, 'gi'), '');
    }
    if (item.quantity) {
      description = description.replace(new RegExp(item.quantity.toString(), 'g'), '');
    }
    if (item.price) {
      description = description.replace(new RegExp(item.price.toString(), 'g'), '');
    }
    
    // Remover patrones comunes
    description = description.replace(/\b[A-Z0-9\-_]{3,20}\b/g, '');
    description = description.replace(/\b[0-9]+(?:[.,][0-9]+)?\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)?\b/g, '');
    description = description.replace(/[0-9]+(?:[.,]\d{2})\s*[€$]/g, '');
    description = description.replace(/[€$]/g, '');
    description = description.replace(/^\s*[-_*]\s*/g, '');
    description = cleanText(description);
    
    return description.length >= this.thresholds.minItemNameLength ? description : null;
  }

  /**
   * Extrae totales del texto
   * @param {string} text - Texto extraído
   * @returns {Object} Totales extraídos
   */
  extractTotals(text) {
    const totals = {};
    
    for (const pattern of this.patterns.total) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const value = normalizeNumber(match.replace(/[^0-9.,]/g, ''));
          if (!isNaN(value) && value >= this.thresholds.minPriceThreshold) {
            if (match.toLowerCase().includes('subtotal')) {
              totals.subtotal = value;
            } else if (match.toLowerCase().includes('total')) {
              totals.total = value;
            } else if (match.toLowerCase().includes('importe')) {
              totals.importe = value;
            }
          }
        });
      }
    }
    
    return totals;
  }

  /**
   * Parsea datos de tabla específicos del proveedor
   * @param {Array} tableRows - Filas de la tabla
   * @returns {Object} Productos y totales extraídos
   */
  parseTableData(tableRows) {
    return { productos: [], totalSinIVA: null };
  }
}

module.exports = BaseProvider; 