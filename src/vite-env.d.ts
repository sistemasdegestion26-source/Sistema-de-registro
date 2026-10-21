/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SESSION_SIGNATURE_SALT?: string;
  readonly VITE_HASH_DG?: string;
  readonly VITE_HASH_PROY?: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
