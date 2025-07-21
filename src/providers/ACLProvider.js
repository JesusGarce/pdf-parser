const BaseProvider = require('./BaseProvider');
const { convertPDFDataToText } = require('../utils/textUtils');

/**
 * Proveedor específico para ACL
 * Maneja la extracción de datos de facturas de ACL
 */
class ACLProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'ACL';
    this.keywords = ['ACL', 'Arco Logística', 'ArcoLogística'];
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
      // Intentar extracción de tabla primero (método preferido para ACL)
      let tableData = [];
      let parsedTableResult = { productos: [], totalSinIVA: null };
      
      try {
        tableData = await extractor.extractTableDataFromPDF(pdfPath);
        console.log('Tabla extraída con pdfreader:', tableData);
        parsedTableResult = this.parseTableData(tableData);
        console.log('Productos parseados de tabla:', parsedTableResult);
      } catch (err) {
        console.warn('No se pudo extraer tabla con pdfreader:', err);
      }

      // Si se extrajeron productos de la tabla, devolvemos esos
      if (parsedTableResult && parsedTableResult.productos && parsedTableResult.productos.length > 0) {
        return {
          rawText: '',
          processedData: {
            supplier: this.name,
            items: parsedTableResult.productos,
            totals: { total: parsedTableResult.totalSinIVA },
            metadata: {
              totalLines: tableData.length,
              processingDate: new Date(),
              provider: this.name
            }
          },
          tableData: tableData,
          extractionMethod: 'table',
          timestamp: new Date()
        };
      }

      // Si no hay productos en la tabla, usar extracción de texto
      let extractedObj = await extractor.extractTextFromPDF(pdfPath);
      let extractedText = this._convertPDFDataToText(extractedObj);
      
      if (!extractedText || extractedText.length < 100) {
        console.log('Texto insuficiente, usando OCR...');
        extractedText = await extractor.extractTextWithOCR(pdfPath);
      }

      if (!extractedText) {
        throw new Error('No se pudo extraer texto del PDF');
      }

      const structuredData = this.processText(extractedText);
      
      return {
        rawText: extractedText,
        processedData: structuredData,
        tableData: tableData,
        extractionMethod: extractedText.length > 100 ? 'native' : 'ocr',
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Error en extracción ACL:', error);
      throw error;
    }
  }

  /**
   * Parsea datos de tabla específicos de ACL
   * @param {Array} tableRows - Filas de la tabla
   * @returns {Object} Productos y totales extraídos
   */
  parseTableData(tableRows) {
    const productos = [];
    let totalSinIVA = null;

    // Buscar total sin IVA: fila con un solo valor decimal grande (ej: 181,10)
    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i];
      if (row && row.length === 1) {
        const val = row[0].replace(/\s|\*/g, '');
        if (/^\d{2,3}[.,]\d{2}$/.test(val)) {
          const num = parseFloat(val.replace(',', '.'));
          if (num > 50) { // umbral para evitar totales pequeños
            totalSinIVA = num;
            break;
          }
        }
      }
    }

    // Parseo de productos
    for (let i = 0; i < tableRows.length - 1; i++) {
      const row = tableRows[i];
      if (row && row.length >= 3 && typeof row[0] === 'string' && /[a-zA-Z]/.test(row[0])) {
        const titulo = row[0].trim();
        let cantidad = NaN;
        
        // Buscar cantidad en la fila anterior
        if (i > 0 && tableRows[i - 1] && tableRows[i - 1].length >= 2) {
          const prevRow = tableRows[i - 1];
          let numCount = 0;
          let hasDecimal = false;
          
          for (let j = 0; j < prevRow.length; j++) {
            const val = prevRow[j].replace(/\s/g, '');
            if (/^\d+$/.test(val)) numCount++;
            if (/^\d+[.,]\d+$/.test(val)) hasDecimal = true;
          }
          
          if (numCount >= 2 && hasDecimal) {
            for (let j = 0; j < prevRow.length; j++) {
              const val = prevRow[j].replace(/\s/g, '');
              if (/^\d+$/.test(val)) {
                cantidad = parseInt(val);
                break;
              }
            }
          }
        }

        const precio = parseFloat(row[2].replace(',', '.').replace(/[^\d.]/g, ''));
        let codigo = null;

        // Buscar código en las siguientes filas
        for (let k = 1; k <= 3; k++) {
          const nextRow = tableRows[i + k];
          if (nextRow && nextRow.length >= 2 && /\d{9,13}/.test(nextRow[1])) {
            codigo = nextRow[1].trim();
            break;
          }
        }

        if (codigo) {
          productos.push({ codigo, titulo, cantidad, precio });
        }
      }
    }

    return { productos, totalSinIVA };
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

module.exports = ACLProvider; 