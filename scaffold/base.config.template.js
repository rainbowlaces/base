// Framework build configuration (optional tweaks)
export default {
  client: {
    entryPoint: 'src/client/loader.ts',
    tsconfig: 'tsconfig.client.json',
    assets: ['src/public/*'],
    outputBundle: 'public/bundle.js'
  },
  server: {
    ignore: ['src/client/**']
  }
};
