/**
 * MD4 message digest (RFC 1320).
 *
 * Node's `crypto` no longer exposes MD4 under OpenSSL 3 (it lives in the
 * legacy provider), but NTLM's NT hash is `MD4(UTF-16LE(password))`, so a
 * self-contained implementation is required. Pure Buffer/Uint32 math, no
 * dependencies.
 */

const K2 = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15]
const K3 = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]
const S1 = [3, 7, 11, 19]
const S2 = [3, 5, 9, 13]
const S3 = [3, 9, 11, 15]

function rotl(x: number, s: number): number {
  return ((x << s) | (x >>> (32 - s))) >>> 0
}

function F(x: number, y: number, z: number): number {
  return (x & y) | (~x & z)
}

function G(x: number, y: number, z: number): number {
  return (x & y) | (x & z) | (y & z)
}

function H(x: number, y: number, z: number): number {
  return x ^ y ^ z
}

export function md4(input: Buffer): Buffer {
  const msgLen = input.length
  // Pad to a multiple of 64 bytes, leaving room for 0x80 and a 64-bit length.
  const padLen = (((msgLen + 8) >> 6) + 1) << 6
  const buf = Buffer.alloc(padLen)
  input.copy(buf)
  buf[msgLen] = 0x80
  buf.writeBigUInt64LE(BigInt(msgLen) * 8n, padLen - 8)

  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476

  const X = new Uint32Array(16)

  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) X[i] = buf.readUInt32LE(off + i * 4)

    const aa = a
    const bb = b
    const cc = c
    const dd = d

    for (let i = 0; i < 16; i++) {
      const t = rotl((a + F(b, c, d) + X[i]) >>> 0, S1[i & 3])
      a = d
      d = c
      c = b
      b = t
    }
    for (let i = 0; i < 16; i++) {
      const t = rotl((a + G(b, c, d) + X[K2[i]] + 0x5a827999) >>> 0, S2[i & 3])
      a = d
      d = c
      c = b
      b = t
    }
    for (let i = 0; i < 16; i++) {
      const t = rotl((a + H(b, c, d) + X[K3[i]] + 0x6ed9eba1) >>> 0, S3[i & 3])
      a = d
      d = c
      c = b
      b = t
    }

    a = (a + aa) >>> 0
    b = (b + bb) >>> 0
    c = (c + cc) >>> 0
    d = (d + dd) >>> 0
  }

  const out = Buffer.alloc(16)
  out.writeUInt32LE(a, 0)
  out.writeUInt32LE(b, 4)
  out.writeUInt32LE(c, 8)
  out.writeUInt32LE(d, 12)
  return out
}
