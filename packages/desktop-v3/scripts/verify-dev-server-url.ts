import { buildDevServerUrl, parseDevServerPort } from '../main/helpers/dev-server-url'

const valid = ['8888', '8080', '1', '65535', '3000']
const invalid = [
  undefined,
  '',
  '0',
  '65536',
  '99999',
  '-1',
  '8888@evil.com',
  '8888@evil.com/',
  '@evil.com',
  'evil.com',
  '8888/../admin',
  'https://evil.com',
  '//evil.com',
  '80abc',
  ' 8888',
  '8888 ',
  '8888\n',
  '0x1f',
  '8e3',
  '123456',
]

let failures = 0

const fail = (message: string) => {
  console.error(`FAIL ${message}`)
  failures++
}

for (const port of valid) {
  try {
    const parsed = parseDevServerPort(port)
    if (parsed !== Number(port)) {
      fail(`valid ${JSON.stringify(port)} parsed as ${parsed}`)
      continue
    }

    const url = buildDevServerUrl(port)
    const expected = `http://localhost:${port}/home`
    if (url.toString() !== expected) {
      fail(`valid ${JSON.stringify(port)} -> ${url.toString()} (expected ${expected})`)
      continue
    }

    console.log(`ok   valid   ${JSON.stringify(port)} -> ${url.toString()}`)
  } catch (error) {
    fail(`valid ${JSON.stringify(port)} threw: ${(error as Error).message}`)
  }
}

for (const port of invalid) {
  try {
    const url = buildDevServerUrl(port)
    fail(`invalid ${JSON.stringify(port)} was accepted -> ${url.toString()}`)
  } catch {
    console.log(`ok   invalid ${JSON.stringify(port)} rejected`)
  }
}

// The original implementation interpolated the argument straight into the URL,
// which allowed the host to be replaced by an attacker controlled one.
const exploit = '8888@evil.com'
const naive = `http://localhost:${exploit}/home`
console.log(`\nnaive interpolation of ${JSON.stringify(exploit)} -> ${naive}`)
console.log(`naive host -> ${new URL(naive).host}  <-- attacker controlled`)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
