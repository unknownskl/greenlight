const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { readFileSync } = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')

// Exercise the production TS modules with in-memory Electron/network boundaries.
function load(relativePath, mocks = {}) {
    const filename = path.resolve(__dirname, '..', relativePath)
    const mod = new Module(filename, module)
    mod.filename = filename
    mod.paths = Module._nodeModulePaths(path.dirname(filename))
    const originalRequire = mod.require.bind(mod)
    mod.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : originalRequire(id)
    mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
        fileName: filename,
    }).outputText, filename)
    return mod.exports.default
}

const application = { log() {} }
const raw = (id, entitled = true) => ({ titleId: id, details: { productId: id, hasEntitlement: entitled } })
const product = (id) => ({ StoreId: id, XCloudTitleId: id, ProductTitle: `Game ${id}` })
const deferred = () => {
    let resolve, reject
    const promise = new Promise((yes, no) => { resolve = yes; reject = no })
    return { promise, resolve, reject }
}
const turn = () => new Promise(setImmediate)

test('overlapping tile requests receive only their own IPC response', async t => {
    t.mock.method(Math, 'random', () => 0.5)
    const ipc = new EventEmitter()
    const sent = []
    ipc.send = (channel, message) => sent.push(message)
    let bridge
    load('main/preload.ts', { electron: {
        ipcRenderer: ipc,
        contextBridge: { exposeInMainWorld(name, value) { bridge = value } },
    } })
    const first = bridge.send('xCloud', 'getTitle', { titleId: 'first' })
    const second = bridge.send('xCloud', 'getTitle', { titleId: 'second' })
    assert.notEqual(sent[0].id, sent[1].id)
    ipc.emit('xCloud', {}, { ...sent[1], data: { titleId: 'second' } })
    ipc.emit('xCloud', {}, { ...sent[0], data: { titleId: 'first' } })
    assert.deepEqual(await first, { titleId: 'first' })
    assert.deepEqual(await second, { titleId: 'second' })
    assert.equal(ipc.listenerCount('xCloud'), 0)
})

function createManager(cache = {}) {
    const store = { get: () => cache, set(key, value) { cache = value }, get cache() { return cache } }
    const TitleManager = load('main/helpers/titlemanager.ts', {
        'electron-store': class { constructor() { return store } },
        './http': class {},
    })
    return { manager: new TitleManager(application), store }
}

test('raw titles return immediately while catalog is stalled, then expose enrichment', async () => {
    const { manager } = createManager()
    const catalog = deferred()
    manager._http.post = () => catalog.promise
    const Ipc = load('main/ipc/xcloud.ts', {
        './base': load('main/ipc/base.ts'),
        '../helpers/titlemanager': class { constructor() { return manager } },
    })
    let requests = 0
    const ipc = new Ipc({ ...application, _xCloudApi: {
        async getTitles() { requests++; return { results: [raw('one')] } },
    } })
    const [first, second] = await Promise.all([ipc.getTitles(), ipc.getTitles()])
    assert.deepEqual(first, ['one'])
    assert.deepEqual(second, ['one'])
    assert.equal(requests, 1)
    const title = await Promise.race([ipc.getTitle({ titleId: 'one' }), turn().then(() => 'blocked')])
    assert.equal(title.titleId, 'one')
    assert.equal(title.catalogPending, true)
    catalog.resolve({ Products: { one: product('one') } })
    await manager.waitForCatalog()
    const enriched = await ipc.getTitle({ titleId: 'one' })
    assert.equal(enriched.catalogDetails.ProductTitle, 'Game one')
    assert.equal(enriched.catalogPending, false)
})

test('all titles receive metadata with at most three active batches despite a failure', async () => {
    const { manager, store } = createManager({ old: product('old') })
    const calls = []
    let active = 0, maximum = 0
    manager._http.post = (host, url, body) => {
        const request = deferred()
        active++
        maximum = Math.max(maximum, active)
        calls.push({ ids: body.Products, ...request })
        return request.promise.finally(() => active--)
    }
    const titles = Array.from({ length: 401 }, (_, i) => raw(String(i), i === 400))
    const refresh = manager.setCloudTitles({ results: titles })
    assert.equal(calls.length, 3)
    assert.equal(calls[0].ids[0], '400')
    calls[0].resolve({ Products: Object.fromEntries(calls[0].ids.map(id => [id, product(id)])) })
    await turn()
    assert.equal(manager.findTitle('400').catalogDetails.ProductTitle, 'Game 400')
    assert.equal(calls.length, 4)
    calls[1].reject(new Error('catalog unavailable'))
    calls[2].resolve({ Products: {} })
    await turn()
    for (const call of calls.slice(3)) {
        call.resolve({ Products: Object.fromEntries(call.ids.map(id => [id, product(id)])) })
    }
    await refresh
    assert.equal(maximum, 3)
    assert.equal(manager._catalogIsRefreshing, false)
    assert.equal(manager.getTitles(false).length, 401)
    assert.ok(manager.findTitle('399').catalogDetails)
    assert.equal(store.cache.old, undefined)
})

