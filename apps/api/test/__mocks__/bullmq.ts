// Stub for bullmq — used by jest moduleNameMapper to prevent ts-jest
// from resolving the real bullmq package during integration tests.
// The imports chain goes through imports.queue.ts which does a named
// import of { Queue }.

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Queue<T = any> {
  // Stub constructor — never called in integration tests
}
