# Bergamot translator (local translation)

`translator.js`, `worker/*` come from the npm package `@browsermt/bergamot-translator` 0.4.9 (MPL-2.0,
https://github.com/browsermt/bergamot-translator). One change: `worker/translator-worker.js` falls back to reading the
bytes of the wasm file when it is not served with the type `application/wasm`.

`registry.json` is the list of language models published by the project (https://bergamot.s3.amazonaws.com/models/index.json).
The models themselves (about 35 MB per language pair) are downloaded when the player asks for them (Settings -> Translator)
and kept in the browser cache of the app.
