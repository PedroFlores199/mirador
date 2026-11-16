import { render, screen } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import SearchResults from '../../../src/containers/SearchResults';

const presentationContext = 'http://iiif.io/api/presentation/2/context.json';
const searchContext = 'http://iiif.io/api/search/1/context.json';
const searchUrl = 'http://example.com/contentsearch';
const nextSearchUrl = 'http://example.com/search?page=2';

const defaultHits = [
  {
    after: ', and start the chainsaw',
    annotations: ['foo'],
    before: 'Light up the',
    match: 'moose',
  },
];

const defaultResources = [
  {
    '@id': 'foo',
    '@type': 'oa:Annotation',
    motivation: 'sc:painting',
    on: 'canvas-1',
  },
  {
    '@id': 'x',
    label: 'The Anno Label',
    on: 'canvas-1',
  },
  {
    '@id': 'y',
    label: 'Annother Anno Label',
    on: 'canvas-1',
  },
];

const defaultProps = {
  companionWindowId: 'cwid',
  windowId: 'window',
};

/** */
function buildPreloadedState({
  hits = defaultHits,
  isFetching = false,
  next = undefined,
  query = 'query',
  resources = defaultResources,
  selectedContentSearchAnnotationIds = [],
} = {}) {
  return {
    companionWindows: {
      cwid: { content: 'search', windowId: 'window' },
    },
    manifests: {
      manifest: {
        id: 'manifest',
        json: {
          '@context': presentationContext,
          '@id': 'http://example.com/manifest',
          '@type': 'sc:Manifest',
          sequences: [
            {
              canvases: [{ '@id': 'canvas-1', label: '' }],
            },
          ],
        },
      },
    },
    searches: {
      window: {
        cwid: {
          data: query
            ? {
                [searchUrl]: {
                  id: searchUrl,
                  isFetching,
                  json: {
                    hits,
                    resources,
                    ...(next && { next }),
                  },
                },
              }
            : {},
          query,
          selectedContentSearchAnnotationIds,
        },
      },
    },
    windows: {
      window: {
        id: 'window',
        manifestId: 'manifest',
      },
    },
  };
}

describe('SearchResults', () => {
  it('renders a SearchHit for each hit', () => {
    render(<SearchResults {...defaultProps} />, {
      preloadedState: buildPreloadedState(),
    });

    expect(screen.getByRole('button', { name: /Light up the moose/ })).toBeInTheDocument();
  });

  it('can focus on a single item', async () => {
    const user = userEvent.setup();
    render(<SearchResults {...defaultProps} />, {
      preloadedState: buildPreloadedState(),
    });

    await user.click(screen.getByRole('button', { name: 'more...' }));
    expect(screen.getByRole('listitem')).toHaveTextContent(/start the chainsaw/);

    expect(screen.queryByRole('button', { name: 'more...' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to results' }));
    expect(screen.getByRole('button', { name: 'more...' })).toBeInTheDocument();
  });

  describe('annotation-only search results', () => {
    it('renders a SearchHit for each annotation', () => {
      render(<SearchResults {...defaultProps} />, {
        preloadedState: buildPreloadedState({
          hits: [],
          resources: [
            { '@id': 'x', '@type': 'oa:Annotation', label: 'The Anno Label', motivation: 'sc:painting' },
            { '@id': 'y', '@type': 'oa:Annotation', label: 'Annother Anno Label', motivation: 'sc:painting' },
          ],
        }),
      });

      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      expect(screen.getByRole('heading', { level: 4, name: 'The Anno Label' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Annother Anno Label' })).toBeInTheDocument();
    });
  });

  describe('no search results', () => {
    it('shows no results', () => {
      render(<SearchResults {...defaultProps} />, {
        preloadedState: buildPreloadedState({
          hits: [],
          isFetching: false,
          query: 'nope',
          resources: [],
        }),
      });

      expect(screen.getByText('No results found')).toHaveClass('MuiTypography-body1');
    });

    it('while fetching', () => {
      render(<SearchResults {...defaultProps} />, {
        preloadedState: buildPreloadedState({
          hits: [],
          isFetching: true,
          query: 'nope',
          resources: [],
        }),
      });

      expect(screen.queryByText('No results found')).not.toBeInTheDocument();
    });

    it('without a query', () => {
      render(<SearchResults {...defaultProps} />, {
        preloadedState: buildPreloadedState({
          isFetching: false,
          query: '',
        }),
      });

      expect(screen.queryByText('No results found')).not.toBeInTheDocument();
    });
  });

  describe('multi-page search results', () => {
    it('shows a button to request the next page', async () => {
      const user = userEvent.setup();
      let requestedUrl;

      server.use(
        http.get('http://example.com/search', ({ request }) => {
          requestedUrl = request.url;
          return HttpResponse.json({
            '@context': [presentationContext, searchContext],
            '@id': request.url,
            '@type': 'sc:AnnotationList',
            hits: [],
            resources: [],
          });
        }),
      );

      const { store } = render(<SearchResults {...defaultProps} />, {
        preloadedState: buildPreloadedState({
          next: nextSearchUrl,
        }),
      });

      await user.click(screen.getByRole('button', { name: /More results/ }));

      expect(requestedUrl).toBe(nextSearchUrl);
      expect(store.getState().searches.window.cwid.data[nextSearchUrl]).toBeDefined();
    });
  });
});
