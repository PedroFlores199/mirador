const presentation2Context = 'http://iiif.io/api/presentation/2/context.json';
const presentation3Context = 'http://iiif.io/api/presentation/3/context.json';

const isPlainObject = (val) => val !== null && typeof val === 'object' && !Array.isArray(val);

/**
 * Recursively merges plain objects while replacing arrays and primitives cleanly.
 */
export function deepMerge(target, ...sources) {
  const result = { ...target };

  sources.forEach((source) => {
    if (!isPlainObject(source)) return;

    Object.entries(source).forEach(([key, value]) => {
      if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    });
  });

  return result;
}

/**
 * Builds a minimal IIIF Presentation 2 manifest (or deep-merges overrides onto a v2 fixture).
 */
export function buildManifestV2({
  base = undefined,
  canvases = [{ '@id': 'canvas-1', '@type': 'sc:Canvas', label: 'Canvas 1' }],
  id = 'http://example.com/manifest',
  ...overrides
} = {}) {
  if (base) {
    return deepMerge(structuredClone(base), overrides);
  }

  return deepMerge(
    {
      '@context': presentation2Context,
      '@id': id,
      '@type': 'sc:Manifest',
      label: 'Test Manifest',
      sequences: [
        {
          '@type': 'sc:Sequence',
          canvases,
        },
      ],
    },
    overrides,
  );
}

/**
 * Builds a minimal IIIF Presentation 3 manifest (or deep-merges overrides onto a v3 fixture).
 */
export function buildManifestV3({
  base = undefined,
  id = 'http://example.com/manifest',
  items = [{ id: 'canvas-1', label: { en: ['Canvas 1'] }, type: 'Canvas' }],
  ...overrides
} = {}) {
  if (base) {
    return deepMerge(structuredClone(base), overrides);
  }

  return deepMerge(
    {
      '@context': presentation3Context,
      id,
      items,
      label: { en: ['Test Manifest'] },
      type: 'Manifest',
    },
    overrides,
  );
}

/** Default to Presentation 3 */
export const buildManifest = buildManifestV3;

/**
 * Builds a preloadedState object with a wired window, companionWindow, and manifest.
 */
export function buildState({
  companionWindowId = 'cw',
  manifestJson = buildManifest(),
  manifestId = manifestJson.id || manifestJson['@id'] || 'manifest',
  windowId = 'window',
  ...sliceOverrides
} = {}) {
  return deepMerge(
    {
      companionWindows: {
        [companionWindowId]: {
          id: companionWindowId,
          windowId,
        },
      },
      manifests: {
        [manifestId]: {
          id: manifestId,
          json: manifestJson,
        },
      },
      windows: {
        [windowId]: {
          id: windowId,
          manifestId,
        },
      },
    },
    sliceOverrides,
  );
}
