const registry = [
  { id: 0x0001, mime: 'text/plain',                ext: 'txt'  },
  { id: 0x0002, mime: 'text/html',                 ext: 'html' },
  { id: 0x0003, mime: 'text/csv',                  ext: 'csv'  },
  { id: 0x0010, mime: 'image/png',                 ext: 'png'  },
  { id: 0x0011, mime: 'image/jpeg',                ext: 'jpg'  },
  { id: 0x0012, mime: 'image/gif',                 ext: 'gif'  },
  { id: 0x0013, mime: 'image/webp',                ext: 'webp' },
  { id: 0x0014, mime: 'image/svg+xml',             ext: 'svg'  },
  { id: 0x0020, mime: 'application/pdf',           ext: 'pdf'  },
  { id: 0x0021, mime: 'application/zip',           ext: 'zip'  },
  { id: 0x0022, mime: 'application/json',          ext: 'json' },
  { id: 0x0023, mime: 'application/msword',        ext: 'doc'  },
  { id: 0x0024, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  { id: 0x0030, mime: 'audio/mpeg',                ext: 'mp3'  },
  { id: 0x0031, mime: 'audio/wav',                 ext: 'wav'  },
  { id: 0x0040, mime: 'video/mp4',                 ext: 'mp4'  },
  { id: 0x00FF, mime: 'application/octet-stream',  ext: 'bin'  },
]

const byExt = Object.fromEntries(registry.map(t => [t.ext, t]))
const byId  = Object.fromEntries(registry.map(t => [t.id,  t]))

export const getIdFromFilename = (name) => {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return byExt[ext]?.id ?? 0x00FF
}

export const getMimeFromId = (id) => byId[id]?.mime ?? 'application/octet-stream'
export const getExtFromId  = (id) => byId[id]?.ext  ?? 'bin'