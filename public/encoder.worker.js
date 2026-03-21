// ChromaFlow encoder worker
// Runs in an isolated Worker scope — no variable conflicts with the main window.
// A fresh worker is spawned every N frames to prevent WASM heap accumulation.

var _wasmReady = false;

var Module = {
  print:    function() {},
  printErr: function(t) { console.warn('[worker writer]', t); },
  onRuntimeInitialized: function() { _wasmReady = true; },
  locateFile: function(path) {
    return '/assets/' + path;
  }
};

importScripts('/assets/jabcodeWriter.js');

function waitForWasm() {
  return new Promise(function(resolve) {
    if (_wasmReady) return resolve();
    var check = setInterval(function() {
      if (_wasmReady) { clearInterval(check); resolve(); }
    }, 50);
  });
}

self.onmessage = async function(e) {
  await waitForWasm();

  var frameStr = e.data.frameStr;
  var opts     = e.data.opts;
  var id       = e.data.id;
  var outName  = '_w' + id + '.png';

  var args = ['--input', frameStr, '--output', outName];

  if (opts.colorNumber) args.push('--color-number', String(opts.colorNumber));

  if ((opts.symbolWidth || 0) > 0 && (opts.symbolHeight || 0) > 0) {
    args.push('--symbol-width',  String(opts.symbolWidth));
    args.push('--symbol-height', String(opts.symbolHeight));
  } else {
    if (opts.moduleSize) args.push('--module-size', String(opts.moduleSize));
  }

  if (opts.eccLevel) args.push('--ecc-level', String(opts.eccLevel));

  try {
    callMain(args);
    var png = FS.readFile(outName);
    FS.unlink(outName);
    // Transfer the buffer to avoid copying
    self.postMessage({ success: true, png: png, id: id }, [png.buffer]);
  } catch(err) {
    self.postMessage({ success: false, error: err.message, id: id });
  }
};
