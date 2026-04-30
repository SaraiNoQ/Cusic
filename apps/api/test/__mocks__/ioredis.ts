// Stub for ioredis — used by jest moduleNameMapper to prevent ts-jest
// from resolving the real ioredis package during integration tests.
// The imports chain goes through imports.queue.ts and system.controller.ts
// which do default imports (import IORedis from 'ioredis').
//
// With ts-jest's esModuleInterop, a default import from a module that has
// only named exports would receive the module namespace, so we provide both
// a default export and allow the module itself to act as a constructor stub.

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class IORedisStub {
  // Stub constructor — never called in integration tests
}

export default IORedisStub;
