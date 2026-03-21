// ChromaFlow Display Profiling
// ─────────────────────────────────────────────────────────────────────────────
// The core idea: given a screen, keep module size at the minimum viable size
// and fit as many modules as possible. More modules = more data per frame.
//
// Equations (from paper):
//   Weff = floor(Wd / rho)
//   Heff = floor(Hd / rho)
//
// Square fill:
//   squareSize = min(Weff, Heff)
//   modules    = floor(squareSize / minModuleSize)
//   symbolSize = modules * minModuleSize
//
// Capacity estimate:
//   C_raw     = modules² × log2(colorCount) bits
//   C_payload ≈ C_raw × (1 - eccOverhead) / 8 / base64Inflation bytes

export const MIN_MODULE_SIZE     = 10    // px — minimum for reliable laptop scanning
export const DEFAULT_MODULE_SIZE = 12    // px — safe manual default

// JABCode valid module counts: 21, 25, 29 ... 145 (step of 4 from 21)
const JABCODE_MIN_MODULES = 21
const JABCODE_MAX_MODULES = 145

// Minimum chunk size to prevent absurd frame counts on high-DPR phones
const MIN_CHUNK_BYTES = 200

export function getDisplayProfile() {
  const Wd  = window.screen.width
  const Hd  = window.screen.height
  const rho = window.devicePixelRatio || 1

  const Weff = Math.floor(Wd / rho)
  const Heff = Math.floor(Hd / rho)

  return { Wd, Hd, rho, Weff, Heff }
}

// Compute adaptive grid.
// On high-DPR phones (e.g. iPhone DPR=3, Weff=130px), the raw module count
// would be floor(130/10)=13 — below JABCode's minimum of 21. In that case
// we snap up to 21 and recompute a smaller module size to fit.
// On laptops (Weff=1344px) the raw count is 134, well within range, so
// behaviour is identical to before.
export function computeAdaptiveGrid(Weff, Heff, moduleSize = MIN_MODULE_SIZE) {
  const squareSize = Math.min(Weff, Heff)
  let modules = Math.floor(squareSize / moduleSize)

  // Snap to JABCode valid range
  if (modules < JABCODE_MIN_MODULES) {
    // Screen is too small for MIN_MODULE_SIZE at 21 modules.
    // Use 21 modules and shrink module size to fit.
    modules = JABCODE_MIN_MODULES
    moduleSize = Math.max(4, Math.floor(squareSize / JABCODE_MIN_MODULES))
  } else if (modules > JABCODE_MAX_MODULES) {
    modules = JABCODE_MAX_MODULES
  }

  const symbolSize = modules * moduleSize
  const totalMods  = modules * modules

  return {
    modulesX:   modules,
    modulesY:   modules,
    symbolW:    symbolSize,
    symbolH:    symbolSize,
    totalMods,
    moduleSize, // actual module size used (may differ from input on small screens)
  }
}

// Estimate usable payload bytes per frame.
// Returns at least MIN_CHUNK_BYTES to prevent thousands of frames on
// high-DPR phones where effective screen area is small.
export function estimateCapacity(symbolW, symbolH, moduleSize, colorCount = 8, eccLevel = 3) {
  const modulesX    = Math.floor(symbolW / moduleSize)
  const modulesY    = Math.floor(symbolH / moduleSize)
  const totalMods   = modulesX * modulesY
  const bitsPerMod  = Math.log2(colorCount)
  const eccOverhead = 0.1 + (eccLevel * 0.03)   // level 1≈13%, level 3≈19%
  const usableBytes = Math.floor((totalMods * bitsPerMod * (1 - eccOverhead)) / 8)
  const safeBytes   = Math.floor(usableBytes / 1.33)  // base64 inflation factor
  return Math.min(Math.max(safeBytes, MIN_CHUNK_BYTES), 65535)
}

// For the square mode (original paper formula, kept for compatibility)
export function computeModuleSize(numModules, Weff, Heff, minPx = MIN_MODULE_SIZE) {
  if (!numModules || numModules <= 0) return minPx
  const m = Math.floor(Math.min(Weff / numModules, Heff / numModules))
  return Math.max(m, minPx)
}
