/**
 * Ejemplo de uso del PDF Extractor optimizado
 * Muestra cómo usar la nueva estructura modular
 */

const PDFExtractor = require('./pdfExtractor');
const path = require('path');

async function example() {
  try {
    // Crear instancia del extractor
    const extractor = new PDFExtractor();
    
    console.log('Proveedores disponibles:', extractor.getAvailableProviders());
    
    // Ejemplo 1: Extracción con detección automática de proveedor
    console.log('\n=== Ejemplo 1: Detección automática ===');
    const result1 = await extractor.extractInvoiceData('./uploads/example.pdf');
    console.log('Proveedor detectado:', result1.supplier);
    console.log('Método de extracción:', result1.extractionMethod);
    console.log('Productos encontrados:', result1.processedData.items.length);
    
    // Ejemplo 2: Extracción con proveedor específico
    console.log('\n=== Ejemplo 2: Proveedor específico ===');
    const result2 = await extractor.extractInvoiceData('./uploads/acl_invoice.pdf', 'ACL');
    console.log('Proveedor usado:', result2.supplier);
    console.log('Productos encontrados:', result2.processedData.items.length);
    
    // Ejemplo 3: Comparación de documentos
    console.log('\n=== Ejemplo 3: Comparación de documentos ===');
    const doc1 = await extractor.extractInvoiceData('./uploads/doc1.pdf');
    const doc2 = await extractor.extractInvoiceData('./uploads/doc2.pdf');
    const comparison = extractor.compareDocuments(doc1, doc2);
    
    console.log('Resumen de comparación:');
    console.log('- Artículos comunes:', comparison.summary.commonItems);
    console.log('- Únicos en doc1:', comparison.summary.uniqueToDoc1);
    console.log('- Únicos en doc2:', comparison.summary.uniqueToDoc2);
    console.log('- Diferencias de precio:', comparison.summary.priceDifferences.length);
    
    // Ejemplo 4: Registrar un nuevo proveedor personalizado
    console.log('\n=== Ejemplo 4: Proveedor personalizado ===');
    
    // Crear un proveedor personalizado
    const CustomProvider = require('./providers/BaseProvider');
    class MyCustomProvider extends CustomProvider {
      constructor() {
        super();
        this.name = 'CUSTOM';
        this.keywords = ['Mi Empresa', 'Custom Corp'];
      }
      
      canHandle(text) {
        return this.keywords.some(keyword => 
          text.toUpperCase().includes(keyword.toUpperCase())
        );
      }
      
      async extractData(pdfPath, extractor) {
        // Lógica personalizada de extracción
        const extractedText = await extractor.extractTextFromPDF(pdfPath);
        const text = extractor._convertPDFDataToText(extractedText);
        
        return {
          rawText: text,
          processedData: this.processText(text),
          extractionMethod: 'custom',
          timestamp: new Date()
        };
      }
    }
    
    // Registrar el proveedor personalizado
    extractor.registerProvider('CUSTOM', new MyCustomProvider());
    console.log('Proveedores después de registro:', extractor.getAvailableProviders());
    
    // Ejemplo 5: Procesamiento en lote
    console.log('\n=== Ejemplo 5: Procesamiento en lote ===');
    const pdfFiles = [
      './uploads/invoice1.pdf',
      './uploads/invoice2.pdf',
      './uploads/invoice3.pdf'
    ];
    
    const batchResults = await Promise.allSettled(
      pdfFiles.map(file => extractor.extractInvoiceData(file))
    );
    
    console.log('Resultados del procesamiento en lote:');
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`- ${pdfFiles[index]}: ${result.value.processedData.items.length} productos`);
      } else {
        console.log(`- ${pdfFiles[index]}: Error - ${result.reason.message}`);
      }
    });
    
  } catch (error) {
    console.error('Error en el ejemplo:', error);
  }
}

// Función para mostrar información detallada de un resultado
function showDetailedResult(result) {
  console.log('\n=== Información Detallada ===');
  console.log('Proveedor:', result.supplier);
  console.log('Método de extracción:', result.extractionMethod);
  console.log('Timestamp:', result.timestamp);
  
  console.log('\n--- Datos del Proveedor ---');
  console.log('Nombre:', result.processedData.supplier);
  
  console.log('\n--- Productos ---');
  result.processedData.items.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name || 'Sin nombre'}`);
    console.log(`   Código: ${item.code || 'N/A'}`);
    console.log(`   Cantidad: ${item.quantity || 'N/A'}`);
    console.log(`   Precio: ${item.price ? `€${item.price}` : 'N/A'}`);
  });
  
  console.log('\n--- Totales ---');
  Object.entries(result.processedData.totals).forEach(([key, value]) => {
    console.log(`${key}: €${value}`);
  });
  
  console.log('\n--- Metadatos ---');
  console.log('Líneas procesadas:', result.processedData.metadata.totalLines);
  console.log('Fecha de procesamiento:', result.processedData.metadata.processingDate);
}

// Función para validar datos extraídos
function validateExtractedData(result) {
  const errors = [];
  const warnings = [];
  
  // Validar que hay productos
  if (!result.processedData.items || result.processedData.items.length === 0) {
    errors.push('No se encontraron productos');
  }
  
  // Validar productos individuales
  result.processedData.items.forEach((item, index) => {
    if (!item.name || item.name.length < 3) {
      warnings.push(`Producto ${index + 1}: Nombre muy corto o ausente`);
    }
    if (!item.price || item.price <= 0) {
      warnings.push(`Producto ${index + 1}: Precio inválido`);
    }
  });
  
  // Validar totales
  if (!result.processedData.totals.total && !result.processedData.totals.subtotal) {
    warnings.push('No se encontraron totales');
  }
  
  return { errors, warnings };
}

// Ejecutar ejemplo si se llama directamente
if (require.main === module) {
  example().then(() => {
    console.log('\nEjemplo completado exitosamente');
  }).catch(error => {
    console.error('Error ejecutando ejemplo:', error);
  });
}

module.exports = {
  example,
  showDetailedResult,
  validateExtractedData
}; 