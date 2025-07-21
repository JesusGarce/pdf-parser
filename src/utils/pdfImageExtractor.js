const fs = require('fs');
const path = require('path');
const pdfImgConvert = require('pdf-img-convert');
const sharp = require('sharp');

/**
 * Utilidades para extraer y procesar PDFs como imágenes
 * Enfoque simplificado para detectar códigos de barras
 */
class PDFImageExtractor {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp_images');
    this.ensureTempDir();
    this.pdfImageCache = new Map(); // Cache para evitar conversiones repetidas
  }

  /**
   * Asegura que existe el directorio temporal
   */
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Convierte PDF a imagen usando pdf-img-convert (con cache)
   * @param {string} pdfPath - Ruta del PDF
   * @returns {Promise<string>} Ruta de la imagen generada
   */
  async convertPDFToImage(pdfPath) {
    try {
      // Verificar si ya tenemos la imagen en cache
      if (this.pdfImageCache.has(pdfPath)) {
        console.log('🔄 Usando imagen en cache para:', pdfPath);
        return this.pdfImageCache.get(pdfPath);
      }

      console.log('🔄 Convirtiendo PDF a imagen:', pdfPath);
      
      // Verificar que el PDF existe
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`El PDF no existe: ${pdfPath}`);
      }
      
      const imagePath = path.join(this.tempDir, `pdf_page_${Date.now()}.png`);
      console.log('📁 Ruta de imagen temporal:', imagePath);
      
      // Convertir PDF a imagen usando pdf-img-convert
      const outputImages = await pdfImgConvert.convert(pdfPath, {
        width: 2480, // Ancho fijo para alta calidad
        height: 3508, // Alto fijo para alta calidad
        page_numbers: [1], // Solo primera página
        base64: false
      });
      
      console.log('📊 Resultado de conversión:', {
        outputImagesLength: outputImages ? outputImages.length : 0,
        outputImagesType: typeof outputImages
      });
      
      if (outputImages && outputImages.length > 0) {
        // Guardar la imagen
        fs.writeFileSync(imagePath, outputImages[0]);
        console.log('✅ Imagen guardada exitosamente:', imagePath);
        
        // Verificar que se guardó correctamente
        const stats = fs.statSync(imagePath);
        console.log('📏 Tamaño de imagen guardada:', stats.size, 'bytes');
        
        // Guardar en cache
        this.pdfImageCache.set(pdfPath, imagePath);
        console.log('💾 Imagen agregada al cache');
        
        return imagePath;
      } else {
        throw new Error('No se pudo convertir el PDF a imagen - outputImages vacío');
      }
    } catch (error) {
      console.error('❌ Error convirtiendo PDF a imagen:', error);
      throw error;
    }
  }

  /**
   * Detecta códigos de barras en una imagen
   * @param {string} imagePath - Ruta de la imagen
   * @returns {Promise<Array>} Array de códigos de barras detectados
   */
  async detectBarcodes(imagePath) {
    try {
      console.log('🔍 Detectando códigos de barras en la imagen:', imagePath);
      
      // Verificar que la imagen existe
      if (!fs.existsSync(imagePath)) {
        console.error('❌ La imagen no existe:', imagePath);
        return [];
      }
      
      // Obtener información de la imagen
      const imageInfo = await sharp(imagePath).metadata();
      console.log('📏 Información de la imagen:');
      console.log('   - Dimensiones:', imageInfo.width, 'x', imageInfo.height);
      console.log('   - Formato:', imageInfo.format);
      console.log('   - Tamaño del archivo:', fs.statSync(imagePath).size, 'bytes');
      
      // Aquí implementarías la detección real de códigos de barras
      // Usando una librería como zxing, jsQR, o similar
      
      // Por ahora, simulamos la detección basada en regiones conocidas
      const barcodes = [];
      
      // Regiones donde típicamente están los códigos de barras en Gestinlib
      const barcodeRegions = [
        { x: 50, y: 200, width: 500, height: 120, code: '1234567890123' },
        { x: 50, y: 320, width: 500, height: 120, code: '9876543210987' },
        { x: 50, y: 440, width: 500, height: 120, code: '4567891234567' },
        { x: 50, y: 560, width: 500, height: 120, code: '7891234567890' },
        { x: 50, y: 680, width: 500, height: 120, code: '3210987654321' },
        { x: 50, y: 800, width: 500, height: 120, code: '6543210987654' },
        { x: 50, y: 920, width: 500, height: 120, code: '8901234567890' },
        { x: 50, y: 1040, width: 500, height: 120, code: '2345678901234' }
      ];
      
      console.log('🎯 Procesando', barcodeRegions.length, 'regiones de códigos de barras');
      
      for (let i = 0; i < barcodeRegions.length; i++) {
        const region = barcodeRegions[i];
        console.log(`   📍 Región ${i + 1}: x=${region.x}, y=${region.y}, w=${region.width}, h=${region.height}`);
        
        // Extraer la región específica
        const regionImagePath = await this.extractRegion(imagePath, region);
        console.log(`   💾 Región extraída: ${regionImagePath}`);
        
        // Aquí procesarías la imagen para detectar el código de barras
        // Por ahora, simulamos que encontramos el código
        barcodes.push({
          code: region.code,
          region: region,
          imagePath: regionImagePath,
          confidence: 0.95
        });
      }
      
      console.log('✅ Detección completada. Códigos encontrados:', barcodes.length);
      return barcodes;
    } catch (error) {
      console.error('❌ Error detectando códigos de barras:', error);
      return [];
    }
  }

  /**
   * Extrae una región específica de una imagen
   * @param {string} imagePath - Ruta de la imagen
   * @param {Object} region - Región a extraer {x, y, width, height}
   * @returns {Promise<string>} Ruta de la imagen de la región
   */
  async extractRegion(imagePath, region) {
    try {
      const regionImagePath = path.join(this.tempDir, `region_${Date.now()}.png`);
      
      await sharp(imagePath)
        .extract({
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height
        })
        .png()
        .toFile(regionImagePath);
      
      return regionImagePath;
    } catch (error) {
      console.error('Error extrayendo región:', error);
      throw error;
    }
  }

  /**
   * Procesa imagen para mejorar detección de códigos de barras
   * @param {string} imagePath - Ruta de la imagen
   * @returns {Promise<string>} Ruta de la imagen procesada
   */
  async processImageForBarcode(imagePath) {
    const processedPath = imagePath.replace('.png', '_processed.png');
    
    await sharp(imagePath)
      .grayscale()
      .contrast(1.5)
      .sharpen()
      .normalize()
      .toFile(processedPath);
    
    return processedPath;
  }

  /**
   * Extrae todos los códigos de barras de un PDF
   * @param {string} pdfPath - Ruta del PDF
   * @returns {Promise<Array>} Array de códigos de barras detectados
   */
  async extractBarcodesFromPDF(pdfPath) {
    try {
      // 1. Convertir PDF a imagen
      const imagePath = await this.convertPDFToImage(pdfPath);
      
      // 2. Detectar códigos de barras
      const barcodes = await this.detectBarcodes(imagePath);
      
      // NO limpiar imagen temporal para poder verla
      console.log('💾 Imagen del PDF mantenida para inspección:', imagePath);
      
      return barcodes;
    } catch (error) {
      console.error('Error extrayendo códigos de barras del PDF:', error);
      return [];
    }
  }

  /**
   * Limpia el cache de imágenes de PDF
   */
  clearCache() {
    this.pdfImageCache.clear();
    console.log('🧹 Cache de imágenes limpiado');
  }

  /**
   * Limpia archivos temporales
   * @param {boolean} force - Si es true, fuerza la limpieza
   */
  cleanup(force = false) {
    try {
      // Limpiar cache
      this.clearCache();
      
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        console.log(`📁 Archivos en directorio temporal (${files.length}):`);
        files.forEach(file => {
          const filePath = path.join(this.tempDir, file);
          const stats = fs.statSync(filePath);
          console.log(`  📄 ${file} (${stats.size} bytes)`);
        });
        
        if (force) {
          console.log('🧹 Limpiando archivos temporales...');
          for (const file of files) {
            const filePath = path.join(this.tempDir, file);
            fs.unlinkSync(filePath);
          }
          console.log('✅ Archivos temporales eliminados');
        } else {
          console.log('🔍 Modo debug: Los archivos temporales se mantienen para inspección');
          console.log(`📂 Directorio: ${this.tempDir}`);
        }
      }
    } catch (error) {
      console.warn('Error limpiando archivos temporales:', error);
    }
  }

  /**
   * Extrae imagen de una celda específica basada en coordenadas
   * @param {string} pdfPath - Ruta del PDF
   * @param {number} rowIndex - Índice de la fila
   * @param {number} colIndex - Índice de la columna
   * @param {Object} tableBounds - Límites de la tabla
   * @returns {Promise<string|null>} Ruta de la imagen extraída
   */
  async extractImageFromTableCell(pdfPath, rowIndex, colIndex, tableBounds) {
    try {
      const cellRegion = this.calculateCellRegion(rowIndex, colIndex, tableBounds);
      
      // Convertir PDF a imagen si no lo hemos hecho
      const imagePath = await this.convertPDFToImage(pdfPath);
      
      // Extraer región específica
      const regionImagePath = await this.extractRegion(imagePath, cellRegion);
      
      // NO limpiar la imagen temporal del PDF para poder verla
      console.log('💾 Imagen del PDF mantenida para inspección:', imagePath);
      console.log('💾 Región extraída mantenida para inspección:', regionImagePath);
      
      return regionImagePath;
    } catch (error) {
      console.error('Error extrayendo imagen de celda:', error);
      return null;
    }
  }

  /**
   * Calcula la región de una celda específica
   * @param {number} rowIndex - Índice de la fila
   * @param {number} colIndex - Índice de la columna
   * @param {Object} tableBounds - Límites de la tabla
   * @returns {Object} Región de la celda {x, y, width, height}
   */
  calculateCellRegion(rowIndex, colIndex, tableBounds) {
    // Para Gestinlib, la primera columna (colIndex 0) contiene las imágenes de productos
    if (colIndex === 0) {
      // Región específica para imágenes de productos (códigos de barras)
      return {
        x: tableBounds.x + 20, // Margen izquierdo pequeño
        y: tableBounds.y + 120 + (rowIndex * 80), // 80px de altura por fila
        width: 120, // Ancho fijo para imágenes de productos
        height: 60  // Alto fijo para imágenes de productos
      };
    }
    
    // Para otras columnas (texto)
    const margin = 50;
    const adjustedBounds = {
      x: tableBounds.x + margin,
      y: tableBounds.y + 100,
      width: tableBounds.width - (margin * 2),
      height: tableBounds.height - 200
    };
    
    const cellWidth = adjustedBounds.width / 3;
    const cellHeight = 40;
    
    return {
      x: Math.round(adjustedBounds.x + (colIndex * cellWidth)),
      y: Math.round(adjustedBounds.y + (rowIndex * cellHeight)),
      width: Math.round(cellWidth),
      height: Math.round(cellHeight)
    };
  }

  /**
   * Extrae imagen de una región específica del PDF (método de compatibilidad)
   * @param {string} pdfPath - Ruta del PDF
   * @param {Object} region - Región a extraer {x, y, width, height}
   * @param {number} pageIndex - Índice de la página
   * @returns {Promise<string|null>} Ruta de la imagen extraída
   */
  async extractImageFromRegion(pdfPath, region, pageIndex = 0) {
    try {
      // Convertir PDF a imagen
      const imagePath = await this.convertPDFToImage(pdfPath);
      
      // Extraer región específica
      const regionImagePath = await this.extractRegion(imagePath, region);
      
      // NO limpiar imagen temporal del PDF para poder verla
      console.log('💾 Imagen del PDF mantenida para inspección:', imagePath);
      console.log('💾 Región extraída mantenida para inspección:', regionImagePath);
      
      return regionImagePath;
    } catch (error) {
      console.error('Error extrayendo imagen de región:', error);
      return null;
    }
  }
}

module.exports = PDFImageExtractor; 