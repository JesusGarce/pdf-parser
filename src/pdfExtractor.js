const fs = require('fs');
const PDFParser = require('pdf2json');
const Tesseract = require('tesseract.js');
const { createCanvas, loadImage } = require('canvas');
const pdfreader = require('pdfreader');




class PDFExtractor {
  // Parsear productos desde la tabla extraída por pdfreader para ACL
  parseTableItemsFromRowsACL(tableRows) {
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
    // Parseo de productos (igual que antes)
    for (let i = 0; i < tableRows.length - 1; i++) {
      const row = tableRows[i];
      if (row && row.length >= 3 && typeof row[0] === 'string' && /[a-zA-Z]/.test(row[0])) {
        const titulo = row[0].trim();
        let cantidad = NaN;
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
    // Devolver productos y total sin IVA si se pide
    return { productos, totalSinIVA };
  }

  // Método general para parsear productos de tabla según proveedor
  parseTableItemsFromRows(tableRows, proveedor) {
    if (proveedor === 'ACL') {
      return this.parseTableItemsFromRowsACL(tableRows);
    }
    // Aquí puedes añadir más proveedores en el futuro
    // Por defecto, retorna vacío
    return { productos: [], totalSinIVA: null };
  }
  constructor() {
    this.patterns = {
      itemCode: [
        /(?:código|code|cod|ref|referencia|sku|art)[:\s]*([A-Z0-9\-_]{3,20})/gi,
        /\b([A-Z]{2,4}[-_]??\d{3,8})\b/g,
        /\b(\d{6,13})\b/g
      ],
      quantity: [
        /(?:cantidad|cant|qty|unidades|ud|pcs)[:\s]*(\d+(?:[.,]\d+)?)/gi,
        /^(\d+(?:[.,]\d+)?)\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)?$/gm
      ],
      price: [
        /(\d+(?:[.,]\d{2}))\s*[€$]/g,
        /[€$]\s*(\d+(?:[.,]\d{2}))/g,
        /precio[:\s]*(\d+(?:[.,]\d{2}))/gi,
        /importe[:\s]*(\d+(?:[.,]\d{2}))/gi
      ],
      itemName: [
        /(?:descripción|description|producto|article|item)[:\s]*([^0-9\n]{3,50})/gi,
        /^([A-Za-zÀ-ÿ\s]{10,50})(?:\s+\d)/gm
      ],
      total: [
        /(?:total|subtotal|importe)[:\s]*(\d+(?:[.,]\d{2}))/gi,
        /total[:\s]*(\d+(?:[.,]\d{2}))\s*€/gi
      ],
      supplier: [
        /(?:proveedor|supplier|empresa|company)[:\s]*([^0-9\n]{3,50})/gi,
        /^([A-Za-zÀ-ÿ\s\.]{5,50})(?:\s+[A-Z]{2}\d{8})?/gm
      ]
    };

    this.sectionKeywords = {
      items: ['descripción', 'producto', 'artículo', 'código', 'cantidad', 'precio', 'importe'],
      header: ['factura', 'albarán', 'fecha', 'número', 'cliente', 'proveedor'],
      footer: ['total', 'subtotal', 'iva', 'base']
    };
  }

  // Extraer datos de tablas usando pdfreader
  async extractTableDataFromPDF(pdfPath) {
    return new Promise((resolve, reject) => {
      const rows = {};
      new pdfreader.PdfReader().parseFileItems(pdfPath, function(err, item) {
        if (err) {
          reject(err);
        } else if (!item) {
          // Fin del archivo
          // Convertir rows a array de arrays (tabla)
          const table = Object.keys(rows)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(y => rows[y]);
            console.log('Tabla extraída:', table);
          resolve(table);
        } else if (item.text) {
          // Agrupar por posición vertical (y)
          (rows[item.y] = rows[item.y] || []).push(item.text);
        }
      });
    });
  }

  // Método principal para extraer datos de factura
  async extractInvoiceData(pdfPath, proveedor = 'ACL') {
    try {
      console.log('Iniciando extracción de:', pdfPath);
      
      // Primero intentar extracción de texto nativo
      let extractedObj = await this.extractTextFromPDF(pdfPath);
      // Convertir Pages[].Texts a texto plano
      let extractedText = '';
      if (extractedObj && extractedObj.Pages && Array.isArray(extractedObj.Pages)) {
        extractedText = extractedObj.Pages.map(page =>
          page.Texts.map(t => decodeURIComponent(t.R.map(r => r.T).join(' || '))).join(' | ')
        ).join('\n');
      }
      console.log('Texto extraído plano:', extractedText);

      // Extraer tabla con pdfreader (opcional, ejemplo de uso)
      let tableData = [];
      let parsedTableResult = { productos: [], totalSinIVA: null };
      try {
        tableData = await this.extractTableDataFromPDF(pdfPath);
        console.log('Tabla extraída con pdfreader:', tableData);
        parsedTableResult = this.parseTableItemsFromRows(tableData, proveedor);
        console.log('Productos parseados de tabla:', parsedTableResult);
      } catch (err) {
        console.warn('No se pudo extraer tabla con pdfreader:', err);
      }
      // Si se extrajeron productos de la tabla, devolvemos esos y no usamos OCR ni el parser de texto
      if (parsedTableResult && parsedTableResult.productos && parsedTableResult.productos.length > 0) {
        return {
          rawText: extractedText,
          processedData: {
            supplier: proveedor,
            items: parsedTableResult.productos,
            totals: { total: parsedTableResult.totalSinIVA },
            metadata: {
              totalLines: tableData.length,
              processingDate: new Date()
            }
          },
          tableData: tableData,
          parsedTableItems: parsedTableResult.productos,
          extractionMethod: 'table',
          timestamp: new Date()
        };
      }
      // Si no hay productos en la tabla, seguir con el flujo normal
      if (!extractedText || extractedText.length < 100) {
        console.log('Texto insuficiente, usando OCR...');
        extractedText = await this.extractTextWithOCR(pdfPath);
      }
      if (!extractedText) {
        throw new Error('No se pudo extraer texto del PDF');
      }
      console.log('Texto extraído, longitud:', extractedText.length);
      // Procesar y estructurar los datos
      const structuredData = this.processExtractedText(extractedText);
      return {
        rawText: extractedText,
        processedData: structuredData,
        tableData: tableData,
        parsedTableItems: parsedTableItems,
        extractionMethod: extractedText.length > 100 ? 'native' : 'ocr',
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('Error en extracción:', error);
      throw error;
    }
  }

  // Extraer texto nativo del PDF
  async extractTextFromPDF(pdfPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        pdfParser.on("pdfParser_dataError", err => reject(err.parserError));
        pdfParser.on("pdfParser_dataReady", pdfData => {
            console.log('Procesando PDF:', pdfPath, pdfData);
            if (!pdfData) {
            return reject(new Error('El PDF no tiene el formato esperado. No se pudo acceder a las páginas.'));
            }
            console.log('Claves recibidas del PDF:', Object.keys(pdfData)); // 👈 Aquí
            resolve(pdfData);
        });


        pdfParser.loadPDF(pdfPath);
    });
  }