test('cache read failures do not prevent raw titles from becoming usable', async () => {
    const { manager } = createManager()
    manager._store.get = () => { throw new Error('unreadable cache') }
    manager._http.post = async () => { throw new Error('offline') }
    await manager.setCloudTitles({ results: [raw('one'), null, { titleId: 'no-details' }] })
    assert.equal(manager.findTitle('one').hasEntitlement, true)
    assert.equal(manager.findTitle('no-details').hasEntitlement, false)
    assert.equal(manager._catalogIsRefreshing, false)
})

test('cached metadata survives failed refreshes and obsolete refreshes cannot overwrite it', async () => {
    const { manager, store } = createManager({ one: product('one') })
    const old = deferred(), current = deferred()
    manager._http.post = () => old.promise
    const first = manager.setCloudTitles({ results: [raw('one')] })
    assert.equal(manager.findTitle('one').catalogDetails.ProductTitle, 'Game one')
    manager._http.post = () => current.promise
    const second = manager.setCloudTitles({ results: [raw('two')] })
    old.resolve({ Products: { one: product('one') } })
    await first
    assert.equal(manager._catalogIsRefreshing, true)
    current.resolve({ Products: { two: product('two') } })
    await second
    assert.deepEqual(Object.keys(store.cache), ['two'])
    assert.equal(manager.findTitle('one'), undefined)
    manager._http.post = async () => { throw new Error('offline') }
    await manager.setCloudTitles({ results: [raw('two')] })
    assert.equal(manager.findTitle('two').catalogDetails.ProductTitle, 'Game two')
    assert.deepEqual(Object.keys(store.cache), ['two'])
})

test('catalog requests reject on a connection deadline or aborted response', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    let respond
    const requests = []
    const Http = load('main/helpers/http.ts', { https: {
        request(options, callback) {
            respond = callback
            const req = new EventEmitter()
            req.write = req.end = () => {}
            req.destroy = (error) => { req.emit('error', error); req.emit('close') }
            requests.push(req)
            return req
        },
    } })
    const http = new Http(application)
    const deadline = assert.rejects(http.post('catalog', '/products'), /timed out/)
    t.mock.timers.tick(10000)
    await deadline
    const aborted = assert.rejects(http.post('catalog', '/products'), /aborted/)
    const response = new EventEmitter()
    respond(response)
    response.emit('aborted')
    requests[1].emit('close')
    await aborted
})

test('tiles and info pages render without metadata and poll only during enrichment', () => {
    const React = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    let data = { titleId: 'one', hasEntitlement: true, catalogPending: true }
    let options
    const mocks = {
        'next/link': ({ children, ...props }) => React.createElement('a', props, children),
        'next/image': (props) => React.createElement('img', props),
        'next/head': ({ children }) => React.createElement(React.Fragment, null, children),
        'next/router': { useRouter: () => ({ query: { titleid: 'one' } }) },
        'react-query': { useQuery(key, fn, config) { options = config; return { data, isFetched: true, isLoading: false } } },
        'react-i18next': { useTranslation: () => ({ t: key => key }) },
        '../../../lib/ipc': {},
        '../loader': () => 'loading',
        '../../../components/ui/loader': () => 'loading',
        '../../../components/ui/breadcrumbbar': ({ children }) => React.createElement('nav', null, children),
        '../../../components/ui/button': ({ label, disabled }) => React.createElement('button', { disabled }, label),
    }
    const Tile = load('renderer/components/ui/game/titledynamic.tsx', mocks)
    const Info = load('renderer/pages/xcloud/info/[titleid].tsx', mocks)
    for (const Component of [Tile, Info]) {
        const html = renderToStaticMarkup(React.createElement(Component, { titleId: 'one' }))
        assert.match(html, /\/stream\/xcloud_one/)
        assert.match(html, /\/images\/logo.png/)
        assert.equal(options.refetchInterval(data), 2000)
        assert.equal(options.refetchInterval({ ...data, catalogPending: false }), false)
    }
    data = { ...data, hasEntitlement: false }
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(Info)), /\/stream\/xcloud_one/)
    data = undefined
    const missingTile = renderToStaticMarkup(React.createElement(Tile, { titleId: 'missing' }))
    assert.match(missingTile, /\/xcloud\/info\/missing/)
    assert.doesNotMatch(missingTile, /loading|\/stream\/xcloud_missing/)
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(Info)))
})
