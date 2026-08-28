# Clove.v3 🎵

A beautiful, glassmorphism-style **offline music player** built with Electron. Your music lives on your computer — no cloud, no streaming, no accounts.

![Clove.v3](https://via.placeholder.com/1200x600?text=Clove.v3+Screenshot+Here)

---

## ⚡ Fully Offline & Local

Clove.v3 is **not** a streaming service. It is a **local music player**:

- **Your music never leaves your computer.** All tracks, playlists, metadata, and album art are stored locally in the app's `downloads` folder and `library.json` file.
- **Play everything without internet.** Once a song is added, you can turn off Wi-Fi and it plays perfectly.
- **No accounts, no cloud, no tracking.** Just your library on your machine.

*(The optional YouTube download feature uses the internet only when you want to add a new song to your local library — after that, it lives safely on your hard drive and plays offline forever.)*

---

## ✨ Features

- 🎨 **Modern Glass UI:** Dynamic background colors matching the album cover and smooth caustics effects.
- 🎵 **Local Music Import:** Easily import MP3, FLAC, WAV, M4A, AAC, and OGG files.
- 🎥 **YouTube Downloading:** Search and download audio from YouTube using `yt-dlp` and `ffmpeg` (requires internet, saves locally).
- 🗂️ **Smart Library:** Browse by Songs, Favorites, Artists, Albums, and Playlists.
- 🎚️ **Expanded Players:** Full-screen album art displays for tracks, playlists, artists, and albums with drag-and-drop queue reordering.
- ✍️ **Metadata Editing:** Edit track titles, artists, albums, and cover art directly within the app.
- 📁 **Playlist Management:** Create, rename, delete, and reorder playlists with specific track removal.

---

## 💻 Download Pre-built App (macOS)

If you just want to use the app without installing Node.js, download the latest release from the **Releases** page:

- **macOS (Apple Silicon):** `Clove.v3-1.0.0-arm64.dmg`

Open the DMG, drag `Clove.v3.app` to your Applications folder, and launch.  

> **Note:** Because the app is not signed by Apple, you may need to **right-click** the app → **Open** → **Open** the first time.

---

## 🛠️ Build from Source (for developers)

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- `yt-dlp` (for YouTube downloads): `brew install yt-dlp` (macOS) or `pip install yt-dlp`
- `ffmpeg` (for audio conversion): `brew install ffmpeg` (macOS) or `apt-get install ffmpeg` (Linux)

### Setup

```bash
git clone https://github.com/Journal94-source/Clove.v3.git
cd Clove.v3
npm install
npm start