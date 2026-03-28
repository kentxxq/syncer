/// <reference types="vite/client" />

import type { SyncerAPI } from '../../shared/types'

declare global {
  interface Window {
    api: SyncerAPI
  }
}
