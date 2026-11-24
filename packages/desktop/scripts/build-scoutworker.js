// Builds the scout worker (renderer/lib/translator/scoutworker.ts) into renderer/public/scout/worker.js.
// Run it after changing scout.ts, ink.ts or scoutworker.ts: `npm run build:scoutworker`.
const path = require('path')
const esbuild = require('esbuild')

esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'renderer', 'lib', 'translator', 'scoutworker.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2019',
    minify: true,
    outfile: path.join(__dirname, '..', 'renderer', 'public', 'scout', 'worker.js'),
    logLevel: 'info',
}).catch(() => process.exit(1))
