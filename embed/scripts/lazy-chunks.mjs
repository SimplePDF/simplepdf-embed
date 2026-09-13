// The chunks the built entries only `import()` lazily, keyed by their un-hashed name
// prefix: the gzip budget each closure must stay under (check-bundle-size.mjs) and the
// export the chunk must expose when loaded in either module format (check-lazy-chunks.mjs).
export const LAZY_CHUNKS = {
  'webmcp-': { budgetBytes: 5 * 1024, exportName: 'registerWebMCPTools' },
}
