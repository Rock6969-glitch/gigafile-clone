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
app.use(express.static('public'));

// アップロード先フォルダの指定
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// メタデータ（ファイルの期限などを保存するJSONファイル）のパス
const METADATA_PATH = path.join(__dirname, 'metadata.json');

// メタデータを読み込む関数
function loadMetadata() {
  if (!fs.existsSync(METADATA_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

// メタデータを保存する関数
function saveMetadata(data) {
  fs.writeFileSync(METADATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Multerの設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

// 1. ファイルアップロードAPI（期限情報を受け取る）
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ファイルを選択してください。' });
  }

  const fileId = req.file.filename;
  const originalName = req.file.originalname;
  const expireDays = parseInt(req.body.expire, 10); // 1, 3, 7 または 0（期限なし）

  // 有効期限の計算
  let expiresAt = null;
  if (expireDays > 0) {
    const date = new Date();
    date.setDate(date.getDate() + expireDays);
    expiresAt = date.getTime(); // 期限のミリ秒（タイムスタンプ）
  }

  // メタデータに保存
  const metadata = loadMetadata();
  metadata[fileId] = {
    originalName: originalName,
    filename: fileId,
    expiresAt: expiresAt // nullなら期限なし
  };
  saveMetadata(metadata);

  const protocol = req.protocol;
  const host = req.get('host');

  res.json({
    success: true,
    fileId: fileId,
    downloadUrl: `${protocol}://${host}/download.html?id=${fileId}&name=${encodeURIComponent(originalName)}`
  });
});

// 2. ファイルダウンロードAPI（期限切れチェック付き）
app.get('/api/download/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const filePath = path.join(UPLOAD_DIR, fileId);
  const metadata = loadMetadata();
  const fileInfo = metadata[fileId];

  // ファイルが存在しない、またはメタデータがない場合
  if (!fs.existsSync(filePath) || !fileInfo) {
    return res.status(404).send('ファイルが見つからないか、存在しません。');
  }

  // 期限切れのチェック
  if (fileInfo.expiresAt !== null && Date.now() > fileInfo.expiresAt) {
    // 期限切れなのでファイルとメタデータを削除
    try { fs.unlinkSync(filePath); } catch (e) {}
    delete metadata[fileId];
    saveMetadata(metadata);
    return res.status(404).send('このファイルはダウンロード期限が切れているため削除されました。');
  }

  // ファイルのダウンロード応答
  res.download(filePath, fileInfo.originalName);
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});