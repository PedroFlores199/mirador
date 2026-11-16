import { render, screen } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import SearchPanelNavigation from '@src/containers/SearchPanelNavigation';

const defaultProps = {
  companionWindowId: 'cw',
  windowId: 'window',
};

const defaultResources = [
  { '@id': '1', on: 'canvas-1' },
  { '@id': '2', on: 'canvas-1' },
  { '@id': '3', on: 'canvas-1' },
];

/** */
function buildPreloadedState({ hits = [], resources = defaultResources, selectedContentSearchAnnotationIds = [] } = {}) {
  const searchUrl = 'http://example.com/search?q=foo';
  return {
    companionWindows: { cw: { content: 'search', windowId: 'window' } },
    manifests: {
      manifest: {
        id: 'manifest',
        json: {
          '@context': 'http://iiif.io/api/presentation/2/context.json',
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
        cw: {
          data: {
            [searchUrl]: {
              isFetching: false,
              json: {
                hits,
                resources,
                within: {
                  total: hits.length,
                },
              },
            },
          },
          query: 'foo',
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

describe('SearchPanelNavigation', () => {
  describe('when searchHits are available', () => {
    it('renders text with buttons', async () => {
      const user = userEvent.setup();
      const { store } = render(<SearchPanelNavigation {...defaultProps} />, {
        preloadedState: buildPreloadedState({
          hits: [{ annotations: ['1'] }, { annotations: ['2'] }, { annotations: ['3'] }],
          selectedContentSearchAnnotationIds: ['2'],
        }),
      });

      expect(screen.getByText('2 of 3')).toBeInTheDocument();
      expect(screen.getAllByRole('button').length).toEqual(2);

      await user.click(screen.getByRole('button', { name: 'Previous result' }));
      expect(store.getState().windows.window.selectedAnnotationId).toEqual('1');

      await user.click(screen.getByRole('button', { name: 'Next result' }));
      await user.click(screen.getByRole('button', { name: 'Next result' }));
      expect(store.getState().windows.window.selectedAnnotationId).toEqual('3');
    });

    it('buttons disabled when no next/prev', () => {
      render(<SearchPanelNavigation {...defaultProps} />, {
        preloadedState: buildPreloadedState({
          hits: [{ annotations: ['1'] }, { annotations: ['2'] }],
          selectedContentSearchAnnotationIds: ['1'],
        }),
      });

      expect(screen.getByRole('button', { name: 'Previous result' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next result' })).toBeEnabled();
    });

    it('disables next button on last result', () => {
      render(<SearchPanelNavigation {...defaultProps} />, {
        preloadedState: buildPreloadedState({
          hits: [{ annotations: ['1'] }, { annotations: ['2'] }],
          selectedContentSearchAnnotationIds: ['2'],
        }),
      });

      expect(screen.getByRole('button', { name: 'Previous result' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Next result' })).toBeDisabled();
    });
  });
});
