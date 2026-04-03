# ChromaFlow

High-throughput optical wireless communication via dynamic high-density color matrices.

ChromaFlow transfers files between devices using animated JABCode sequences displayed on screen and captured by camera, no internet, no Bluetooth, no cables required.

**Live demo:** https://chromaflow-xe.vercel.app

## How it works

The sender encodes a file into a sequence of JABCode frames, streams them instantly to the UI, and loops them fullscreen. The receiver points a camera at the screen and scans each frame. Once all frames are received, the original file is reconstructed perfectly.

```text
File → Dynamic Binary Header + Chunks → Direct C-API → JABCode Frames → Screen  
Camera → Frame Scan → Memory Decode → Chunk Reassembly → Original File
```

## Features

- **Any file type & Multi-file** — Transfer single files, text, or multiple files at once (auto-zipped)
- **Dynamic Binary Header** — Ultra-compact per-frame metadata (5 bytes for standard frames) eliminating Base64 overhead
- **Exact Filename Restoration** — Receiver downloads the file with original name and extension
- **Selective Retransmission** — Broadcast only missing frames to eliminate tail latency
- **Direct C-API Engine** — Hardware-fast WASM memory encoding/decoding (no workers, no FS overhead)
- **Adaptive display fill** — Packs up to ~4.2 KB payload per frame
- **Uncapped Camera FPS** — Uses requestAnimationFrame for max throughput
- **Progress tracking** — Real-time slot grid for frame capture

## Tech stack

| Layer | Technology |
|------|-----------|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Barcode | JABCode (ISO/IEC 22607) |
| Core Engine | Custom Direct Memory C-API via WebAssembly |
| GIF assembly | gif.js |
| ZIP export | JSZip |
| Deployment | Vercel |

## JABCode WebAssembly Compilation

ChromaFlow bypasses the standard JABCode CLI interface.

Instead, it uses a custom **Direct Memory C-API (`chromaflow.wasm`)** compiled via Emscripten.

This allows:
- Direct memory allocation inside WASM heap
- Raw binary writes (no Base64)
- Instant PNG extraction
- Zero filesystem overhead

Core exported functions:
- `cf_encode`
- `cf_decode`

## Project structure

```text
chromaflow/
├── public/
│   ├── assets/
│   │   ├── chromaflow.js
│   │   ├── chromaflow.wasm
│   ├── og-image.png
│   └── favicon.svg
├── src/
│   ├── core/
│   │   ├── header.js
│   │   ├── chunker.js
│   │   ├── jabcode.js
│   │   └── display.js
│   ├── components/
│   │   ├── Writer/
│   │   │   ├── FileDropZone.jsx
│   │   │   ├── FramePlayer.jsx
│   │   │   └── SettingsPanel.jsx
│   │   ├── Reader/
│   │   │   ├── SlotGrid.jsx
│   │   │   └── ResultView.jsx
│   │   └── shared/
│   │       └── Navbar.jsx
│   ├── pages/
│   │   ├── WriterPage.jsx
│   │   └── ReaderPage.jsx
│   ├── App.jsx
│   └── main.jsx
└── vercel.json
```

## Running locally

```bash
git clone https://github.com/XeCipher/ChromaFlow.git
cd ChromaFlow
npm install
npm run dev
```

Open: http://localhost:5173

## Dynamic Binary Header Format

### Initial Frame (Frame 0)

```text
Byte 0:       Flag (0x01)
Byte 1:       Filename Length (N)
Bytes 2..N+1: UTF-8 Filename
Bytes N+2..3: Frame Index (16-bit)
Bytes N+4..5: Total Frames (16-bit)
Bytes N+6...: Payload
```

### Subsequent Frames

```text
Byte 0:       Flag (0x00)
Bytes 1..2:   Frame Index (16-bit)
Bytes 3..4:   Total Frames (16-bit)
Bytes 5...:   Payload
```

## Adaptive display

```text
Weff = floor(Wd / devicePixelRatio)
Heff = floor(Hd / devicePixelRatio)
modules = snapToGrid(floor(min(Weff, Heff) / moduleSize))
```

Max theoretical payload per frame:
**4231 bytes (145×145 JABCode, ECC Level 3)**

## Academic context

ChromaFlow is the capstone project (BCSE498J) for B.Tech Computer Science at VIT Chennai.

Paper: *ChromaFlow: High-Throughput Optical Wireless Communication via Dynamic High-Density Color Matrices*

## Team

- Chaitanya Tukaram Patil — 22BCE5055
- Putcha Maanush — 22BCE1123
- Aalok Sameer Hasabnis — 22BCE1083

Guide: Dr. Praveen Joe I R, SCOPE, VIT Chennai

## License

### JABCode

Licensed under LGPLv3 with static linking exception

```text
libjabcode - JABCode Encoding/Decoding Library
Copyright 2016 Fraunhofer SIT
```

Full license: https://github.com/jabcode/jabcode/blob/master/LICENSE

## Third-Party Dependencies

- libpng — http://www.libpng.org/
- zlib — https://www.zlib.net/
- libtiff — http://www.libtiff.org/
