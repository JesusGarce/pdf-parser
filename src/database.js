const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'data', 'invoices.db');
    this.init();
  }

  // Inicializar base de datos
  init() {
    // Crear directorio data si no existe
    const fs = require('fs');
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('Error conectando a la base de datos:', err);
      } else {
        console.log('Conectado a la base de datos SQLite');
        this.createTables();
      }
    });
  }

  // Crear tablas
  createTables() {
    const createDocumentsTable = `
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        extraction_method TEXT,
        raw_text TEXT,
        processed_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createItemsTable = `
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        name TEXT,
        code TEXT,
        quantity REAL,
        price REAL,
        total REAL,
        line_number INTEGER,
        FOREIGN KEY (document_id) REFERENCES documents (id)
      )
    `;

    const createComparisonsTable = `
      CREATE TABLE IF NOT EXISTS comparisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document1_id INTEGER,
        document2_id INTEGER,
        comparison_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document1_id) REFERENCES documents (id),
        FOREIGN KEY (document2_id) REFERENCES documents (id)
      )
    `;

    this.db.serialize(() => {
      this.db.run(createDocumentsTable);
      this.db.run(createItemsTable);
      this.db.run(createComparisonsTable);
    });
  }

  // Guardar documento
  async saveDocument(documentData) {
    return new Promise((resolve, reject) => {
      const { filename, extractedData } = documentData;
      
      const insertDocument = `
        INSERT INTO documents (filename, extraction_method, raw_text, processed_data)
        VALUES (?, ?, ?, ?)
      `;

      const db = this.db;
      db.run(insertDocument, [
        filename,
        extractedData.extractionMethod,
        extractedData.rawText,
        JSON.stringify(extractedData.processedData)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          const documentId = this.lastID;
          // Guardar items relacionados
          const items = extractedData.processedData.items || [];
          const insertItem = `
            INSERT INTO items (document_id, name, code, quantity, price, total, line_number)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          items.forEach(item => {
            db.run(insertItem, [
              documentId,
              item.name,
              item.code,
              item.quantity,
              item.price,
              item.total,
              item.lineNumber
            ]);
          });
          resolve(documentId);
        }
      });
    });
  }

  // Obtener documento por ID
  async getDocument(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          d.*,
          json_group_array(
            json_object(
              'name', i.name,
              'code', i.code,
              'quantity', i.quantity,
              'price', i.price,
              'total', i.total,
              'lineNumber', i.line_number
            )
          ) as items
        FROM documents d
        LEFT JOIN items i ON d.id = i.document_id
        WHERE d.id = ?
        GROUP BY d.id
      `;

      this.db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          // Parsear datos JSON
          const processedData = JSON.parse(row.processed_data);
          const items = JSON.parse(row.items);
          
          resolve({
            id: row.id,
            filename: row.filename,
            extractionMethod: row.extraction_method,
            rawText: row.raw_text,
            processedData: processedData,
            items: items.filter(item => item.name !== null), // Filtrar items vacíos
            createdAt: row.created_at
          });
        }
      });
    });
  }

  // Obtener todos los documentos
  async getAllDocuments() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          d.id,
          d.filename,
          d.extraction_method,
          d.created_at,
          COUNT(i.id) as item_count,
          json_extract(d.processed_data, '$.totals.total') as total_amount
        FROM documents d
        LEFT JOIN items i ON d.id = i.document_id
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            id: row.id,
            filename: row.filename,
            extractionMethod: row.extraction_method,
            itemCount: row.item_count,
            totalAmount: row.total_amount,
            createdAt: row.created_at
          })));
        }
      });
    });
  }

  // Guardar comparación
  async saveComparison(doc1Id, doc2Id, comparisonData) {
    return new Promise((resolve, reject) => {
      const insertComparison = `
        INSERT INTO comparisons (document1_id, document2_id, comparison_data)
        VALUES (?, ?, ?)
      `;

      this.db.run(insertComparison, [
        doc1Id,
        doc2Id,
        JSON.stringify(comparisonData)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  // Obtener comparaciones
  async getComparisons() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          c.*,
          d1.filename as doc1_filename,
          d2.filename as doc2_filename
        FROM comparisons c
        JOIN documents d1 ON c.document1_id = d1.id
        JOIN documents d2 ON c.document2_id = d2.id
        ORDER BY c.created_at DESC
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            id: row.id,
            document1Id: row.document1_id,
            document2Id: row.document2_id,
            doc1Filename: row.doc1_filename,
            doc2Filename: row.doc2_filename,
            comparisonData: JSON.parse(row.comparison_data),
            createdAt: row.created_at
          })));
        }
      });
    });
  }

  // Buscar documentos por nombre de archivo
  async searchDocuments(searchTerm) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          d.id,
          d.filename,
          d.extraction_method,
          d.created_at,
          COUNT(i.id) as item_count
        FROM documents d
        LEFT JOIN items i ON d.id = i.document_id
        WHERE d.filename LIKE ?
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `;

      this.db.all(query, [`%${searchTerm}%`], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            id: row.id,
            filename: row.filename,
            extractionMethod: row.extraction_method,
            itemCount: row.item_count,
            createdAt: row.created_at
          })));
        }
      });
    });
  }

  // Eliminar documento
  async deleteDocument(id) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Eliminar items relacionados
        this.db.run('DELETE FROM items WHERE document_id = ?', [id]);
        
        // Eliminar comparaciones relacionadas
        this.db.run('DELETE FROM comparisons WHERE document1_id = ? OR document2_id = ?', [id, id]);
        
        // Eliminar documento
        this.db.run('DELETE FROM documents WHERE id = ?', [id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        });
      });
    });
  }

  // Cerrar conexión
  close() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error('Error cerrando base de datos:', err);
        } else {
          console.log('Conexión a base de datos cerrada');
        }
        resolve();
      });
    });
  }
}

module.exports = Database;