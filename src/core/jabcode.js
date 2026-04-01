import { buildBinaryHeader, parseBinaryHeader } from './header'

export function buildFrame(isInitial, totalCodes, codeIndex, payloadBytes, filename) {
  return buildBinaryHeader(isInitial, totalCodes, codeIndex, payloadBytes, filename)
}

export function parseFrame(bytes) {
  return parseBinaryHeader(bytes)
}

let _engineReady = false;
let _encode = null;
let _decode = null;
let _free = null;

// Replaces both loadWriter and loadReader
export function loadEngine() {
  if (_engineReady) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // If it's already in the DOM, just wait for it to initialize
    if (document.querySelector('script[src="/assets/chromaflow.js"]')) {
      const check = setInterval(() => {
        if (window.Module && window.Module._cf_encode) {
          clearInterval(check);
          bindExports();
          resolve();
        }
      }, 50);
      return;
    }

    // Inject the script
    window.Module = {
      print: function(t) { console.log(t); },
      printErr: function(t) { console.warn(t); },
      onRuntimeInitialized: function() {
        bindExports();
        resolve();
      }
    };

    const s = document.createElement('script');
    s.src = '/assets/chromaflow.js';
    s.onerror = () => reject(new Error('Failed to load chromaflow.js'));
    document.head.appendChild(s);
  });
}

function bindExports() {
  _encode = window.Module.cwrap('cf_encode', 'number', ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']);
  _decode = window.Module.cwrap('cf_decode', 'number', ['number', 'number', 'number']);
  _free   = window.Module.cwrap('cf_free', null, ['number']);
  _engineReady = true;
}

// Aliases for compatibility with the UI components
export const loadWriter = loadEngine;
export const loadReader = loadEngine;
export const resetFrameCount = () => {};

// Encode raw bytes into a JABCode PNG using direct memory access.
export async function encodeFrame(data, opts = {}) {
  if (!_engineReady) throw new Error('Engine not ready');
  
  const {
    colorNumber  = 8,
    moduleSize   = 12,
    symbolWidth  = 0,
    symbolHeight = 0,
    eccLevel     = 0,
  } = opts;

  const dataPtr = window.Module._malloc(data.length);
  window.Module.HEAPU8.set(data, dataPtr);

  const outLenPtr = window.Module._malloc(4);
  window.Module.HEAP32[outLenPtr >> 2] = 0;

  const pngPtr = _encode(
    dataPtr, data.length,
    colorNumber, moduleSize,
    symbolWidth, symbolHeight,
    eccLevel,
    outLenPtr
  );

  window.Module._free(dataPtr);

  if (pngPtr === 0) {
    window.Module._free(outLenPtr);
    throw new Error('cf_encode returned NULL — encoding failed');
  }

  const pngLen = window.Module.HEAP32[outLenPtr >> 2];
  window.Module._free(outLenPtr);

  // Copy bytes out of WASM heap, then free the C memory
  const result = new Uint8Array(window.Module.HEAPU8.slice(pngPtr, pngPtr + pngLen));
  _free(pngPtr);
  
  return result;
}

// Decode a JABCode PNG and return the raw payload bytes using direct memory access.
export async function decodeImage(pngData) {
  if (!_engineReady) throw new Error('Engine not ready');

  const pngPtr = window.Module._malloc(pngData.length);
  window.Module.HEAPU8.set(pngData, pngPtr);

  const outLenPtr = window.Module._malloc(4);
  window.Module.HEAP32[outLenPtr >> 2] = 0;

  const outPtr = _decode(pngPtr, pngData.length, outLenPtr);

  window.Module._free(pngPtr);

  if (outPtr === 0) {
    window.Module._free(outLenPtr);
    return null; // Decode miss
  }

  const outLen = window.Module.HEAP32[outLenPtr >> 2];
  window.Module._free(outLenPtr);

  const result = new Uint8Array(window.Module.HEAPU8.slice(outPtr, outPtr + outLen));
  _free(outPtr);
  
  return result;
}