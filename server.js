const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const QRCode = require("qrcode");
const cors = require("cors");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const uploadsDir = path.join(__dirname, "uploads");
const metadataDir = path.join(__dirname, "metadata");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

function hashFile(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

function shortWallet(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function readMetadataById(id) {
  const file = path.join(metadataDir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function getAllMetadata() {
  return fs
    .readdirSync(metadataDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(metadataDir, f), "utf8")))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { datasetName, description, ownerWallet } = req.body;

  const datasetId = Date.now().toString();
  const filePath = req.file.path;
  const hash = hashFile(filePath);
  const blobName = `files/${datasetId}-${req.file.originalname}`;

  const command = `shelby upload "${filePath}" "${blobName}" -e tomorrow --assume-yes`;

  exec(command, (err, stdout) => {
    if (err) {
      return res.status(500).json({ error: "Shelby upload failed" });
    }

    const metadata = {
      id: datasetId,
      datasetName,
      description,
      ownerWallet,
      originalName: req.file.originalname,
      storedFileName: req.file.filename,
      blobName,
      hash,
      uploadedAt: new Date().toISOString(),
      shelbyOutput: stdout,
    };

    fs.writeFileSync(
      path.join(metadataDir, `${datasetId}.json`),
      JSON.stringify(metadata, null, 2)
    );

    res.json({
      datasetId,
      passportUrl: `http://localhost:4000/dataset/${datasetId}`,
      ownerWallet,
    });
  });
});

app.post("/verify", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ verified: false, error: "No file uploaded" });
  }

  const hash = hashFile(req.file.path);
  const all = getAllMetadata();

  const match = all.find((m) => m.hash === hash);

  if (match) {
    return res.json({
      verified: true,
      datasetId: match.id,
      datasetName: match.datasetName,
      passportUrl: `http://localhost:4000/dataset/${match.id}`,
    });
  }

  res.json({ verified: false });
});

app.get("/datasets", (req, res) => {
  const all = getAllMetadata();

  const rows = all
    .map(
      (m) => `
      <tr>
        <td>${m.datasetName || ""}</td>
        <td>${shortWallet(m.ownerWallet)}</td>
        <td>${m.uploadedAt}</td>
        <td><a href="/dataset/${m.id}">Passport</a></td>
      </tr>
    `
    )
    .join("");

  res.send(`
    <h1>Dataset Registry</h1>
    <table border="1" cellpadding="10">
      <tr>
        <th>Name</th>
        <th>Owner</th>
        <th>Date</th>
        <th>Passport</th>
      </tr>
      ${rows}
    </table>
  `);
});

app.get("/dataset/:id", async (req, res) => {
  const metadata = readMetadataById(req.params.id);

  if (!metadata) {
    return res.send("Dataset not found");
  }

  const qr = await QRCode.toDataURL(
    `http://localhost:${PORT}/dataset/${metadata.id}`
  );

  res.send(`
    <h1>Dataset Passport</h1>

    <div style="
      display:inline-block;
      padding:6px 12px;
      background:#00ffa6;
      color:black;
      font-weight:bold;
      border-radius:8px;
      margin-bottom:20px;
    ">
      VERIFIED DATASET
    </div>

    <p><b>Dataset:</b> ${metadata.datasetName}</p>
    <p><b>Owner Wallet:</b> ${shortWallet(metadata.ownerWallet)}</p>
    <p><b>Original File:</b> ${metadata.originalName}</p>

    <p>
      <b>Hash:</b> ${metadata.hash}
      <button onclick="navigator.clipboard.writeText('${metadata.hash}')">
        Copy
      </button>
    </p>

    <p><b>Shelby Blob:</b> ${metadata.blobName}</p>
    <p><b>Uploaded:</b> ${metadata.uploadedAt}</p>

    <img src="${qr}" width="200"/>

    <br><br>

    <a href="/datasets">Back to registry</a>

    <hr/>

    <p style="color:gray;font-size:14px">
      Dataset Passport is an independent interface built using Shelby decentralized storage.
    </p>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});