const fs = require('fs');
const PDFParser = require('pdf2json');
const Tesseract = require('tesseract.js');
const pdfreader = require('pdfreader');
const path = require('path');
const { convertPDFDataToText } = require('./utils/textUtils');

// Importar proveedores
const ACLProvider = require('./providers/ACLProvider');
const GenericProvider = require('./providers/GenericProvider');
const GestinlibProvider = require('./providers/GestinlibProvider');

/**
 * Clase principal para extracción de datos de PDFs
 * Optimizada para múltiples proveedores con arquitectura modular
 */
class PDFExtractor {
  constructor() {
    this.providers = new Map();
    this.textExtractors = new Map();
    
    this._initializeProviders();
    this._initializeTextExtractors();
  }

  /**
   * Inicializa los proveedores disponibles
   */
  _initializeProviders() {
    this.providers.set('ACL', new ACLProvider());
    this.providers.set('GENERIC', new GenericProvider());
    this.providers.set('GESTINLIB', new GestinlibProvider());
  }

  /**
   * Inicializa los extractores de texto
   */
  _initializeTextExtractors() {
    this.textExtractors.set('native', this.extractTextFromPDF.bind(this));
    this.textExtractors.set('ocr', this.extractTextWithOCR.bind(this));
    this.textExtractors.set('table', this.extractTableDataFromPDF.bind(this));
  }

  /**
   * Obtiene el proveedor apropiado para el PDF
   * @param {string} supplierName - Nombre del proveedor
   * @returns {Object} Instancia del proveedor
   */
  getProvider(supplierName) {
    const provider = this.providers.get(supplierName.toUpperCase());
    if (!provider) {
      console.warn(`Proveedor ${supplierName} no encontrado, usando genérico`);
      return this.providers.get('GENERIC');
    }
    return provider;
  }

  /**
   * Detecta automáticamente el proveedor basado en el contenido del PDF
   * @param {string} pdfPath - Ruta del PDF
   * @returns {Promise<string>} Nombre del proveedor detectado
   */
  async detectProvider(pdfPath) {
    try {
      const extractedText = await this.extractTextFromPDF(pdfPath);
      const text = this._convertPDFDataToText(extractedText);
      
      for (const [providerName, provider] of this.providers) {
        if (provider.canHandle(text)) {
          console.log(`Proveedor detectado: ${providerName}`);
          return providerName;
        }
      }
      
      return 'GENERIC';
    } catch (error) {
      console.warn('Error detectando proveedor:', error);
      return 'GENERIC';
    }
  }

  /**
   * Método principal para extraer datos de factura
   * @param {string} pdfPath - Ruta del PDF
   * @param {string} supplierName - Nombre del proveedor (opcional, se auto-detecta si no se proporciona)
   * @returns {Promise<Object>} Datos extraídos estructurados
   */
  async extractInvoiceData(pdfPath, supplierName = null) {
    try {
      console.log('Iniciando extracción de:', pdfPath);
      
      // Detectar proveedor si no se especifica
      if (!supplierName) {
        supplierName = await this.detectProvider(pdfPath);
      }
      
      const provider = this.getProvider(supplierName);
      
      // Extraer datos usando el proveedor específico
      const result = await provider.extractData(pdfPath, this);
      
      return {
        ...result,
        supplier: supplierName,
        timestamp: new Date(),
        pdfPath
      };
      
    } catch (error) {
      console.error('Error en extracción:', error);
      throw new Error(`Error extrayendo datos del PDF: ${error.message}`);
    }
  }

