# ChromaFlow

High-throughput optical wireless communication via dynamic high-density color matrices.

ChromaFlow transfers files between devices using animated JABCode sequences displayed on screen and captured by camera, no internet, no Bluetooth, no cables required.

**Live demo:** [chromaflow-xe.vercel.app](https://chromaflow-xe.vercel.app)

---

## How it works

The sender encodes a file into a sequence of JABCode frames, assembles them into an animated GIF, and displays it fullscreen. The receiver points a camera at the screen and scans each frame. Once all frames are received, the original file is reconstructed.

```
File → Binary header + chunks → JABCode frames → Animated GIF → Screen
Camera → Frame scan → Header parse → Chunk reassembly → File
```

---

## Features

- **Any file type** — text, images, PDFs, audio, video, anything
- **Binary header** — structured 12-byte per-frame metadata (mode, total codes, index, chunk length, MIME type)
- **Adaptive display fill** — automatically computes optimal module size and symbol dimensions to fill your screen, maximising data per frame
- **Animated GIF player** — play the sequence directly in the browser with fullscreen support (native API on desktop/Android, CSS overlay on iOS)
- **Live camera scanning** — continuous camera feed with frame deduplication via pixel hash
- **Upload scanning** — scan individual PNG frames by uploading them
- **MIME type restoration** — receiver downloads the file with the correct extension
- **Camera FPS detection** — receiver auto-detects camera frame rate and suggests the correct sender setting
- **Progress tracking** — slot grid showing which frames have been received

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Barcode | JABCode (ISO/IEC 22607) via WebAssembly |
| WASM compilation | Emscripten |
| GIF assembly | gif.js |
| ZIP export | JSZip |
| Deployment | Vercel |

---

## JABCode

ChromaFlow uses [JABCode](https://jabcode.org) (Just Another Barcode), a polychrome 2D barcode by Fraunhofer SIT, standardised as ISO/IEC 22607. JABCode supports up to 256 colours per module and achieves approximately 2.5× higher data density than QR codes.

The WASM binaries (`jabcodeWriter.wasm`, `jabcodeReader.wasm`) are compiled from the [JABCode reference implementation](https://github.com/jabcode/jabcode) using Emscripten.

---

## Project structure

```
chromaflow/
├── public/
│   ├── assets/
│   │   ├── jabcodeReader.js      # Emscripten glue (reader)
│   │   ├── jabcodeReader.wasm    # WASM binary (reader)
│   │   ├── jabcodeWriter.js      # Emscripten glue (writer)
│   │   └── jabcodeWriter.wasm    # WASM binary (writer)
│   ├── encoder.worker.js         # Web worker for frame encoding
│   └── favicon.svg
├── src/
│   ├── core/
│   │   ├── header.js             # 12-byte binary header encode/decode
│   │   ├── chunker.js            # File → chunks
│   │   ├── mime.js               # MIME type registry
│   │   ├── jabcode.js            # WASM wrapper (writer + reader)
│   │   └── display.js            # Viewport profiling, adaptive sizing
│   ├── components/
│   │   ├── Writer/
│   │   │   ├── FileDropZone.jsx
│   │   │   ├── GifPlayer.jsx
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

---

## Running locally

```bash
git clone https://github.com/XeCipher/ChromaFlow.git
cd ChromaFlow
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Binary header format

Each JABCode frame carries a 12-byte binary header prepended to its payload, encoded as `CF1:<base64>`.

```
Byte 0:      MODE (4b high) | RSVD (4b low)
Bytes 1–2:   TOTAL_CODES (16b, big-endian)   — max 65,535 frames
Byte 3:      padding
Bytes 4–5:   CODE_INDEX (16b, big-endian)
Bytes 6–7:   CHUNK_LENGTH (16b, big-endian)
Bytes 8–9:   MIME_TYPE_ID (16b, big-endian)
Bytes 10–11: RESERVED
```

---

## Adaptive display

When adaptive mode is enabled, the sender profiles the display at runtime:

```
Weff = floor(Wd / devicePixelRatio)
Heff = floor(Hd / devicePixelRatio)
modules = floor(min(Weff, Heff) / moduleSize)
symbolSize = modules × moduleSize
```

The minimum module size is 10px — empirically determined as the smallest size reliably scannable by a smartphone camera at typical demo distances.

---

## Limitations

- Rectangular JABCode symbols are not achievable via the current WASM CLI interface
- Large files (100KB+) may take several minutes to encode due to per-frame WASM processing
- Camera scanning reliability depends on ambient lighting and device camera quality
- iOS Safari does not support the native Fullscreen API, a CSS overlay is used as fallback

---

## Academic context

ChromaFlow is the capstone project (BCSE498J) for B.Tech Computer Science at VIT Chennai, developed as research into display-adaptive screen-to-camera communication.

**Paper:** *ChromaFlow: High-Throughput Optical Wireless Communication via Dynamic High-Density Color Matrices*

---

## Team

- Chaitanya Tukaram Patil — 22BCE5055
- Putcha Maanush — 22BCE1123
- Aalok Sameer Hasabnis — 22BCE1083

**Guide:** Dr. Praveen Joe I R, SCOPE, VIT Chennai

---

## License

This project uses JABCode under [LGPL 2.1](https://github.com/jabcode/jabcode/blob/master/LICENSE).