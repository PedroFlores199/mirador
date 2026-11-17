import { render, screen } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@tests/mocks/server';
import { buildManifestV2, buildManifestV3 } from '@tests/utils/build-state';
import { buildSearchResponse, buildSearchState, defaultSearchUrl } from '@tests/utils/iiif-search-helpers';
import SearchResults from '@src/containers/SearchResults';

const nextSearchUrl = `${defaultSearchUrl}?page=2`;

describe.each([
  ['Presentation 2 (Search API 1)', buildManifestV2(), 1],
  ['Presentation 3 (Search API 1)', buildManifestV3(), 1],
])('SearchResults (%s)', (_label, manifestJson, searchVersion) => {
  const renderResults = (overrides = {}) =>
    render(<SearchResults companionWindowId="cw" windowId="window" />, {
      preloadedState: buildSearchState({ manifestJson, searchVersion, ...overrides }),
    });

  it('renders a SearchHit for each hit', () => {
    renderResults();
    expect(screen.getByRole('button', { name: /Light up the moose/ })).toBeInTheDocument();
  });

  it('can focus on a single item', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('button', { name: 'more...' }));
    expect(screen.getByRole('listitem')).toHaveTextContent(/start the chainsaw/);

    expect(screen.queryByRole('button', { name: 'more...' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to results' }));
    expect(screen.getByRole('button', { name: 'more...' })).toBeInTheDocument();
  });

  describe('annotation-only search results', () => {
    it('renders a SearchHit for each annotation', () => {
      renderResults({
        hits: [],
        resources: [
          { '@id': 'x', '@type': 'oa:Annotation', label: 'The Anno Label', motivation: 'sc:painting' },
          { '@id': 'y', '@type': 'oa:Annotation', label: 'Annother Anno Label', motivation: 'sc:painting' },
        ],
      });

      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      expect(screen.getByRole('heading', { level: 4, name: 'The Anno Label' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Annother Anno Label' })).toBeInTheDocument();
    });
  });

  describe('no search results', () => {
    it('shows no results', () => {
      renderResults({
        hits: [],
        isFetching: false,
        query: 'nope',
        resources: [],
      });

      expect(screen.getByText('No results found')).toHaveClass('MuiTypography-body1');
    });

    it('while fetching', () => {
      renderResults({
        hits: [],
        isFetching: true,
        query: 'nope',
        resources: [],
      });

      expect(screen.queryByText('No results found')).not.toBeInTheDocument();
    });

    it('without a query', () => {
      renderResults({
        isFetching: false,
        query: '',
      });

      expect(screen.queryByText('No results found')).not.toBeInTheDocument();
    });
  });

  describe('multi-page search results', () => {
    it('shows a button to request the next page', async () => {
      const user = userEvent.setup();
      let requestedUrl;

      server.use(
        http.get(defaultSearchUrl, ({ request }) => {
          requestedUrl = request.url;
          return HttpResponse.json(buildSearchResponse({ hits: [], id: request.url, resources: [], searchVersion }));
        }),
      );

      const { store } = renderResults({ next: nextSearchUrl });

      await user.click(screen.getByRole('button', { name: /More results/ }));

      expect(requestedUrl).toBe(nextSearchUrl);
      expect(store.getState().searches.window.cw.data[nextSearchUrl]).toBeDefined();
    });
  });
});
