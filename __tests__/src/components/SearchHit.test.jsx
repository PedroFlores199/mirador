import { render, screen } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import SearchHit from '@src/containers/SearchHit';

vi.mock('@src/components/ScrollTo', () => ({
  // eslint-disable-next-line react/prop-types
  ScrollTo: ({ children }) => <div data-testid="scrollto">{children}</div>,
}));

const defaultHit = {
  after: ', and start the chainsaw',
  annotations: ['foo'],
  before: 'Light up the',
  match: 'moose',
};

const defaultProps = {
  annotationId: 'foo',
  companionWindowId: 'cwid',
  hit: defaultHit,
  index: 0,
  windowId: 'window',
};

/** */
function buildPreloadedState({
  resources = [{ '@id': 'foo', on: 'canvas-1' }],
  selectedAnnotationId = undefined,
  selectedContentSearchAnnotationIds = [],
} = {}) {
  return {
    companionWindows: { cwid: { windowId: 'window' } },
    searches: {
      window: {
        cwid: {
          data: {
            'search?q=moose': {
              json: {
                hits: [defaultHit],
                resources,
              },
            },
          },
          selectedContentSearchAnnotationIds,
        },
      },
    },
    windows: {
      window: {
        selectedAnnotationId,
      },
    },
  };
}

describe('SearchHit', () => {
  it('dispatches selectAnnotation when clicked and highlights windowSelected hits', async () => {
    const user = userEvent.setup();
    const { store } = render(<SearchHit {...defaultProps} />, {
      preloadedState: buildPreloadedState(),
    });

    expect(screen.getByRole('listitem')).not.toHaveClass('windowSelected');
    expect(screen.getByRole('listitem')).toHaveTextContent('1Light up the moose , and start the chai more');

    await user.click(screen.getByRole('button', { name: /Light up the moose/ }));

    expect(store.getState().windows.window.selectedAnnotationId).toEqual('foo');
    expect(screen.getByRole('listitem')).toHaveClass('windowSelected');
  });

  it('renders a ListItem for a selected hit', () => {
    render(<SearchHit {...defaultProps} />, {
      preloadedState: buildPreloadedState({ selectedContentSearchAnnotationIds: ['foo'] }),
    });

    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('renders the annotation char if the hit is not available', () => {
    render(<SearchHit {...defaultProps} hit={undefined} />, {
      preloadedState: buildPreloadedState({
        resources: [{ '@id': 'foo', on: 'canvas-1', resource: { chars: 'xyz' } }],
      }),
    });

    expect(screen.getByRole('listitem')).toHaveTextContent('1xyz');
  });
  it('renders a ScrollTo', () => {
    render(<SearchHit {...defaultProps} />, { preloadedState: buildPreloadedState() });

    expect(screen.getByTestId('scrollto')).toBeInTheDocument();
  });

  describe('Annotation Labels', () => {
    it('renders the annotationLabel if present', () => {
      render(<SearchHit {...defaultProps} />, {
        preloadedState: buildPreloadedState({
          resources: [
            {
              '@id': 'foo',
              '@type': 'oa:Annotation',
              label: 'The Anno Label',
              motivation: 'sc:painting',
              on: 'canvas-1',
            },
          ],
        }),
      });

      expect(screen.getByRole('heading', { level: 4, name: 'The Anno Label' })).toBeInTheDocument();
    });

    it('does not render the typography if no annotation label is present', () => {
      render(<SearchHit {...defaultProps} />, { preloadedState: buildPreloadedState() });

      expect(screen.getByRole('heading', { level: 4 })).toBeInTheDocument();
    });
  });
  describe('announcer', () => {
    it('sends information about the annotation when selected', async () => {
      const user = userEvent.setup();
      const announcer = vi.fn();
      render(<SearchHit {...defaultProps} announcer={announcer} total={9} />, {
        preloadedState: buildPreloadedState({ selectedContentSearchAnnotationIds: [] }),
      });

      expect(announcer).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /Light up the moose/ }));

      expect(announcer).toHaveBeenCalledWith('1 of 9   Light up the moose , and start the chai', 'polite');
    });

    it('calls the announcer when initially rendered as selected', () => {
      const announcer = vi.fn();
      render(<SearchHit {...defaultProps} announcer={announcer} total={9} />, {
        preloadedState: buildPreloadedState({ selectedContentSearchAnnotationIds: ['foo'] }),
      });

      expect(announcer).toHaveBeenCalledWith('1 of 9   Light up the moose , and start the chai', 'polite');
    });

    it('does not call the announcer when initially rendered as unselected', () => {
      const announcer = vi.fn();
      render(<SearchHit {...defaultProps} announcer={announcer} total={9} />, {
        preloadedState: buildPreloadedState({ selectedContentSearchAnnotationIds: [] }),
      });

      expect(announcer).not.toHaveBeenCalled();
    });

    it('does not send information about annotations that are not being deselected', () => {
      const announcer = vi.fn();
      const { rerender } = render(<SearchHit {...defaultProps} announcer={announcer} total={9} />, {
        preloadedState: buildPreloadedState({ selectedContentSearchAnnotationIds: ['foo'] }),
      });

      announcer.mockClear();

      rerender(<SearchHit {...defaultProps} announcer={announcer} total={9} />);

      expect(announcer).not.toHaveBeenCalled();
    });
  });
});
