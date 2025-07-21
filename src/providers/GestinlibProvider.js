const BaseProvider = require('./BaseProvider');
const { convertPDFDataToText } = require('../utils/textUtils');
const Tesseract = require('tesseract.js');
const PDFImageExtractor = require('../utils/pdfImageExtractor');
const fs = require('fs');

/**
 * Proveedor específico para Gestinlib
 * Maneja la extracción de datos de facturas de Gestinlib con códigos EAN en imágenes
 */
class GestinlibProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'GESTINLIB';
    this.keywords = ['Gestinlib', 'GESTINLIB', 'gestinlib'];
    this.imageExtractor = null; // Instancia única del extractor de imágenes
  }

  /**
   * Obtiene la instancia del extractor de imágenes (singleton)
   * @returns {PDFImageExtractor} Instancia del extractor
   */
  getImageExtractor() {
    if (!this.imageExtractor) {
      this.imageExtractor = new PDFImageExtractor();
    }
    return this.imageExtractor;
  }

  /**
   * Verifica si este proveedor puede manejar el contenido del PDF
   * @param {string} text - Texto extraído del PDF
   * @returns {boolean} True si puede manejar este PDF
   */
  canHandle(text) {
    return this.keywords.some(keyword => 
      text.toUpperCase().includes(keyword.toUpperCase())
    );
  }

  /**
   * Extrae datos del PDF usando este proveedor
   * @param {string} pdfPath - Ruta del PDF
   * @param {PDFExtractor} extractor - Instancia del extractor principal
   * @returns {Promise<Object>} Datos extraídos
   */
  async extractData(pdfPath, extractor) {
    try {
      console.log('Iniciando extracción Gestinlib:', pdfPath);
      
      // Extraer tabla con pdfreader
      let tableData = [];
      try {
        tableData = await extractor.extractTableDataFromPDF(pdfPath);
        console.log('Tabla extraída con pdfreader:', tableData);
      } catch (err) {
        console.warn('No se pudo extraer tabla con pdfreader:', err);
        throw new Error('No se pudo extraer tabla del PDF de Gestinlib');
      }

      // Extraer texto nativo para información adicional
      let extractedObj = await extractor.extractTextFromPDF(pdfPath);
      let extractedText = this._convertPDFDataToText(extractedObj);

      // Procesar tabla con códigos EAN
      const parsedTableResult = await this.parseTableDataWithEAN(tableData, pdfPath);
      console.log('Productos parseados con códigos EAN:', parsedTableResult);

      return {
        rawText: extractedText,
        processedData: {
          supplier: this.name,
          items: parsedTableResult.productos,
          totals: { total: parsedTableResult.totalSinIVA },
          metadata: {
            totalLines: tableData.length,
            processingDate: new Date(),
            provider: this.name,
            eanCodesFound: parsedTableResult.eanCodesFound
          }
        },
        tableData: tableData,
        extractionMethod: 'table_with_ean_ocr',
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Error en extracción Gestinlib:', error);
      throw error;
    }
  }

  /**
   * Parsea datos de tabla con extracción de códigos EAN desde imágenes
   * @param {Array} tableRows - Filas de la tabla
   * @param {string} pdfPath - Ruta del PDF para extraer imágenes
   * @returns {Promise<Object>} Productos y totales extraídos con códigos EAN
   */
  async parseTableDataWithEAN(tableRows, pdfPath) {
    const productos = [];
    let totalSinIVA = null;
    let eanCodesFound = 0;

    // Buscar base imponible (total sin IVA) de la tabla
    let baseImponible = null;
    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i].map(cell => cell.toString().toLowerCase());
      if (row.includes('base imponible')) {
        // La siguiente fila contiene los importes
        const nextRow = tableRows[i + 1];
        if (nextRow && nextRow.length > 0) {
          // Extraer el primer valor numérico de la fila (base imponible)
          const match = nextRow[0].replace(/[^\d.,]/g, '').replace(',', '.');
          const num = parseFloat(match);
          if (!isNaN(num)) {
            baseImponible = num;
          }
        }
        break;
      }
    }
    if (baseImponible !== null) {
      totalSinIVA = baseImponible;
    }

    // Buscar sección de productos (formato: [TITULO, CANTIDAD, PRECIO])
    let productSectionStart = -1;
    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i];
      if (row && row.length >= 3) {
        const firstCol = row[0]?.toString().toLowerCase() || '';
        const secondCol = row[1]?.toString().toLowerCase() || '';
        const thirdCol = row[2]?.toString().toLowerCase() || '';
        
        // Detectar inicio de productos (títulos de libros, no headers)
        if (firstCol.length > 10 && 
            !firstCol.includes('código') && 
            !firstCol.includes('concepto') &&
            !firstCol.includes('cantida') &&
            !firstCol.includes('precio') &&
            !firstCol.includes('observaciones') &&
            !firstCol.includes('base imponible') &&
            secondCol.match(/^\d+$/) && // Cantidad es número
            thirdCol.includes('€')) { // Precio tiene símbolo euro
          productSectionStart = i;
          break;
        }
      }
    }

    if (productSectionStart === -1) {
      console.warn('No se encontró sección de productos en Gestinlib');
      return { productos, totalSinIVA, eanCodesFound };
    }

    // Extraer productos
    for (let i = productSectionStart; i < tableRows.length; i++) {
      const row = tableRows[i];
      
      // Verificar si es una fila de producto válida
      if (this.isProductRow(row)) {
        const titulo = row[0].trim();
        const cantidad = parseInt(row[1]) || 1;
        const precio = parseFloat(row[2].replace(',', '.').replace(/[^\d.]/g, '')) || 0;

        // Buscar código EAN en la imagen correspondiente
        let codigo = null;
        try {
          codigo = await this.extractEANFromImage(pdfPath, i);
          if (codigo) {
            eanCodesFound++;
          }
        } catch (err) {
          console.warn(`Error extrayendo EAN para producto ${i}:`, err);
        }

        if (titulo && precio > 0) {
          productos.push({ 
            codigo: codigo || `GESTINLIB_${i}`, 
            titulo, 
            cantidad, 
            precio 
          });
        }
      }
    }

    return { productos, totalSinIVA, eanCodesFound };
  }

  /**
   * Verifica si una fila contiene datos de producto
   * @param {Array} row - Fila de la tabla
   * @returns {boolean} True si es una fila de producto
   */
  isProductRow(row) {
    if (!row || row.length < 3) return false;
    
    const titulo = row[0]?.toString() || '';
    const cantidad = row[1]?.toString() || '';
    const precio = row[2]?.toString() || '';
    
    // Verificar que sea un producto válido
    return titulo.length > 5 && 
           /^\d+$/.test(cantidad) && 
           precio.includes('€') &&
           !titulo.toLowerCase().includes('observaciones') &&
           !titulo.toLowerCase().includes('base imponible') &&
           !titulo.toLowerCase().includes('total');
  }

  /**
   * Extrae código EAN desde una imagen en el PDF
   * @param {string} pdfPath - Ruta del PDF
   * @param {number} rowIndex - Índice de la fila
   * @returns {Promise<string|null>} Código EAN extraído
   */
  async extractEANFromImage(pdfPath, rowIndex) {
    try {
      // Extraer imagen de la celda correspondiente al código EAN
      const imagePath = await this.extractImageFromPDFCell(pdfPath, rowIndex);
      console.log('Imagen extraída:', imagePath);
      if (!imagePath) {
        return null;
      }

      // Usar OCR para extraer el código EAN
      const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
        logger: m => console.log(`OCR EAN ${rowIndex}:`, m)
      });

      // Limpiar y validar el código EAN
      const eanCode = this.extractEANFromText(text);
      
      // En modo debug, mantener las imágenes para inspección
      console.log(`🔍 Imagen mantenida para debug: ${imagePath}`);
      // Para limpiar manualmente: fs.unlinkSync(imagePath);

      return eanCode;
    } catch (error) {
      console.warn(`Error extrayendo EAN para fila ${rowIndex}:`, error);
      return null;
    }
  }

  /**
   * Extrae imagen de una celda específica del PDF
   * @param {string} pdfPath - Ruta del PDF
   * @param {number} rowIndex - Índice de la fila
   * @returns {Promise<string|null>} Ruta de la imagen extraída
   */
  async extractImageFromPDFCell(pdfPath, rowIndex) {
    try {
      console.log(`Intentando extraer imagen para fila ${rowIndex}`);
      
      // Crear instancia del extractor de imágenes
      const imageExtractor = this.getImageExtractor();
      
      // Definir límites aproximados de la tabla (esto se podría mejorar con detección automática)
      const tableBounds = {
        x: 50,
        y: 200,
        width: 500,
        height: 600
      };
      
      // Extraer imagen de la celda del código EAN (asumiendo que está en la columna 0)
      const imagePath = await imageExtractor.extractImageFromTableCell(
        pdfPath, 
        rowIndex, 
        0, // Columna del código EAN
        tableBounds
      );
      
      return imagePath;
    } catch (error) {
      console.warn(`Error extrayendo imagen para fila ${rowIndex}:`, error);
      return null;
    }
  }

  /**
   * Extrae código EAN del texto OCR
   * @param {string} text - Texto extraído por OCR
   * @returns {string|null} Código EAN válido
   */
  extractEANFromText(text) {
    // Patrones para códigos EAN (13 dígitos)
    const eanPatterns = [
      /\b(\d{13})\b/g,
      /\b(\d{8})\b/g, // EAN-8
      /\b(\d{12})\b/g, // EAN-12
    ];

    for (const pattern of eanPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (this.isValidEAN(match)) {
            return match;
          }
        }
      }
    }

    return null;
  }

  /**
   * Valida un código EAN usando el algoritmo de checksum
   * @param {string} ean - Código EAN a validar
   * @returns {boolean} True si es un EAN válido
   */
  isValidEAN(ean) {
    if (!ean || ean.length < 8 || ean.length > 13) {
      return false;
    }

    // Algoritmo de validación EAN
    const digits = ean.split('').map(Number);
    const checkDigit = digits.pop();
    
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    
    const calculatedCheck = (10 - (sum % 10)) % 10;
    return calculatedCheck === checkDigit;
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

module.exports = GestinlibProvider; 