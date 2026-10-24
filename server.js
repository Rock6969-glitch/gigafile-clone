const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // publicフォルダ内の静的ファイルを提供する

// アップロード先フォルダの指定
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// Multerの設定（ファイル保存時の名前定義など）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // 重複を防ぐためタイムスタンプ＋ランダム文字列を付与
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

// 1. ファイルアップロードAPI
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ファイルを選択してください。' });
  }

  // 本来はデータベース(SQLiteやMongoDB)に保存するのが理想的ですが、
  // 簡単のためファイル名をそのままIDとして扱います
  const fileId = req.file.filename;
  const originalName = req.file.originalname;

  res.json({
    success: true,
    fileId: fileId,
    downloadUrl: `http://localhost:${PORT}/download.html?id=${fileId}&name=${encodeURIComponent(originalName)}`
  });
});

// 2. ファイルダウンロードAPI
app.get('/api/download/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const filePath = path.join(UPLOAD_DIR, fileId);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('ファイルが見つからないか、期限切れです。');
  }

  // ファイルのダウンロード応答
  res.download(filePath);
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});