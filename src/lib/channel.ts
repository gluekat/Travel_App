/**
 * Which build this is: the stable release or the development preview.
 * Set at build time with VITE_CHANNEL=dev. Both can be hosted on the same
 * origin (…/Travel_App/ and …/Travel_App/dev/), so the dev build uses its own
 * database and data-file names: a newer dev schema can never upgrade, and
 * break, the stable version's data.
 */
export const CHANNEL: 'stable' | 'dev' = import.meta.env.VITE_CHANNEL === 'dev' ? 'dev' : 'stable';
export const IS_DEV_CHANNEL = CHANNEL === 'dev';

/** Suffix for storage names: '' for stable (keeps existing data), '-dev' for dev. */
export const STORAGE_SUFFIX = IS_DEV_CHANNEL ? '-dev' : '';
