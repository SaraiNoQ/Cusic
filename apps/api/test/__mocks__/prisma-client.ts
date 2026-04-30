// Prisma client mock — provides the minimal type surface needed by
// any source files that re-export Prisma types (e.g. auth.service.ts).
// Integration tests mock services directly so the Prisma module never
// executes; this stub just satisfies ts-jest compilation.
export const Prisma = {};
export const IdentityType = {};
export const UserStatus = {};
export const ChatRole = {};
export const MessageType = {};
export const PlaylistType = {};
export const SessionMode = {};
export const JobStatus = {};
export const JobType = {};
export const ContentType = {};
export const EventType = {};
export const FeedbackType = {};
export const RecommendationType = {};
export const SourceType = {};

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PrismaClient {
  // Stub constructor — never called in integration tests
}