  // Extraer texto usando OCR (para PDFs escaneados)
  async extractTextWithOCR(pdfPath) {
    try {
      // Nota: Para un servidor compartido, podrías necesitar usar una API externa
      // como Google Cloud Vision API para OCR más eficiente
      
      const { data: { text } } = await Tesseract.recognize(pdfPath, 'spa', {
        logger: m => console.log(m)
      });
      
      return text;
    } catch (error) {
      console.error('Error en OCR:', error);
      throw error;
    }
  }

  // Procesar el texto extraído y estructurar los datos
  processExtractedText(text) {
    console.log('Procesando texto extraído...');
    
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const result = {
      supplier: this.extractSupplierInfo(text),
      items: this.extractItems(text, lines),
      totals: this.extractTotals(text),
      metadata: {
        totalLines: lines.length,
        processingDate: new Date()
      }
    };
    
    console.log('Datos procesados:', JSON.stringify(result, null, 2));
    return result;
  }

  // Extraer información del proveedor
  extractSupplierInfo(text) {
    const suppliers = [];
    
    this.patterns.supplier.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        suppliers.push(...matches.map(match => match.trim()));
      }
    });
    
    return suppliers.length > 0 ? suppliers[0] : null;
  }

  // Extraer artículos/productos
  extractItems(text, lines) {
    const items = [];
    let total = 0;
    
    // Buscar líneas que contengan información de productos
    lines.forEach((line, index) => {
      if (this.looksLikeItemLine(line)) {
        const item = this.parseItemLine(line, lines, index);
        if (item && item.name) {
          total += item.price || 0; // Sumar al total
          items.push(item);
        }
      }
    });
    
    return items;
  }

  // Verificar si una línea parece contener información de producto
  looksLikeItemLine(line) {
    // Buscar patrones típicos de líneas de producto
    const hasCode = /\b[A-Z0-9\-_]{3,15}\b/.test(line);
    const hasQuantity = /\b[0-9]+(?:[.,][0-9]+)?\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)?\b/.test(line);
    const hasPrice = /[0-9]+(?:[.,][0-9]{2})\s*[€$]/.test(line);
    const hasDescription = /[A-Za-zÀ-ÿ\s]{5,}/.test(line);
    
    // Una línea de producto típicamente tiene al menos 2 de estos elementos
    return [hasCode, hasQuantity, hasPrice, hasDescription].filter(Boolean).length >= 2;
  }

  // Parsear una línea de producto
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
    this.patterns.itemCode.forEach(pattern => {
      const match = line.match(pattern);
      if (match && !item.code) {
        item.code = match[0].trim();
      }
    });
    
    // Extraer cantidad
    this.patterns.quantity.forEach(pattern => {
      const match = line.match(pattern);
      if (match && !item.quantity) {
        item.quantity = parseFloat(match[1] || match[0].replace(',', '.'));
      }
    });
    
    // Extraer precio
    this.patterns.price.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches && !item.price) {
        const priceStr = matches[0].replace(/[€$]/g, '').trim();
        item.price = parseFloat(priceStr.replace(',', '.'));
      }
    });
    
    // Extraer nombre/descripción
    let description = line;
    // Remover códigos, cantidades y precios para obtener la descripción
    description = description.replace(/\b[A-Z0-9\-_]{3,15}\b/g, '');
    description = description.replace(/\b[0-9]+(?:[.,][0-9]+)?\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)?\b/g, '');
    description = description.replace(/[0-9]+(?:[.,][0-9]{2})\s*[€$]/g, '');
    description = description.trim();
    
    if (description.length > 3) {
      item.name = description;
    }
    
    return item;
  }

  // Extraer totales
  extractTotals(text) {
    const totals = {};
    
    this.patterns.total.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const value = parseFloat(match.replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(value)) {
            if (match.toLowerCase().includes('subtotal')) {
              totals.subtotal = value;
            } else if (match.toLowerCase().includes('total')) {
              totals.total = value;
            }
          }
        });
      }
    });
    
    return totals;
  }

  // Comparar dos documentos
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
    
    const items1 = doc1Data.processedData.items || [];
    const items2 = doc2Data.processedData.items || [];
    
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
    const totals1 = doc1Data.processedData.totals || {};
    const totals2 = doc2Data.processedData.totals || {};
    
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
}

module.exports = PDFExtractor;