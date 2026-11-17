import { render, screen } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@tests/mocks/server';
import { buildState } from '@tests/utils/build-state';
import { buildSearchScenarios } from '@tests/utils/iiif-search-helpers';
import SearchPanel from '@src/containers/SearchPanel';

describe.each(buildSearchScenarios())('SearchPanel (%s)', (_label, manifestJson, searchResponse, searchUrl) => {
  const renderPanel = (props = {}, { search, window } = {}) =>
    render(<SearchPanel id="cw" windowId="window" {...props} />, {
      preloadedState: buildState({
        companionWindows: { cw: { content: 'search' } },
        manifestJson,
        ...(search && {
          searches: {
            window: {
              cw: {
                data: {},
                ...search,
              },
            },
          },
        }),
        ...(window && {
          windows: {
            window,
          },
        }),
      }),
    });

  beforeEach(() => {
    server.use(http.get(searchUrl, () => HttpResponse.json(searchResponse)));
  });

  it('renders a CompanionWindow', () => {
    renderPanel();
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
  });

  it('passes a Clear chip as the CompanionWindow title prop', () => {
    renderPanel(
      {},
      {
        search: {
          data: { [`${searchUrl}?q=Wolpertinger`]: { isFetching: false, json: searchResponse } },
          query: 'Wolpertinger',
        },
      },
    );

    expect(screen.getByRole('heading', { name: /Search/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset search' })).toBeInTheDocument();
  });

  it('clears the search when the Clear chip is clicked', async () => {
    const user = userEvent.setup();

    renderPanel(
      {},
      {
        search: {
          data: { [`${searchUrl}?q=Wolpertinger`]: { isFetching: false, json: searchResponse } },
          query: 'Wolpertinger',
        },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Reset search' }));

    expect(screen.queryByRole('button', { name: 'Reset search' })).not.toBeInTheDocument();
  });

  it('does not render a Clear chip if there is no search query to be cleared', () => {
    renderPanel();

    expect(screen.queryByRole('button', { name: 'Reset search' })).not.toBeInTheDocument();
  });

  it('has the SearchPanelControls component', () => {
    renderPanel();

    expect(screen.getByRole('combobox', { name: 'search terms' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search in the document' })).toBeInTheDocument();
  });

  it('has the SearchResults list', () => {
    renderPanel();

    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('suggests searches, encodes special characters in the request URL, and renders results', async () => {
    const user = userEvent.setup();
    expect(searchUrl).toBeDefined();
    let requestedUrl;

    server.use(
      http.get(searchUrl, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json(searchResponse);
      }),
    );

    renderPanel({}, { window: { suggestedSearches: ['Dry Cleaning & Laundry'] } });

    const suggestionBtn = screen.getByRole('button', {
      name: 'Search this document for "Dry Cleaning & Laundry"',
    });
    expect(suggestionBtn).toBeInTheDocument();

    await user.click(suggestionBtn);

    const hits = await screen.findAllByRole('listitem');
    expect(hits).toHaveLength(3);
    expect(hits[0]).toHaveTextContent('1');
    expect(hits[0]).toHaveTextContent('Dry Cleaning');
    expect(hits[0]).toHaveTextContent(/& Laundry - \(Located at side of Medical Building\)/);

    // Verify special characters and spaces were URL-encoded in the request
    expect(requestedUrl).toBe(`${searchUrl}?q=Dry+Cleaning+%26+Laundry`);
  });

  it('does not suggest searches if the user has made a query', () => {
    renderPanel(
      {},
      {
        search: {
          data: { [`${searchUrl}?q=blah`]: { isFetching: false, json: searchResponse } },
          query: 'blah',
        },
        window: { suggestedSearches: ['NSF'] },
      },
    );

    expect(screen.queryByRole('button', { name: 'Search this document for "NSF"' })).not.toBeInTheDocument();
  });
});
