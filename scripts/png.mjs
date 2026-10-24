// 只做上架素材用到的那一塊: 8-bit 非交錯 PNG 的讀寫 (灰階 / RGB / 調色盤 / RGBA)
// 為了不在這個 repo 裝 image 套件, 幾十行自己寫。
import { deflateSync, inflateSync } from 'node:zlib'

const CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

export function encode(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // 每條掃描線前面補 filter byte 0
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

// 回傳 { w, h, rgba }
export function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG')
  let w = 0
  let h = 0
  let colorType = 0
  let channels = 0
  let palette = null
  let trns = null
  const idat = []
  for (let i = 8; i < buf.length; ) {
    const len = buf.readUInt32BE(i)
    const type = buf.toString('ascii', i + 4, i + 8)
    const data = buf.subarray(i + 8, i + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      colorType = data[9]
      channels = CHANNELS[colorType]
      if (data[8] !== 8 || data[12] !== 0 || !channels) throw new Error(`不支援的 PNG (bitDepth ${data[8]}, colorType ${colorType}, interlace ${data[12]})`)
    } else if (type === 'PLTE') palette = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    i += 12 + len
  }

  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * channels
  const out = Buffer.alloc(h * stride) // 反濾波完的像素
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const row = out.subarray(y * stride, (y + 1) * stride)
    const up = y ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0
      const b = up ? up[x] : 0
      const c = up && x >= channels ? up[x - channels] : 0
      let v = src[x]
      if (ft === 1) v += a
      else if (ft === 2) v += b
      else if (ft === 3) v += (a + b) >> 1
      else if (ft === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[x] = v & 0xff
    }
  }

  const rgba = Buffer.alloc(w * h * 4)
  for (let i = 0, o = 0; i < w * h; i++, o += 4) {
    const s = i * channels
    if (colorType === 3) {
      const k = out[s]
      rgba[o] = palette[k * 3]
      rgba[o + 1] = palette[k * 3 + 1]
      rgba[o + 2] = palette[k * 3 + 2]
      rgba[o + 3] = trns && k < trns.length ? trns[k] : 255
    } else if (colorType === 0) {
      rgba[o] = rgba[o + 1] = rgba[o + 2] = out[s]
      rgba[o + 3] = 255
    } else if (colorType === 4) {
      rgba[o] = rgba[o + 1] = rgba[o + 2] = out[s]
      rgba[o + 3] = out[s + 1]
    } else if (colorType === 2) {
      rgba[o] = out[s]
      rgba[o + 1] = out[s + 1]
      rgba[o + 2] = out[s + 2]
      rgba[o + 3] = 255
    } else {
      out.copy(rgba, o, s, s + 4)
    }
  }
  return { w, h, rgba }
}
