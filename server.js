const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const PDFExtractor = require('./src/pdfExtractor');
const Database = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración de multer para subida de archivos
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

// Inicializar base de datos
const db = new Database();

// Ruta principal - servir interfaz web
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Extraer datos de un PDF
app.post('/api/extract', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo PDF' });
    }

    const pdfPath = req.file.path;
    const extractor = new PDFExtractor();
    
    console.log('Procesando PDF:', req.file.originalname);
    const extractedData = await extractor.extractInvoiceData(pdfPath);
    
    // Guardar en base de datos
    const documentId = await db.saveDocument({
      filename: req.file.originalname,
      extractedData: extractedData,
      timestamp: new Date()
    });

    // Limpiar archivo temporal
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      documentId: documentId,
      filename: req.file.originalname,
      data: extractedData
    });

  } catch (error) {
    console.error('Error procesando PDF:', error);
    
    // Limpiar archivo temporal en caso de error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Error procesando el PDF',
      details: error.message 
    });
  }
});

// API: Comparar dos documentos
app.post('/api/compare', async (req, res) => {
  try {
    const { doc1Id, doc2Id } = req.body;
    
    if (!doc1Id || !doc2Id) {
      return res.status(400).json({ error: 'Se requieren dos IDs de documentos' });
    }

    const doc1 = await db.getDocument(doc1Id);
    const doc2 = await db.getDocument(doc2Id);

    if (!doc1 || !doc2) {
      return res.status(404).json({ error: 'Uno o ambos documentos no encontrados' });
    }

    const extractor = new PDFExtractor();
    const comparison = extractor.compareDocuments(doc1.extractedData, doc2.extractedData);

    res.json({
      success: true,
      comparison: comparison,
      documents: {
        doc1: { id: doc1Id, filename: doc1.filename },
        doc2: { id: doc2Id, filename: doc2.filename }
      }
    });

  } catch (error) {
    console.error('Error comparando documentos:', error);
    res.status(500).json({ 
      error: 'Error comparando documentos',
      details: error.message 
    });
  }
});

// API: Obtener historial de documentos
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await db.getAllDocuments();
    res.json({
      success: true,
      documents: documents
    });
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({ 
      error: 'Error obteniendo documentos',
      details: error.message 
    });
  }
});

// API: Obtener documento específico
app.get('/api/documents/:id', async (req, res) => {
  try {
    const document = await db.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json({
      success: true,
      document: document
    });
  } catch (error) {
    console.error('Error obteniendo documento:', error);
    res.status(500).json({ 
      error: 'Error obteniendo documento',
      details: error.message 
    });
  }
});

// Crear directorio de uploads si no existe
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Interfaz web: http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`- POST /api/extract - Extraer datos de PDF`);
  console.log(`- POST /api/compare - Comparar dos documentos`);
  console.log(`- GET /api/documents - Obtener historial`);
  console.log(`- GET /api/documents/:id - Obtener documento específico`);
});

module.exports = app;