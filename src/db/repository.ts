// Barrel re-export for the repository layer. This is the only module the
// rest of the app should import from when it needs persisted data —
// components never talk to IndexedDB directly. The actual implementations
// live in the sibling *.repo.ts files, split by concern (commitments, day
// records, timer, settings, export/import) so each file stays focused;
// this barrel preserves the original single-import surface
// (`import * as repo from '../db/repository'`) that AppContext and the
// repository tests already rely on.

export * from './commitments.repo';
export * from './dayRecords.repo';
export * from './timer.repo';
export * from './settings.repo';
export * from './exportImport.repo';

// `resolveTrackingType` is domain logic (not data access) and now lives in
// domain/habit/, but it's re-exported here too since existing callers/tests
// import it from this module.
export { resolveTrackingType } from '../domain/habit';
