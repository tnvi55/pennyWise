/// <reference types="vite/client" />

// Typed access to the public VITE_* variables. Everything here ends up in browser JavaScript.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
