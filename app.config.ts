import { defineConfig } from '@solidjs/start/config';

export default defineConfig({
  server: {
    experimental: {
      websocket: true,
    },
  },
}).addRouter({
  name: 'ws',
  type: 'http',
  handler: './src/server/websocket.ts',
  target: 'server',
  base: '/game',
});
