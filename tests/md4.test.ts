import { describe, it, expect } from 'vitest'
import { md4 } from '../src/ntlm/md4'

const hex = (s: string) => md4(Buffer.from(s, 'utf8')).toString('hex')

describe('md4', () => {
  // RFC 1320 Appendix A.5 test suite
  it('matches RFC 1320 vectors', () => {
    expect(hex('')).toBe('31d6cfe0d16ae931b73c59d7e0c089c0')
    expect(hex('a')).toBe('bde52cb31de33e46245e05fbdbd6fb24')
    expect(hex('abc')).toBe('a448017aaf21d8525fc10ae87aa6729d')
    expect(hex('message digest')).toBe('d9130a8164549fe818874806e1c7014b')
    expect(hex('abcdefghijklmnopqrstuvwxyz')).toBe(
      'd79e1c308aa5bbcdeea8ed63df412da9'
    )
    expect(
      hex('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')
    ).toBe('043f8582f241db351ce627e153e7f0e4')
    expect(
      hex(
        '12345678901234567890123456789012345678901234567890123456789012345678901234567890'
      )
    ).toBe('e33b4ddc9c38f2199c3e7b164fcc0536')
  })


  it('computes the NT hash of "Password" (MS-NLMP 4.2.1)', () => {
    const nt = md4(Buffer.from('Password', 'utf16le')).toString('hex')
    expect(nt).toBe('a4f49c406510bdcab6824ee7c30fd852')
  })
})
