// Node 18 exposes a partial globalThis.crypto without getRandomValues, which
// newer Vite needs at config-resolve time. Provide the full webcrypto impl.
const nodeCrypto = require("node:crypto");
const { webcrypto } = nodeCrypto;

// (1) globalThis.crypto is a getter-only prop on Node 18 — define it explicitly.
if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== "function") {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true, writable: true });
}

// (2) Vite 5.4 calls getRandomValues directly on the node:crypto module, which
// only exists in Node 19+. Patch it onto the module for Node 18.
if (typeof nodeCrypto.getRandomValues !== "function") {
  nodeCrypto.getRandomValues = (arr) => webcrypto.getRandomValues(arr);
}
