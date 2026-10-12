export { OrientationTab } from "./components/OrientationTab";
// `DEFAULT_ORIENTATION_TOPICS` is deliberately NOT re-exported here (todo 11):
// it is the todo-6 SEED source only — `catalogSeed.ts` imports
// `./orientationSeed` directly. Topics at runtime come from the DB via
// `./orientationStore`.
export {
  TRACK_OWNER,
  findTopic,
  listTopics,
  orientationTopicCode,
  patchTopic,
  upsertTopic,
} from "./orientationStore";
export {
  ORIENTATION_ERROR_CODES,
  checkOffOrientationTopic,
  computeOrientationDone,
  getOrientationState,
  isOrientationDone,
} from "./orientation-task-service";
export { listOrientationEmployees } from "./orientationRoster";
export type {
  CheckOffOrientationResult,
  OrientationState,
} from "./orientation-task-service";
export { OrientationFetchProvider, useOrientationFetch } from "./providers/orientationProvider";
export { useOrientation } from "./hooks/useOrientation";
export type {
  CheckOffOrientationInput,
  CreateOrientationTopicInput,
  OrientationCheck,
  OrientationEmployee,
  OrientationRole,
  OrientationTopic,
  OrientationTrack,
  UpdateOrientationTopicInput,
} from "./types/orientation.schema";
export { ORIENTATION_TRACKS } from "./types/orientation.schema";
