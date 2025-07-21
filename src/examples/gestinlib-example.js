/**
 * Ejemplo específico para el proveedor Gestinlib
 * Muestra cómo extraer datos con códigos EAN desde imágenes
 */

const PDFExtractor = require('../pdfExtractor');
const path = require('path');

async function gestinlibExample() {
  try {
    console.log('=== Ejemplo Gestinlib Provider ===\n');
    
    // Crear instancia del extractor
    const extractor = new PDFExtractor();
    
    // Verificar que Gestinlib está disponible
    const providers = extractor.getAvailableProviders();
    console.log('Proveedores disponibles:', providers);
    
    if (!providers.includes('GESTINLIB')) {
      console.error('Error: Proveedor GESTINLIB no está disponible');
      return;
    }
    
    // Ejemplo 1: Extracción con detección automática
    console.log('\n--- Ejemplo 1: Detección automática ---');
    const result1 = await extractor.extractInvoiceData('./uploads/gestinlib_invoice.pdf');
    
    console.log('Proveedor detectado:', result1.supplier);
    console.log('Método de extracción:', result1.extractionMethod);
    console.log('Productos encontrados:', result1.processedData.items.length);
    console.log('Códigos EAN encontrados:', result1.processedData.metadata.eanCodesFound);
    
    // Mostrar productos con códigos EAN
    console.log('\nProductos extraídos:');
    result1.processedData.items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.titulo}`);
      console.log(`   Código: ${item.codigo}`);
      console.log(`   Cantidad: ${item.cantidad}`);
      console.log(`   Precio: €${item.precio}`);
      console.log('');
    });
    
    // Ejemplo 2: Extracción con proveedor específico
    console.log('\n--- Ejemplo 2: Proveedor específico ---');
    const result2 = await extractor.extractInvoiceData('./uploads/gestinlib_invoice.pdf', 'GESTINLIB');
    
    console.log('Proveedor usado:', result2.supplier);
    console.log('Productos encontrados:', result2.processedData.items.length);
    
    // Ejemplo 3: Análisis de códigos EAN
    console.log('\n--- Ejemplo 3: Análisis de códigos EAN ---');
    const eanAnalysis = analyzeEANCodes(result2.processedData.items);
    
    console.log('Análisis de códigos EAN:');
    console.log('- Códigos válidos:', eanAnalysis.validCodes.length);
    console.log('- Códigos inválidos:', eanAnalysis.invalidCodes.length);
    console.log('- Códigos faltantes:', eanAnalysis.missingCodes.length);
    
    if (eanAnalysis.validCodes.length > 0) {
      console.log('\nCódigos EAN válidos encontrados:');
      eanAnalysis.validCodes.forEach(code => {
        console.log(`  - ${code}`);
      });
    }
    
    // Ejemplo 4: Validación de datos
    console.log('\n--- Ejemplo 4: Validación de datos ---');
    const validation = validateGestinlibData(result2);
    
    console.log('Resultado de validación:');
    if (validation.errors.length > 0) {
      console.log('Errores:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('Advertencias:');
      validation.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (validation.errors.length === 0 && validation.warnings.length === 0) {
      console.log('✅ Datos válidos');
    }
    
    // Ejemplo 5: Exportar datos
    console.log('\n--- Ejemplo 5: Exportar datos ---');
    const exportData = exportGestinlibData(result2);
    
    console.log('Datos exportados:');
    console.log(JSON.stringify(exportData, null, 2));
    
  } catch (error) {
    console.error('Error en ejemplo Gestinlib:', error);
  }
}

/**
 * Analiza los códigos EAN extraídos
 * @param {Array} items - Productos extraídos
 * @returns {Object} Análisis de códigos EAN
 */
function analyzeEANCodes(items) {
  const validCodes = [];
  const invalidCodes = [];
  const missingCodes = [];
  
  items.forEach(item => {
    if (!item.codigo) {
      missingCodes.push(item.titulo);
    } else if (item.codigo.startsWith('GESTINLIB_')) {
      missingCodes.push(item.titulo);
    } else if (isValidEAN(item.codigo)) {
      validCodes.push(item.codigo);
    } else {
      invalidCodes.push(item.codigo);
    }
  });
  
  return { validCodes, invalidCodes, missingCodes };
}

/**
 * Valida un código EAN
 * @param {string} ean - Código EAN a validar
 * @returns {boolean} True si es válido
 */
function isValidEAN(ean) {
  if (!ean || ean.length < 8 || ean.length > 13) {
    return false;
  }
  
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
 * Valida los datos extraídos de Gestinlib
 * @param {Object} result - Resultado de extracción
 * @returns {Object} Resultado de validación
 */
function validateGestinlibData(result) {
  const errors = [];
  const warnings = [];
  
  // Validar que hay productos
  if (!result.processedData.items || result.processedData.items.length === 0) {
    errors.push('No se encontraron productos');
  }
  
  // Validar productos individuales
  result.processedData.items.forEach((item, index) => {
    if (!item.titulo || item.titulo.length < 5) {
      warnings.push(`Producto ${index + 1}: Título muy corto`);
    }
    
    if (!item.precio || item.precio <= 0) {
      errors.push(`Producto ${index + 1}: Precio inválido`);
    }
    
    if (!item.cantidad || item.cantidad <= 0) {
      warnings.push(`Producto ${index + 1}: Cantidad inválida`);
    }
    
    if (!item.codigo || item.codigo.startsWith('GESTINLIB_')) {
      warnings.push(`Producto ${index + 1}: Código EAN no encontrado`);
    }
  });
  
  // Validar totales
  if (!result.processedData.totals.total) {
    warnings.push('No se encontró total');
  }
  
  // Validar códigos EAN
  const eanAnalysis = analyzeEANCodes(result.processedData.items);
  if (eanAnalysis.missingCodes.length > 0) {
    warnings.push(`${eanAnalysis.missingCodes.length} productos sin código EAN`);
  }
  
  return { errors, warnings };
}

/**
 * Exporta datos de Gestinlib en formato estructurado
 * @param {Object} result - Resultado de extracción
 * @returns {Object} Datos exportados
 */
function exportGestinlibData(result) {
  return {
    supplier: result.supplier,
    extractionDate: result.timestamp,
    extractionMethod: result.extractionMethod,
    summary: {
      totalProducts: result.processedData.items.length,
      totalAmount: result.processedData.totals.total,
      eanCodesFound: result.processedData.metadata.eanCodesFound
    },
    products: result.processedData.items.map(item => ({
      title: item.titulo,
      ean: item.codigo,
      quantity: item.cantidad,
      price: item.precio,
      total: item.cantidad * item.precio
    })),
    totals: result.processedData.totals,
    metadata: result.processedData.metadata
  };
}

// Ejecutar ejemplo si se llama directamente
if (require.main === module) {
  gestinlibExample().then(() => {
    console.log('\n✅ Ejemplo Gestinlib completado exitosamente');
  }).catch(error => {
    console.error('❌ Error ejecutando ejemplo Gestinlib:', error);
  });
}

module.exports = {
  gestinlibExample,
  analyzeEANCodes,
  validateGestinlibData,
  exportGestinlibData
}; 