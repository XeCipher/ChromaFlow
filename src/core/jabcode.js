// State
let _writerReady = false
let _readerReady = false
let _capturedOutput = ''

// Writer
export function loadWriter() {
  if (_writerReady) return Promise.resolve()

  return new Promise((resolve, reject) => {
    window.Module = {
      print: (text) => { console.log('[jabcodeWriter]', text) },
      printErr: (text) => { console.warn('[jabcodeWriter err]', text) },
      onRuntimeInitialized: () => {
        _writerReady = true
        resolve()
      }
    }

    const script = document.createElement('script')
    script.src = '/assets/jabcodeWriter.js'
    script.onerror = () => reject(new Error('Failed to load jabcodeWriter.js'))
    document.head.appendChild(script)
  })
}

// Encode one chunk → PNG bytes
let _encodeCounter = 0

export function encodeChunk(frameString, opts = {}) {
  if (!_writerReady) throw new Error('Writer WASM not loaded')

  _encodeCounter++
  const outName = `_cf_out_${_encodeCounter}.png`

  const args = ['--input', frameString, '--output', outName]

  if (opts.colorNumber) args.push('--color-number', String(opts.colorNumber))
  if (opts.moduleSize)  args.push('--module-size',  String(opts.moduleSize))
  if (opts.symbolWidth  > 0) args.push('--symbol-width',  String(opts.symbolWidth))
  if (opts.symbolHeight > 0) args.push('--symbol-height', String(opts.symbolHeight))
  if (opts.eccLevel)    args.push('--ecc-level',    String(opts.eccLevel))

  window.callMain(args)

  const pngData = window.FS.readFile(outName)
  window.FS.unlink(outName)

  return pngData  // Uint8Array
}

// Reader
export function loadReader() {
  if (_readerReady) return Promise.resolve()

  return new Promise((resolve, reject) => {
    window.Module = {
      print: (text) => {
        _capturedOutput += (_capturedOutput ? '\n' : '') + text
      },
      printErr: (text) => { console.warn('[jabcodeReader err]', text) },
      onRuntimeInitialized: () => {
        _readerReady = true
        resolve()
      }
    }

    const script = document.createElement('script')
    script.src = '/assets/jabcodeReader.js'
    script.onerror = () => reject(new Error('Failed to load jabcodeReader.js'))
    document.head.appendChild(script)
  })
}

// Decode one PNG → raw output string
let _scanCounter = 0

export function decodeImage(pngData) {
  if (!_readerReady) throw new Error('Reader WASM not loaded')

  _scanCounter++
  const fsName = `_scan_${_scanCounter}.png`

  window.FS.writeFile(fsName, pngData)
  _capturedOutput = ''

  try {
    window.callMain([fsName])
  } catch (_) {
    // decode miss — normal for frames without a valid JABCode
  }

  window.FS.unlink(fsName)

  // Return the last non-empty line of output
  const lines = _capturedOutput.trim().split('\n')
  return lines[lines.length - 1] ?? ''
}