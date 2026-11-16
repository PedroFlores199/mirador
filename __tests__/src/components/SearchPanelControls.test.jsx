import { act, render, screen } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { autocompleteMock } from '../../mocks/autocompleteMock';
import { server } from '../../mocks/server';
import SearchPanelControls from '../../../src/containers/SearchPanelControls';
import { removeSearch } from '../../../src/state/actions';

const presentationContext = 'http://iiif.io/api/presentation/2/context.json';
const searchContext = 'http://iiif.io/api/search/1/context.json';
const searchProfile = 'http://iiif.io/api/search/1/search';
const autocompleteProfile = 'http://iiif.io/api/search/1/autocomplete';
const defaultSearchId = 'http://example.com/search';
const stanfordBase = 'https://contentsearch.stanford.edu/fg165hz3589';
const wwwSearchId = 'http://www.example.com/search';

const defaultProps = {
  companionWindowId: 'cw',
  windowId: 'window',
};

/** */
function buildPreloadedState({
  autocompleteId = `${stanfordBase}/autocomplete`,
  data = {},
  query = undefined,
  searchId = defaultSearchId,
} = {}) {
  return {
    companionWindows: { cw: { content: 'search', windowId: 'window' } },
    manifests: {
      manifest: {
        id: 'manifest',
        json: {
          '@context': presentationContext,
          '@id': 'http://example.com/manifest',
          '@type': 'sc:Manifest',
          service: [
            {
              '@context': searchContext,
              '@id': searchId,
              profile: searchProfile,
              ...(autocompleteId && {
                service: {
                  '@id': autocompleteId,
                  profile: autocompleteProfile,
                },
              }),
            },
          ],
        },
      },
    },
    searches: {
      window: {
        cw: {
          data,
          query,
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

describe('SearchPanelControls', () => {
  beforeEach(() => {
    server.use(
      http.get(defaultSearchId, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q') || '';
        return HttpResponse.json({
          '@context': [presentationContext, searchContext],
          '@id': `${defaultSearchId}?q=${q}`,
          '@type': 'sc:AnnotationList',
          hits: [],
          resources: [],
          within: {
            '@type': 'sc:Layer',
            first: `${defaultSearchId}?start=0`,
            ignored: [],
            last: `${defaultSearchId}?start=0`,
          },
        });
      }),
    );
  });

  it('renders a form', () => {
    render(<SearchPanelControls {...defaultProps} />, { preloadedState: buildPreloadedState() });
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  it('displays proposed autocomplete options when typing and submits search', async () => {
    const user = userEvent.setup();
    let requestedSearchUrl;

    server.use(
      http.get(`${stanfordBase}/autocomplete`, () => HttpResponse.json(autocompleteMock)),
      http.get(`${stanfordBase}/search`, ({ request }) => {
        requestedSearchUrl = request.url;
        return HttpResponse.json({
          '@context': [presentationContext, searchContext],
          '@id': request.url,
          '@type': 'sc:AnnotationList',
          hits: [],
          resources: [],
          within: {
            '@type': 'sc:Layer',
            first: `${stanfordBase}/search?start=0`,
            ignored: [],
            last: `${stanfordBase}/search?start=0`,
          },
        });
      }),
    );

    const { store } = render(<SearchPanelControls {...defaultProps} />, {
      preloadedState: buildPreloadedState({
        searchId: `${stanfordBase}/search`,
      }),
    });

    const input = screen.getByRole('combobox');
    await user.type(input, 'wund');

    expect(await screen.findByRole('option', { name: 'wunder' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'wunderbar' })).toBeInTheDocument();

    const wunderOption = await screen.findByRole('option', { name: 'wunder' });
    await user.click(wunderOption);

    expect(requestedSearchUrl).toBe(`${stanfordBase}/search?q=wunder`);
    expect(store.getState().searches.window.cw.query).toBe('wunder');
  });

  it('renders a text input through the renderInput prop', () => {
    render(<SearchPanelControls {...defaultProps} />, { preloadedState: buildPreloadedState() });

    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'search-cw');
  });

  it('endAdornment is a SearchIcon (with no CircularProgress indicator)', () => {
    render(<SearchPanelControls {...defaultProps} />, { preloadedState: buildPreloadedState() });
    // eslint-disable-next-line testing-library/no-node-access
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('endAdornment has a CircularProgress indicator when the current search is fetching', () => {
    render(<SearchPanelControls {...defaultProps} />, {
      preloadedState: buildPreloadedState({
        data: { [`${defaultSearchId}?q=foo`]: { isFetching: true } },
        query: 'foo',
      }),
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('form change and submission triggers a search action', async () => {
    const user = userEvent.setup();
    let requestedSearchUrl;

    server.use(
      http.get(wwwSearchId, ({ request }) => {
        requestedSearchUrl = request.url;
        return HttpResponse.json({
          '@context': [presentationContext, searchContext],
          '@id': request.url,
          '@type': 'sc:AnnotationList',
          hits: [],
          resources: [],
          within: {
            '@type': 'sc:Layer',
            first: `${wwwSearchId}?start=0`,
            ignored: [],
            last: `${wwwSearchId}?start=0`,
          },
        });
      }),
    );

    const { store } = render(<SearchPanelControls {...defaultProps} />, {
      preloadedState: buildPreloadedState({
        query: 'asdf',
        searchId: wwwSearchId,
      }),
    });

    await user.clear(screen.getByRole('combobox'));
    await user.keyboard('yolo');
    await user.click(screen.getByRole('button'));

    expect(requestedSearchUrl).toBe(`${wwwSearchId}?q=yolo`);
    expect(store.getState().searches.window.cw.query).toBe('yolo');
  });

  it('does not submit an empty search', async () => {
    const user = userEvent.setup();
    let searchCalled = false;

    server.use(
      http.get(wwwSearchId, () => {
        searchCalled = true;
        return HttpResponse.json({});
      }),
    );

    render(<SearchPanelControls {...defaultProps} />, {
      preloadedState: buildPreloadedState({
        query: '',
        searchId: wwwSearchId,
      }),
    });

    await user.clear(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'Search in the document' }));
    expect(searchCalled).toBe(false);
  });

  // TODO: move this to a presentational component test once SearchPanelControls is refactored to be a container component
  describe('input', () => {
    it('has the query prop as the input value on initial render', () => {
      render(<SearchPanelControls {...defaultProps} />, {
        preloadedState: buildPreloadedState({ query: 'Wolpertinger' }),
      });
      expect(screen.getByRole('combobox')).toHaveValue('Wolpertinger');
    });

    it('clears the local search state/input when the incoming query prop has been cleared', () => {
      const { store } = render(<SearchPanelControls {...defaultProps} />, {
        preloadedState: buildPreloadedState({ query: 'Wolpertinger' }),
      });
      expect(screen.getByRole('combobox')).toHaveValue('Wolpertinger');

      act(() => {
        store.dispatch(removeSearch('window', 'cw'));
      });

      expect(screen.getByRole('combobox')).toHaveValue('');
    });
  });
});
