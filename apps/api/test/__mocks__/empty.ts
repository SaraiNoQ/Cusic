// Empty module stub — used by jest moduleNameMapper to prevent ts-jest
// from resolving heavy runtime dependencies (pgvector, Redis, BullMQ, etc.)
// during integration tests. Tests mock services directly so these modules
// never execute.
export {};
