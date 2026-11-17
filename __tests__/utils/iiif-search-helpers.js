import { contentSearchMock } from '@tests/mocks/contentSearchMock';
import manifestFixtureFg165hz3589 from '@tests/fixtures/version-2/fg165hz3589.json';
import { buildManifestV2, buildManifestV3, buildState } from './build-state';

export const presentation2Context = 'http://iiif.io/api/presentation/2/context.json';
export const search1Context = 'http://iiif.io/api/search/1/context.json';
export const search2Context = 'http://iiif.io/api/search/2/context.json';
export const defaultSearchUrl = 'http://example.com/contentsearch';

export const defaultHit = {
  after: ', and start the chainsaw',
  annotations: ['foo'],
  before: 'Light up the',
  match: 'moose',
};

export const defaultResource = {
  '@id': 'foo',
  '@type': 'oa:Annotation',
  motivation: 'sc:painting',
  on: 'canvas-1',
};

/**
 * Builds an IIIF Content Search API 1.0 (AnnotationList) or 2.0 (AnnotationPage) JSON response.
 */
export function buildSearchResponse({
  hits = [defaultHit],
  id = defaultSearchUrl,
  next = undefined,
  resources = [defaultResource],
  searchVersion = 1,
  within = undefined,
} = {}) {
  if (searchVersion === 2) {
    const items =
      hits.length > 0
        ? hits.map((hit, idx) => {
            const res = resources[idx] || defaultResource;
            return {
              body: { type: 'TextualBody', value: `${hit.before} ${hit.match} ${hit.after}` },
              id: res['@id'] || res.id || `anno-${idx}`,
              motivation: 'highlighting',
              target: {
                selector: {
                  exact: hit.match,
                  prefix: hit.before,
                  suffix: hit.after,
                  type: 'TextQuoteSelector',
                },
                source: (res.on || 'canvas-1').split('#')[0],
                type: 'SpecificResource',
              },
              type: 'Annotation',
            };
          })
        : resources.map((res, idx) => ({
            id: res['@id'] || res.id || `anno-${idx}`,
            ...(res.label && { label: res.label }),
            motivation: 'highlighting',
            ...(res.on && { target: res.on }),
            type: 'Annotation',
          }));

    return {
      '@context': search2Context,
      id,
      items,
      ...(next && { next }),
      partOf: { id: defaultSearchUrl, total: items.length, type: 'AnnotationCollection' },
      type: 'AnnotationPage',
    };
  }

  return {
    '@context': [presentation2Context, search1Context],
    '@id': id,
    '@type': 'sc:AnnotationList',
    hits,
    resources,
    ...(next && { next }),
    ...(within && { within }),
  };
}

/**
 * Builds the `searches` Redux slice for a window + companionWindow.
 */
export function buildSearchSlice({
  companionWindowId = 'cw',
  hits = [defaultHit],
  isFetching = false,
  next = undefined,
  query = 'query',
  resources = [defaultResource],
  searchUrl = defaultSearchUrl,
  searchVersion = 1,
  selectedContentSearchAnnotationIds = [],
  windowId = 'window',
} = {}) {
  return {
    [windowId]: {
      [companionWindowId]: {
        data: query
          ? {
              [searchUrl]: {
                id: searchUrl,
                isFetching,
                json: buildSearchResponse({ hits, id: searchUrl, next, resources, searchVersion }),
              },
            }
          : {},
        query,
        selectedContentSearchAnnotationIds,
      },
    },
  };
}

/**
 * Builds a complete preloadedState for content search container tests.
 */
export function buildSearchState({
  companionWindowId = 'cw',
  manifestJson = buildManifestV2(),
  searchVersion = 1,
  windowId = 'window',
  ...searchOverrides
} = {}) {
  return buildState({
    companionWindowId,
    companionWindows: { [companionWindowId]: { content: 'search' } },
    manifestJson,
    searches: buildSearchSlice({ companionWindowId, searchVersion, windowId, ...searchOverrides }),
    windowId,
  });
}

/**
 * Returns [label, manifestJson, searchResponse, searchUrl] tuples for SearchPanel describe.each suites.
 */
export function buildSearchScenarios() {
  const fixtureSearchUrl = manifestFixtureFg165hz3589.service.at(0)['@id'];
  const v3Canvases = manifestFixtureFg165hz3589.sequences[0].canvases.map((canvas) => ({
    id: canvas['@id'],
    label: { en: [canvas.label] },
    type: 'Canvas',
  }));

  const v3Search1Manifest = buildManifestV3({
    items: v3Canvases,
    service: [
      {
        id: fixtureSearchUrl,
        profile: 'http://iiif.io/api/search/1/search',
        type: 'SearchService1',
      },
    ],
  });

  return [
    ['Presentation 2 (Search API 1)', manifestFixtureFg165hz3589, contentSearchMock, fixtureSearchUrl],
    ['Presentation 3 (Search API 1)', v3Search1Manifest, contentSearchMock, fixtureSearchUrl],
  ];
}
