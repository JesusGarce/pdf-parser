const BaseProvider = require('./BaseProvider');
const { convertPDFDataToText } = require('../utils/textUtils');

/**
 * Proveedor genérico para PDFs de cualquier proveedor
 * Usa métodos generales de extracción de texto
 */
class GenericProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'GENERIC';
    this.keywords = []; // No tiene palabras clave específicas
  }

  /**
   * Verifica si este proveedor puede manejar el contenido del PDF
   * @param {string} text - Texto extraído del PDF
   * @returns {boolean} True si puede manejar este PDF (siempre true para genérico)
   */
  canHandle(text) {
    return true; // El proveedor genérico puede manejar cualquier PDF
  }

  /**
   * Extrae datos del PDF usando este proveedor
   * @param {string} pdfPath - Ruta del PDF
   * @param {PDFExtractor} extractor - Instancia del extractor principal
   * @returns {Promise<Object>} Datos extraídos
   */
  async extractData(pdfPath, extractor) {
    try {
      // Intentar extracción de texto nativo primero
      let extractedObj = await extractor.extractTextFromPDF(pdfPath);
      let extractedText = this._convertPDFDataToText(extractedObj);
      
      // Si el texto es insuficiente, usar OCR
      if (!extractedText || extractedText.length < 100) {
        console.log('Texto insuficiente, usando OCR...');
        extractedText = await extractor.extractTextWithOCR(pdfPath);
      }

      if (!extractedText) {
        throw new Error('No se pudo extraer texto del PDF');
      }

      console.log('Texto extraído, longitud:', extractedText.length);
      
      // Procesar y estructurar los datos
      const structuredData = this.processText(extractedText);
      
      return {
        rawText: extractedText,
        processedData: structuredData,
        tableData: [],
        extractionMethod: extractedText.length > 100 ? 'native' : 'ocr',
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Error en extracción genérica:', error);
      throw error;
    }
  }

  /**
   * Procesa texto extraído con métodos mejorados para proveedores genéricos
   * @param {string} text - Texto extraído
   * @returns {Object} Datos estructurados
   */
  processText(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    return {
      supplier: this.extractSupplierInfo(text),
      items: this.extractItemsImproved(text, lines),
      totals: this.extractTotalsImproved(text),
      metadata: {
        totalLines: lines.length,
        processingDate: new Date(),
        provider: this.name
      }
    };
  }

  /**
   * Extrae artículos con métodos mejorados
   * @param {string} text - Texto extraído
   * @param {Array} lines - Líneas del texto
   * @returns {Array} Lista de artículos
   */
  extractItemsImproved(text, lines) {
    const items = [];
    
    // Buscar líneas que contengan información de productos
    lines.forEach((line, index) => {
      if (this.looksLikeItemLineImproved(line)) {
        const item = this.parseItemLineImproved(line, lines, index);
        if (item && item.name) {
          items.push(item);
        }
      }
    });
    
    return items;
  }

  /**
   * Verifica si una línea parece contener información de producto (versión mejorada)
   * @param {string} line - Línea de texto
   * @returns {boolean} True si parece ser una línea de producto
   */
  looksLikeItemLineImproved(line) {
    // Patrones más flexibles para proveedores genéricos
    const hasCode = /\b[A-Z0-9\-_]{3,20}\b/.test(line);
    const hasQuantity = /\b[0-9]+(?:[.,][0-9]+)?\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)?\b/.test(line);
    const hasPrice = /[0-9]+(?:[.,][0-9]{2})\s*[€$]/.test(line);
    const hasDescription = /[A-Za-zÀ-ÿ\s]{8,}/.test(line);
    const hasNumber = /\d+/.test(line);
    
    // Una línea de producto debe tener al menos 2 elementos y un número
    const elementCount = [hasCode, hasQuantity, hasPrice, hasDescription].filter(Boolean).length;
    return elementCount >= 2 && hasNumber;
  }

  /**
   * Parsea una línea de producto (versión mejorada)
   * @param {string} line - Línea de texto
   * @param {Array} allLines - Todas las líneas
   * @param {number} lineIndex - Índice de la línea
   * @returns {Object} Producto parseado
   */
  parseItemLineImproved(line, allLines, lineIndex) {
    const item = {
      name: null,
      code: null,
      quantity: null,
      price: null,
      total: null,
      lineNumber: lineIndex + 1
    };
    
    // Patrones mejorados para proveedores genéricos
    const patterns = {
      itemCode: [
        /(?:código|code|cod|ref|referencia|sku|art|artículo)[:\s]*([A-Z0-9\-_]{3,20})/gi,
        /\b([A-Z]{2,4}[-_]??\d{3,8})\b/g,
        /\b(\d{6,13})\b/g,
        /\b([A-Z0-9]{4,12})\b/g
      ],
      quantity: [
        /(?:cantidad|cant|qty|unidades|ud|pcs|un)[:\s]*(\d+(?:[.,]\d+)?)/gi,
        /^(\d+(?:[.,]\d+)?)\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)?$/gm,
        /\b(\d+(?:[.,]\d+)?)\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)\b/gi
      ],
      price: [
        /(\d+(?:[.,]\d{2}))\s*[€$]/g,
        /[€$]\s*(\d+(?:[.,]\d{2}))/g,
        /precio[:\s]*(\d+(?:[.,]\d{2}))/gi,
        /importe[:\s]*(\d+(?:[.,]\d{2}))/gi,
        /\b(\d+(?:[.,]\d{2}))\s*€/g
      ]
    };
    
    // Extraer código
    for (const pattern of patterns.itemCode) {
      const match = line.match(pattern);
      if (match && !item.code) {
        item.code = match[1] || match[0].trim();
        break;
      }
    }
    
    // Extraer cantidad
    for (const pattern of patterns.quantity) {
      const match = line.match(pattern);
      if (match && !item.quantity) {
        item.quantity = parseFloat(match[1] || match[0].replace(',', '.'));
        break;
      }
    }
    
    // Extraer precio
    for (const pattern of patterns.price) {
      const matches = line.match(pattern);
      if (matches && !item.price) {
        const priceStr = matches[0].replace(/[€$]/g, '').trim();
        item.price = parseFloat(priceStr.replace(',', '.'));
        break;
      }
    }
    
    // Extraer nombre/descripción (método mejorado)
    item.name = this.extractItemName(line, item);
    
    return item;
  }

  /**
   * Extrae el nombre del producto de una línea
   * @param {string} line - Línea de texto
   * @param {Object} item - Item ya parseado
   * @returns {string} Nombre del producto
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
    description = description.trim();
    
    return description.length > 3 ? description : null;
  }

  /**
   * Extrae totales con métodos mejorados
   * @param {string} text - Texto extraído
   * @returns {Object} Totales extraídos
   */
  extractTotalsImproved(text) {
    const totals = {};
    const patterns = [
      /(?:total|subtotal|importe|suma)[:\s]*(\d+(?:[.,]\d{2}))/gi,
      /total[:\s]*(\d+(?:[.,]\d{2}))\s*€/gi,
      /(?:total|subtotal|importe)[:\s]*(\d+(?:[.,]\d{2}))\s*€/gi,
      /\b(\d+(?:[.,]\d{2}))\s*€\s*(?:total|subtotal|importe)/gi
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const value = parseFloat(match.replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(value)) {
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
   * Convierte datos del PDF a texto plano
   * @param {Object} pdfData - Datos del PDF
   * @returns {string} Texto plano
   */
  _convertPDFDataToText(pdfData) {
    return convertPDFDataToText(pdfData);
  }
}

module.exports = GenericProvider; 