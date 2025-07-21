/**
 * Utilidades para procesamiento de texto
 * Funciones comunes utilizadas por los proveedores
 */

/**
 * Convierte datos del PDF a texto plano
 * @param {Object} pdfData - Datos del PDF
 * @returns {string} Texto plano
 */
function convertPDFDataToText(pdfData) {
  if (!pdfData || !pdfData.Pages || !Array.isArray(pdfData.Pages)) {
    return '';
  }
  
  return pdfData.Pages.map(page =>
    page.Texts.map(t => decodeURIComponent(t.R.map(r => r.T).join(' '))).join(' ')
  ).join('\n');
}

/**
 * Normaliza un número (convierte comas a puntos)
 * @param {string} value - Valor a normalizar
 * @returns {number} Número normalizado
 */
function normalizeNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  
  return parseFloat(value.replace(',', '.').replace(/[^\d.-]/g, ''));
}

/**
 * Extrae el primer número de una cadena
 * @param {string} text - Texto a procesar
 * @returns {number|null} Primer número encontrado
 */
function extractFirstNumber(text) {
  const match = text.match(/\d+(?:[.,]\d+)?/);
  return match ? normalizeNumber(match[0]) : null;
}

/**
 * Limpia texto removiendo caracteres especiales
 * @param {string} text - Texto a limpiar
 * @returns {string} Texto limpio
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,€$]/g, '')
    .trim();
}

/**
 * Verifica si una cadena contiene números
 * @param {string} text - Texto a verificar
 * @returns {boolean} True si contiene números
 */
function containsNumbers(text) {
  return /\d/.test(text);
}

/**
 * Verifica si una cadena parece ser un código de producto
 * @param {string} text - Texto a verificar
 * @returns {boolean} True si parece ser un código
 */
function looksLikeProductCode(text) {
  return /^[A-Z0-9\-_]{3,20}$/.test(text.trim());
}

/**
 * Verifica si una cadena parece ser un precio
 * @param {string} text - Texto a verificar
 * @returns {boolean} True si parece ser un precio
 */
function looksLikePrice(text) {
  return /^\d+(?:[.,]\d{2})?\s*[€$]?$/.test(text.trim());
}

/**
 * Verifica si una cadena parece ser una cantidad
 * @param {string} text - Texto a verificar
 * @returns {boolean} True si parece ser una cantidad
 */
function looksLikeQuantity(text) {
  return /^\d+(?:[.,]\d+)?\s*(?:ud|pcs|un|kg|g|l|ml|m|cm)?$/.test(text.trim());
}

/**
 * Divide texto en líneas y filtra líneas vacías
 * @param {string} text - Texto a dividir
 * @returns {Array} Array de líneas no vacías
 */
function splitIntoLines(text) {
  return text.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Busca patrones en texto y retorna todas las coincidencias
 * @param {string} text - Texto a buscar
 * @param {RegExp} pattern - Patrón a buscar
 * @returns {Array} Array de coincidencias
 */
function findAllMatches(text, pattern) {
  const matches = [];
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match);
  }
  
  return matches;
}

module.exports = {
  convertPDFDataToText,
  normalizeNumber,
  extractFirstNumber,
  cleanText,
  containsNumbers,
  looksLikeProductCode,
  looksLikePrice,
  looksLikeQuantity,
  splitIntoLines,
  findAllMatches
}; 