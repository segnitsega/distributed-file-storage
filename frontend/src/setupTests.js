import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

globalThis.fetch = vi.fn((input) => {
  const url = typeof input === 'string' ? input : input.url
  if (url.includes('/nodes/status')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ nodes: [], cluster: null }),
    })
  }
  if (url.includes('/files')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          files: [],
          policy: { replicationFactor: 3 },
        }),
    })
  }
  return Promise.resolve({
    ok: false,
    status: 404,
    text: async () => '',
  })
})
