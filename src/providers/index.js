/**
 * Índice de proveedores
 * Centraliza la exportación de todos los proveedores disponibles
 */

const BaseProvider = require('./BaseProvider');
const ACLProvider = require('./ACLProvider');
const GenericProvider = require('./GenericProvider');
const GestinlibProvider = require('./GestinlibProvider');

module.exports = {
  BaseProvider,
  ACLProvider,
  GenericProvider,
  GestinlibProvider,
  
  // Lista de proveedores disponibles
  providers: {
    ACL: ACLProvider,
    GENERIC: GenericProvider,
    GESTINLIB: GestinlibProvider
  }
}; 