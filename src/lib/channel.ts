/**
 * Which build this is: the stable release, the development preview, or a fixed evaluation snapshot.
 * Set at build time with VITE_CHANNEL=dev or VITE_CHANNEL=eval. All three can be hosted on the same
 * origin (…/Travel_App/, …/Travel_App/dev/ and …/Travel_App/eval/), so the dev and eval builds use their
 * own database and data-file names: a newer schema can never upgrade, and break, another version's data.
 */
export type Channel = 'stable' | 'dev' | 'eval';
const requested = import.meta.env.VITE_CHANNEL;
export const CHANNEL: Channel = requested === 'dev' || requested === 'eval' ? requested : 'stable';
export const IS_DEV_CHANNEL = CHANNEL === 'dev';
export const IS_EVAL_CHANNEL = CHANNEL === 'eval';

/** Suffix for storage names: '' for stable (keeps existing data), '-dev' for dev, '-eval' for evaluation. */
export const STORAGE_SUFFIX = CHANNEL === 'stable' ? '' : `-${CHANNEL}`;
