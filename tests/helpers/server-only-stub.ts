// Test-only stub: the real "server-only" package unconditionally throws
// unless a bundler (webpack/Turbopack) swaps it out for Server Components.
// Under plain Node (Vitest) there is no such bundler step, so we alias it
// to this no-op — see vitest.config.ts.
export {};
