/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ペアリング用 Cloudflare Worker の URL(例: https://xxx.workers.dev)。未設定ならリモコン連携は無効 */
  readonly VITE_PAIRING_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
