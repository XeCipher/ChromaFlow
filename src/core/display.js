// ChromaFlow Display Profiling
// ─────────────────────────────────────────────────────────────────────────────
// The core idea: given a screen, keep module size at the minimum viable size
// (4px) and fit as many modules as possible. More modules = more data per frame.
//
// This is the correct interpretation of the paper's display-adaptive approach:
// maximise data density by packing the symbol to fill the available viewport.
//
// Equations (from paper):
//   Weff = floor(Wd / rho)
//   Heff = floor(Hd / rho)
//
// Extended for rectangle fill:
//   modulesX = floor(Weff / minModuleSize)
//   modulesY = floor(Heff / minModuleSize)
//   symbolW  = modulesX * minModuleSize   (≈ Weff)
//   symbolH  = modulesY * minModuleSize   (≈ Heff)
//
// Capacity estimate:
//   C_raw = modulesX * modulesY * log2(colorCount) bits
//   C_payload ≈ C_raw * 0.7 / 8 bytes   (30% ECC overhead)

export const MIN_MODULE_SIZE = 4   // px — below this modules blur under camera
export const DEFAULT_MODULE_SIZE = 12  // px — safe manual default

export function getDisplayProfile() {
  const Wd  = window.screen.width
  const Hd  = window.screen.height
  const rho = window.devicePixelRatio || 1

  const Weff = Math.floor(Wd / rho)
  const Heff = Math.floor(Hd / rho)

  return { Wd, Hd, rho, Weff, Heff }
}

// Compute how many modules fit on the screen at the given module size
export function computeAdaptiveGrid(Weff, Heff, moduleSize = MIN_MODULE_SIZE) {
  // JABCode only supports square symbols
  // Use the shorter dimension to ensure the symbol fits on screen
  const squareSize = Math.min(Weff, Heff)
  const modules    = Math.floor(squareSize / moduleSize)
  const symbolSize = modules * moduleSize
  const totalMods  = modules * modules

  return {
    modulesX:  modules,
    modulesY:  modules,
    symbolW:   symbolSize,
    symbolH:   symbolSize,
    totalMods,
  }
}

// Estimate usable payload bytes per frame
// colorCount: 4 or 8 (JABCode parameter)
// eccOverhead: fraction lost to Reed-Solomon (default 30%)
export function estimateCapacity(totalModules, colorCount = 8, eccOverhead = 0.3) {
  const bitsPerModule = Math.log2(colorCount)
  const rawBits       = totalModules * bitsPerModule
  const usableBits    = rawBits * (1 - eccOverhead)
  const bytes         = Math.floor(usableBits / 8)
  // Cap at 4096 bytes — WASM CLI arg limit when base64 encoded
  return Math.min(bytes, 4096)
}

// For the square mode (original paper formula)
export function computeModuleSize(numModules, Weff, Heff, minPx = MIN_MODULE_SIZE) {
  if (!numModules || numModules <= 0) return minPx
  const m = Math.floor(Math.min(Weff / numModules, Heff / numModules))
  return Math.max(m, minPx)
}
