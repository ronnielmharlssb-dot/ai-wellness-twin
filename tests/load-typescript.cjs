const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the actual TypeScript modules with isolated browser/provider dependencies.
function createLoader(globals = {}, overrides = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} };
    cache.set(filename, compiledModule);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      fileName: filename,
    }).outputText;
    function resolve(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith(".") || name.startsWith("@/")) {
        const base = name.startsWith("@/") ? path.resolve("src", name.slice(2)) : path.resolve(path.dirname(filename), name);
        const candidate = [base, `${base}.ts`, `${base}.tsx`].find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
        if (candidate) return load(candidate);
      }
      return require(name);
    }
    vm.runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require: resolve, console, process, Buffer,
      Date, Request, Response, AbortSignal, AbortController, TextDecoder, TextEncoder, URL, URLSearchParams, structuredClone, ...globals }, { filename });
    return compiledModule.exports;
  }
  return load;
}
function memoryStorage() {
  const entries = new Map();
  return { entries, get length() { return entries.size; }, key: index => [...entries.keys()][index] ?? null, getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)), removeItem: (key) => entries.delete(key) };
}
module.exports = { createLoader, memoryStorage, plain: (value) => JSON.parse(JSON.stringify(value)) };
