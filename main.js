const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const mm = require('music-metadata');

const LIB_PATH = path.join(__dirname, 'library.json');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

/* ── METADATA EXTRACTION (ID3 / APIC / cover) ── */
async function extractMetadata(filePath) {
  try {
    const md = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    const tags = md.common || {};
    const cover = (tags.picture && tags.picture[0]) || (md.common && md.common.picture);
    let coverData = null;
    if (cover && cover.data) {
      const mime = cover.format || 'image/jpeg';
      coverData = `data:${mime};base64,${Buffer.from(cover.data).toString('base64')}`;
    }
    return {
      title: tags.title || path.basename(filePath, path.extname(filePath)),
      artist: tags.artist || 'Unknown',
      album: tags.album || 'Unknown Album',
      duration: md.format && md.format.duration ? Math.round(md.format.duration) : 0,
      coverData
    };
  } catch (e) {
    return {
      title: path.basename(filePath, path.extname(filePath)),
      artist: 'Unknown',
      album: 'Unknown Album',
      duration: 0,
      coverData: null
    };
  }
}

function readLibrary() {
  try {
    if (!fs.existsSync(LIB_PATH)) return { tracks: [], playlists: {} };
    const raw = fs.readFileSync(LIB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { tracks: parsed, playlists: {} };
    return Object.assign({ tracks: [], playlists: {} }, parsed);
  } catch (e) {
    return { tracks: [], playlists: {} };
  }
}

function writeLibrary(data) {
  try {
    fs.writeFileSync(LIB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) { return false; }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0a14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // <-- THIS LINE FIXES THE AUDIO
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  app.setName('Clove.v3');  // <-- ADD THIS LINE HERE
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ── IPC: metadata extraction per file ── */
ipcMain.handle('extract-metadata', async (_e, filePath) => {
  const meta = await extractMetadata(filePath);
  return meta;
});

/* ── IPC: file picker ── */
ipcMain.handle('open-files', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg'] }]
  });
  return res.canceled ? [] : res.filePaths;
});

ipcMain.handle('open-folder', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return res.canceled ? null : res.filePaths[0];
});

/* ── IPC: library persistence ── */
ipcMain.handle('read-library', () => readLibrary());
ipcMain.handle('write-library', (_e, data) => writeLibrary(data));

/* ── IPC: cover image selection ── */
ipcMain.handle('select-cover', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  });
  if (res.canceled || !res.filePaths.length) return null;
  const p = res.filePaths[0];
  try {
    const buf = fs.readFileSync(p);
    const ext = path.extname(p).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${buf.toString('base64')}`;
  } catch (e) { return null; }
});

/* ── IPC: yt-dlp download ── */
ipcMain.handle('check-yt-dlp', () => {
  return new Promise(resolve => {
    const p = spawn('yt-dlp', ['--version']);
    p.on('error', () => resolve(false));
    p.on('close', code => resolve(code === 0));
  });
});

ipcMain.handle('download-song', (_e, query) => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const safeName = `temp_${timestamp}`;
    const outputTemplate = path.join(DOWNLOADS_DIR, `${safeName}.%(ext)s`);
        // Hardcoded path (bypasses Electron PATH issues)
    const ytDlpPath = '/opt/homebrew/bin/yt-dlp'; 
    
    // Use safeQuery as a single argument; spawn() with shell:false (default) does not interpret shell metachars
    const safeQuery = String(query);
    const args = ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '--embed-metadata', '--embed-thumbnail', '--no-playlist', '--no-warnings', '--ffmpeg-location', '/opt/homebrew/bin/ffmpeg', '-o', outputTemplate, '--', safeQuery];
    const proc = spawn(ytDlpPath, args, { shell: false });
    let stderr = '';
    let stdout = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => reject(new Error('yt-dlp not installed. Run: brew install yt-dlp')));
    proc.on('close', async (code) => {
      if (code !== 0) { console.error('yt-dlp stderr:', stderr); console.error('yt-dlp stdout:', stdout); return reject(new Error('yt-dlp failed: ' + stderr.split('\n').slice(-1)[0])); }
      // Find downloaded file
      const newFiles = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(safeName));
      if (!newFiles.length) return reject(new Error('Downloaded file not found'));
      const filePath = path.join(DOWNLOADS_DIR, newFiles[0]);
      const meta = await extractMetadata(filePath);
            // Read the downloaded thumbnail if metadata didn't extract it
            // Read the downloaded thumbnail if metadata didn't extract it
      if (!meta.coverData) {
        const allFiles = fs.readdirSync(DOWNLOADS_DIR);
        const thumbFile = allFiles.find(f => f.startsWith(safeName) && f.endsWith('.jpg'));
        if (thumbFile) {
          const thumbPath = path.join(DOWNLOADS_DIR, thumbFile);
          try {
            const thumbBuf = fs.readFileSync(thumbPath);
            meta.coverData = `data:image/jpeg;base64,${thumbBuf.toString('base64')}`;
          } catch (e) {}
        }
      }
      // Rename file to real title if different
      const safeTitle = (meta.title || 'Unknown').replace(/[^\w\- ]/g, '_').slice(0, 60) || 'track';
      const newName = safeTitle + path.extname(filePath);
      const renamedPath = path.join(DOWNLOADS_DIR, newName);
      try { if (filePath !== renamedPath) fs.renameSync(filePath, renamedPath); } catch(e){}
      const finalPath = (filePath !== renamedPath && fs.existsSync(renamedPath)) ? renamedPath : filePath;
      const lib = readLibrary();
      if (!lib.tracks.some(t => t.path === finalPath)) {
        lib.tracks.push({
          path: finalPath,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          duration: meta.duration || 0,
          coverData: meta.coverData,
          customCover: meta.coverData
        });
        writeLibrary(lib);
      }
      resolve(lib);
    });
  });
});

/* ── IPC: delete file from disk ── */
ipcMain.handle('delete-file', async (_e, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return 'ok';
  } catch (err) {
    console.error('delete-file failed:', err.message);
    return 'error';
  }
});
