var _wasmReady = false;

var Module = {
  print: function(t) { self.postMessage({ type: 'stdout', text: t }); },
  printErr: function(t) { console.warn('[decoder worker]', t); },
  onRuntimeInitialized: function() {
    _wasmReady = true;
    self.postMessage({ type: 'ready' });
  },
  locateFile: function(path) { return '/assets/' + path; }
};

importScripts('/assets/jabcodeReader.js');

self.onmessage = function(e) {
  if (!_wasmReady) return;

  var id = e.data.id;
  var name = '_r' + id + '.png';
  
  try {
    FS.writeFile(name, e.data.pngData);
    callMain([name]);
    FS.unlink(name);
    self.postMessage({ type: 'done', id: id });
  } catch (err) {
    self.postMessage({ type: 'done', id: id, error: err.message });
  }
};