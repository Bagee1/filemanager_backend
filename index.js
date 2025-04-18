// backend/app.js
require('dotenv').config();
console.log('AWS Region:', process.env.AWS_REGION);
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// S3 client setup
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
// Шалгахын тулд консол руу хэвлэх
console.log('S3 client config:', {
  region: process.env.AWS_REGION || 'us-east-1',
  hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;
console.log('Bucket name:', BUCKET_NAME); // Энэ шалгах мөрийг нэмж өгөх

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// API route to upload a file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл оруулаагүй байна' });
    }

    const params = {
      Bucket: BUCKET_NAME,
      Key: req.file.originalname,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    res.status(200).json({ message: 'Файл амжилттай байршуулагдлаа', filename: req.file.originalname });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Файл байршуулахад алдаа гарлаа' });
  }
});

// API route to list all files
app.get('/api/files', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
    });
    
    const { Contents = [] } = await s3Client.send(command);
    
    const files = await Promise.all(Contents.map(async (file) => {
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: file.Key,
      });
      
      // Generate temporary URL for each file
      const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
      
      return {
        name: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
        url: url
      };
    }));
    
    res.status(200).json({ files });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Файлуудын жагсаалтыг авахад алдаа гарлаа' });
  }
});

// API route to delete a file
app.delete('/api/files/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: filename,
    };
    
    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
    
    res.status(200).json({ message: 'Файл амжилттай устгагдлаа', filename });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Файл устгахад алдаа гарлаа' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});