# Bergamot translator (local translation)

`translator.js`, `worker/*` come from the npm package `@browsermt/bergamot-translator` 0.4.9 (MPL-2.0,
https://github.com/browsermt/bergamot-translator). One change: `worker/translator-worker.js` falls back to reading the
bytes of the wasm file when it is not served with the type `application/wasm`.

The lists of models are in `lib/translator/registries/`: `bergamot.json` (https://bergamot.s3.amazonaws.com/models/index.json) and `firefox.json` (the models of the Firefox translator, from Mozilla Remote Settings, collection `translations-models`).
The models themselves (about 35 MB per language pair) are downloaded when the player asks for them (Settings -> Translator)
and kept in the browser cache of the app.