  /**
   * Extrae texto nativo del PDF
   * @param {string} pdfPath - Ruta del PDF
   * @returns {Promise<Object>} Datos del PDF
   */
  async extractTextFromPDF(pdfPath) {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on("pdfParser_dataError", err => reject(err.parserError));
      pdfParser.on("pdfParser_dataReady", pdfData => {
        if (!pdfData) {
          return reject(new Error('El PDF no tiene el formato esperado'));
        }
        resolve(pdfData);
      });

      pdfParser.loadPDF(pdfPath);
    });
  }

  /**
   * Extrae texto usando OCR
   * @param {string} pdfPath - Ruta del PDF
   * @returns {Promise<string>} Texto extraído
   */
  async extractTextWithOCR(pdfPath) {
    try {
      const { data: { text } } = await Tesseract.recognize(pdfPath, 'spa', {
        logger: m => console.log(m)
      });
      return text;
    } catch (error) {
      console.error('Error en OCR:', error);
      throw error;
    }
  }

  /**
   * Extrae datos de tabla usando pdfreader
   * @param {string} pdfPath - Ruta del PDF
   * @returns {Promise<Array>} Datos de tabla
   */
  async extractTableDataFromPDF(pdfPath) {
    return new Promise((resolve, reject) => {
      const rows = {};
      
      new pdfreader.PdfReader().parseFileItems(pdfPath, function(err, item) {
        if (err) {
          reject(err);
        } else if (!item) {
          // Fin del archivo
          const table = Object.keys(rows)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(y => rows[y]);
          resolve(table);
        } else if (item.text) {
          // Agrupar por posición vertical (y)
          (rows[item.y] = rows[item.y] || []).push(item.text);
        }
      });
    });
  }

  /**
   * Convierte datos del PDF a texto plano
   * @param {Object} pdfData - Datos del PDF
   * @returns {string} Texto plano
   */
  _convertPDFDataToText(pdfData) {
    return convertPDFDataToText(pdfData);
  }

  /**
   * Compara dos documentos
   * @param {Object} doc1Data - Datos del primer documento
   * @param {Object} doc2Data - Datos del segundo documento
   * @returns {Object} Comparación estructurada
   */
  compareDocuments(doc1Data, doc2Data) {
    const comparison = {
      itemsComparison: [],
      totalsComparison: {},
      summary: {
        commonItems: 0,
        uniqueToDoc1: 0,
        uniqueToDoc2: 0,
        priceDifferences: []
      }
    };
    
    const items1 = doc1Data.processedData?.items || [];
    const items2 = doc2Data.processedData?.items || [];
    
    // Comparar artículos
    items1.forEach(item1 => {
      const matchingItem = items2.find(item2 => 
        item2.code === item1.code || 
        (item2.name && item1.name && item2.name.toLowerCase().includes(item1.name.toLowerCase()))
      );
      
      if (matchingItem) {
        comparison.summary.commonItems++;
        const itemComparison = {
          item: item1.name || item1.code,
          doc1: item1,
          doc2: matchingItem,
          differences: []
        };
        
        if (item1.price !== matchingItem.price) {
          itemComparison.differences.push('price');
          comparison.summary.priceDifferences.push({
            item: item1.name || item1.code,
            doc1Price: item1.price,
            doc2Price: matchingItem.price,
            difference: matchingItem.price - item1.price
          });
        }
        
        if (item1.quantity !== matchingItem.quantity) {
          itemComparison.differences.push('quantity');
        }
        
        comparison.itemsComparison.push(itemComparison);
      } else {
        comparison.summary.uniqueToDoc1++;
        comparison.itemsComparison.push({
          item: item1.name || item1.code,
          doc1: item1,
          doc2: null,
          differences: ['not_in_doc2']
        });
      }
    });
    
    // Artículos únicos en doc2
    items2.forEach(item2 => {
      const hasMatch = items1.some(item1 => 
        item1.code === item2.code || 
        (item1.name && item2.name && item1.name.toLowerCase().includes(item2.name.toLowerCase()))
      );
      
      if (!hasMatch) {
        comparison.summary.uniqueToDoc2++;
        comparison.itemsComparison.push({
          item: item2.name || item2.code,
          doc1: null,
          doc2: item2,
          differences: ['not_in_doc1']
        });
      }
    });
    
    // Comparar totales
    const totals1 = doc1Data.processedData?.totals || {};
    const totals2 = doc2Data.processedData?.totals || {};
    
    comparison.totalsComparison = {
      total: {
        doc1: totals1.total || 0,
        doc2: totals2.total || 0,
        difference: (totals2.total || 0) - (totals1.total || 0)
      },
      subtotal: {
        doc1: totals1.subtotal || 0,
        doc2: totals2.subtotal || 0,
        difference: (totals2.subtotal || 0) - (totals1.subtotal || 0)
      }
    };
    
    return comparison;
  }

  /**
   * Registra un nuevo proveedor
   * @param {string} name - Nombre del proveedor
   * @param {Object} provider - Instancia del proveedor
   */
  registerProvider(name, provider) {
    this.providers.set(name.toUpperCase(), provider);
    console.log(`Proveedor ${name} registrado`);
  }

  /**
   * Obtiene lista de proveedores disponibles
   * @returns {Array} Lista de nombres de proveedores
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }
}

module.exports = PDFExtractor;