/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEMMY_INSTANCE_URL: string;
  readonly VITE_BACKEND_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
