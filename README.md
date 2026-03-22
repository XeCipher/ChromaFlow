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

## JABCode WebAssembly Compilation

This section documents the process of compiling JABCode (reader and writer) to WebAssembly.

### Prerequisites

- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) installed and activated
- Git (for cloning repositories)

### Step 1: Get JABCode Source

Clone or download the JABCode repository:

```bash
git clone https://github.com/jabcode/jabcode.git
cd jabcode
git checkout 76a7655bb61e65f81ea962e575cdbd06fedebb26
cd src/jabcode
```

### Step 2: Initial JABCode Compilation

Compile the JABCode library:

```bash
emmake make
```

### Step 3: Compile libtiff for WebAssembly

JABCode depends on libpng, libtiff and libz, but the provided `.a` files are not compatible with WebAssembly. We need to use libpng and libz provided by emsdk and compile libtiff from source.

1. Download libtiff source (v4.7.1):
   ```bash
   wget https://download.osgeo.org/libtiff/tiff-4.7.1.tar.gz
   tar -xzf tiff-4.7.1.tar.gz
   cd tiff-4.7.1
   ```

2. Configure and compile with Emscripten:
   ```bash
   emconfigure ./configure
   emmake make
   ```

3. Copy the compiled library:
   ```bash
   cp libtiff/.libs/libtiff.a /path/to/jabcode/src/jabcode/lib/
   ```
   Replace the existing `libtiff.a` in `jabcode/src/jabcode/lib/` with this WebAssembly-compatible version.

### Step 4: Modify Makefiles

Modify the Makefiles in both `src/jabcodeReader` and `src/jabcodeWriter`:

**Original line 10:**
```makefile
$(CC) $^ -L../jabcode/build -ljabcode -L../jabcode/lib -ltiff -lpng16 -lz -lm $(CFLAGS) -o $@
```

**Replace with:**
```makefile
$(CC) $^ -L../jabcode/build -ljabcode -L../jabcode/lib -ltiff -sUSE_LIBPNG -sUSE_ZLIB -sINVOKE_RUN=0 -sALLOW_MEMORY_GROWTH=1 -lm $(CFLAGS) -o $@
```

This change:
- Uses Emscripten's built-in libpng and zlib instead of the provided static libraries
- Adds `-sINVOKE_RUN=0` to prevent automatic execution
- Adds `-sALLOW_MEMORY_GROWTH=1` to dynamically increase the heap memory while running jabcodereader prevent OOM when scanning large images especially from phone cameras
- Keeps libtiff linked from the custom-compiled version

**Note:** Instead of replacing `libtiff.a`, you can modify `-L../jabcode/lib` to point directly to your libtiff build directory.

### Step 5: Build Reader and Writer

Build the JABCode reader:
```bash
cd src/jabcodeReader
emmake make CC=emcc TARGET=jabcodeReader.js
```

Build the JABCode writer:
```bash
cd src/jabcodeWriter
emmake make CC=emcc TARGET=jabcodeWriter.js
```

### Output Files

After successful compilation, you'll have:
- `jabcodeReader.js` and `jabcodeReader.wasm` - WebAssembly JABCode decoder
- `jabcodeWriter.js` and `jabcodeWriter.wasm` - WebAssembly JABCode encoder

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

### JABCode

This project uses JABCode, which is licensed under the GNU Lesser General Public License v3 (LGPLv3) with a static linking exception.

**Copyright Notice:**
```
libjabcode - JABCode Encoding/Decoding Library

Copyright 2016 by Fraunhofer SIT. All rights reserved.

Contact: Huajian Liu <liu@sit.fraunhofer.de>
         Waldemar Berchtold <waldemar.berchtold@sit.fraunhofer.de>
```

**License:** LGPLv3 with special exception for static/dynamic linking

The JABCode library includes a special exception to LGPLv3 that permits conveying a Combined Work (your application) that links statically or dynamically to the library without providing Minimal Corresponding Source, provided you comply with other LGPLv3 provisions and your application's own license terms.

Full JABCode license: https://github.com/jabcode/jabcode/blob/master/LICENSE

### Third-Party Dependencies

This project uses the following libraries through Emscripten:
- **libpng** - PNG reference library (http://www.libpng.org/)
- **zlib** - Compression library (https://www.zlib.net/)
- **libtiff** - TIFF library (http://www.libtiff.org/)

These libraries are dynamically linked through Emscripten and are not modified or redistributed as part of this project. Users should refer to the original library licenses for terms of use.