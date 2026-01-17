import { describe, it, expect, vi, beforeEach, afterEach, expectTypeOf } from 'vitest';
import { renderHook } from '@testing-library/react';
import { sendEvent, useEmbed, EmbedActions } from './hook';

type MessageEventHandler = (event: MessageEvent) => void;

interface MockContentWindow {
  postMessage: ReturnType<typeof vi.fn>;
}

interface MockIframe {
  contentWindow: MockContentWindow;
}

const createMockIframe = (): { iframe: MockIframe; postMessageSpy: ReturnType<typeof vi.fn> } => {
  const postMessageSpy = vi.fn();
  return {
    iframe: { contentWindow: { postMessage: postMessageSpy } },
    postMessageSpy,
  };
};

const extractRequestId = (postMessageSpy: ReturnType<typeof vi.fn>): string => {
  const rawMessage = postMessageSpy.mock.calls[0]?.[0];
  if (typeof rawMessage !== 'string') {
    throw new Error('Expected postMessage to be called with a string');
  }
  const parsed = JSON.parse(rawMessage);
  return parsed.request_id;
};

const createMessageEvent = ({
  source,
  data,
}: {
  source: MockContentWindow | Record<string, unknown>;
  data: string;
}): MessageEvent => ({ source, data }) as unknown as MessageEvent;

describe('sendEvent', () => {
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let messageHandler: MessageEventHandler | null = null;

  beforeEach(() => {
    vi.useFakeTimers();

    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'message') {
        messageHandler = handler as MessageEventHandler;
      }
    });

    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    messageHandler = null;
  });

  it('resolves with result when matching REQUEST_RESULT received', async () => {
    const { iframe } = createMockIframe();

    const resultPromise = sendEvent(iframe as unknown as HTMLIFrameElement, { type: 'SUBMIT', data: {} });

    const requestId = extractRequestId(iframe.contentWindow.postMessage);

    messageHandler?.(
      createMessageEvent({
        source: iframe.contentWindow,
        data: JSON.stringify({
          type: 'REQUEST_RESULT',
          data: { request_id: requestId, result: { success: true } },
        }),
      }),
    );

    const result = await resultPromise;
    expect(result).toEqual({ success: true });
  });

  it('ignores messages from different source', async () => {
    const { iframe } = createMockIframe();

    const resultPromise = sendEvent(iframe as unknown as HTMLIFrameElement, { type: 'SUBMIT', data: {} });

    const requestId = extractRequestId(iframe.contentWindow.postMessage);

    messageHandler?.(
      createMessageEvent({
        source: { postMessage: vi.fn() },
        data: JSON.stringify({
          type: 'REQUEST_RESULT',
          data: { request_id: requestId, result: { success: true } },
        }),
      }),
    );

    vi.advanceTimersByTime(30000);
    const result = await resultPromise;
    expect(result).toEqual({
      success: false,
      error: { code: 'unexpected:request_timed_out', message: 'The request timed out: try again' },
    });
  });

  it('ignores messages with different request_id', async () => {
    const { iframe } = createMockIframe();

    const resultPromise = sendEvent(iframe as unknown as HTMLIFrameElement, { type: 'SUBMIT', data: {} });

    messageHandler?.(
      createMessageEvent({
        source: iframe.contentWindow,
        data: JSON.stringify({
          type: 'REQUEST_RESULT',
          data: { request_id: 'wrong_id', result: { success: true } },
        }),
      }),
    );

    vi.advanceTimersByTime(30000);
    const result = await resultPromise;
    expect(result).toEqual({
      success: false,
      error: { code: 'unexpected:request_timed_out', message: 'The request timed out: try again' },
    });
  });

  it('ignores non-REQUEST_RESULT messages', async () => {
    const { iframe } = createMockIframe();

    const resultPromise = sendEvent(iframe as unknown as HTMLIFrameElement, { type: 'SUBMIT', data: {} });

    messageHandler?.(
      createMessageEvent({
        source: iframe.contentWindow,
        data: JSON.stringify({ type: 'EDITOR_READY', data: {} }),
      }),
    );

    vi.advanceTimersByTime(30000);
    const result = await resultPromise;
    expect(result).toEqual({
      success: false,
      error: { code: 'unexpected:request_timed_out', message: 'The request timed out: try again' },
    });
  });

  it('times out after 30 seconds with error result', async () => {
    const { iframe } = createMockIframe();

    const resultPromise = sendEvent(iframe as unknown as HTMLIFrameElement, { type: 'SUBMIT', data: {} });

    vi.advanceTimersByTime(30000);

    const result = await resultPromise;
    expect(result).toEqual({
      success: false,
      error: { code: 'unexpected:request_timed_out', message: 'The request timed out: try again' },
    });
  });

  it('removes event listener after successful response', async () => {
    const { iframe } = createMockIframe();

    const resultPromise = sendEvent(iframe as unknown as HTMLIFrameElement, { type: 'SUBMIT', data: {} });

    const requestId = extractRequestId(iframe.contentWindow.postMessage);

    messageHandler?.(
      createMessageEvent({
        source: iframe.contentWindow,
        data: JSON.stringify({
          type: 'REQUEST_RESULT',
          data: { request_id: requestId, result: { success: true } },
        }),
      }),
    );

    await resultPromise;
    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('removes event listener after timeout', async () => {
    const { iframe } = createMockIframe();

    const resultPromise = sendEvent(iframe as unknown as HTMLIFrameElement, { type: 'SUBMIT', data: {} });

    vi.advanceTimersByTime(30000);

    await resultPromise;
    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('handles invalid JSON in message gracefully', async () => {
    const { iframe } = createMockIframe();

    const resultPromise = sendEvent(iframe as unknown as HTMLIFrameElement, { type: 'SUBMIT', data: {} });

    messageHandler?.(
      createMessageEvent({
        source: iframe.contentWindow,
        data: 'not valid json',
      }),
    );

    vi.advanceTimersByTime(30000);
    const result = await resultPromise;
    expect(result).toEqual({
      success: false,
      error: { code: 'unexpected:request_timed_out', message: 'The request timed out: try again' },
    });
  });
});

describe('useEmbed', () => {
  const expectedError = {
    success: false,
    error: {
      code: 'bad_request:embed_ref_not_available',
      message: 'embedRef is not available: make sure to pass embedRef to the <Embed /> component',
    },
  };

  describe('initial state', () => {
    it('returns embedRef and actions object', () => {
      const { result } = renderHook(() => useEmbed());

      expect(result.current.embedRef).toBeDefined();
      expect(result.current.embedRef.current).toBeNull();
      expect(result.current.actions).toBeDefined();
    });
  });

  describe('actions without ref attached', () => {
    it('goTo returns error when embedRef not attached', async () => {
      const { result } = renderHook(() => useEmbed());
      const actionResult = await result.current.actions.goTo({ page: 1 });
      expect(actionResult).toEqual(expectedError);
    });

    it('selectTool returns error when embedRef not attached', async () => {
      const { result } = renderHook(() => useEmbed());
      const actionResult = await result.current.actions.selectTool('TEXT');
      expect(actionResult).toEqual(expectedError);
    });

    it('createField returns error when embedRef not attached', async () => {
      const { result } = renderHook(() => useEmbed());
      const actionResult = await result.current.actions.createField({
        type: 'TEXT',
        page: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 20,
      });
      expect(actionResult).toEqual(expectedError);
    });

    it('clearFields returns error when embedRef not attached', async () => {
      const { result } = renderHook(() => useEmbed());
      const actionResult = await result.current.actions.clearFields({});
      expect(actionResult).toEqual(expectedError);
    });

    it('getDocumentContent returns error when embedRef not attached', async () => {
      const { result } = renderHook(() => useEmbed());
      const actionResult = await result.current.actions.getDocumentContent({ extractionMode: 'auto' });
      expect(actionResult).toEqual(expectedError);
    });

    it('submit returns error when embedRef not attached', async () => {
      const { result } = renderHook(() => useEmbed());
      const actionResult = await result.current.actions.submit({ downloadCopyOnDevice: false });
      expect(actionResult).toEqual(expectedError);
    });
  });

  describe('actions with ref attached', () => {
    const createMockEmbedRef = (): {
      ref: EmbedActions;
      spies: Record<keyof EmbedActions, ReturnType<typeof vi.fn>>;
    } => {
      const spies = {
        goTo: vi.fn().mockResolvedValue({ success: true }),
        selectTool: vi.fn().mockResolvedValue({ success: true }),
        createField: vi.fn().mockResolvedValue({ success: true }),
        clearFields: vi.fn().mockResolvedValue({ success: true }),
        getDocumentContent: vi.fn().mockResolvedValue({ success: true }),
        submit: vi.fn().mockResolvedValue({ success: true }),
      };

      return {
        ref: spies,
        spies,
      };
    };

    it('goTo delegates to ref.goTo', async () => {
      const { result } = renderHook(() => useEmbed());
      const { ref, spies } = createMockEmbedRef();
      (result.current.embedRef as React.MutableRefObject<EmbedActions>).current = ref;

      const actionResult = await result.current.actions.goTo({ page: 1 });

      expect(spies.goTo).toHaveBeenCalledWith({ page: 1 });
      expect(actionResult).toEqual({ success: true });
    });

    it('selectTool delegates to ref.selectTool', async () => {
      const { result } = renderHook(() => useEmbed());
      const { ref, spies } = createMockEmbedRef();
      (result.current.embedRef as React.MutableRefObject<EmbedActions>).current = ref;

      const actionResult = await result.current.actions.selectTool('TEXT');

      expect(spies.selectTool).toHaveBeenCalledWith('TEXT');
      expect(actionResult).toEqual({ success: true });
    });

    it('createField delegates to ref.createField', async () => {
      const { result } = renderHook(() => useEmbed());
      const { ref, spies } = createMockEmbedRef();
      (result.current.embedRef as React.MutableRefObject<EmbedActions>).current = ref;

      const fieldOptions = { type: 'TEXT' as const, page: 1, x: 0, y: 0, width: 100, height: 20 };
      const actionResult = await result.current.actions.createField(fieldOptions);

      expect(spies.createField).toHaveBeenCalledWith(fieldOptions);
      expect(actionResult).toEqual({ success: true });
    });

    it('clearFields delegates to ref.clearFields', async () => {
      const { result } = renderHook(() => useEmbed());
      const { ref, spies } = createMockEmbedRef();
      (result.current.embedRef as React.MutableRefObject<EmbedActions>).current = ref;

      const actionResult = await result.current.actions.clearFields({});

      expect(spies.clearFields).toHaveBeenCalledWith({});
      expect(actionResult).toEqual({ success: true });
    });

    it('getDocumentContent delegates to ref.getDocumentContent', async () => {
      const { result } = renderHook(() => useEmbed());
      const { ref, spies } = createMockEmbedRef();
      (result.current.embedRef as React.MutableRefObject<EmbedActions>).current = ref;

      const actionResult = await result.current.actions.getDocumentContent({ extractionMode: 'auto' });

      expect(spies.getDocumentContent).toHaveBeenCalledWith({ extractionMode: 'auto' });
      expect(actionResult).toEqual({ success: true });
    });

    it('submit delegates to ref.submit', async () => {
      const { result } = renderHook(() => useEmbed());
      const { ref, spies } = createMockEmbedRef();
      (result.current.embedRef as React.MutableRefObject<EmbedActions>).current = ref;

      const actionResult = await result.current.actions.submit({ downloadCopyOnDevice: false });

      expect(spies.submit).toHaveBeenCalledWith({ downloadCopyOnDevice: false });
      expect(actionResult).toEqual({ success: true });
    });
  });

  it('maintains stable action references across renders', () => {
    const { result, rerender } = renderHook(() => useEmbed());

    const initialActions = result.current.actions;
    rerender();

    expect(result.current.actions.goTo).toBe(initialActions.goTo);
    expect(result.current.actions.submit).toBe(initialActions.submit);
  });
});

describe('Type assertions', () => {
  // These types are intentionally inlined to act as a "frozen" contract.
  // If the actual types change, these tests will fail at compile time.

  type ExpectedToolType = 'TEXT' | 'BOXED_TEXT' | 'CHECKBOX' | 'PICTURE' | 'SIGNATURE';

  type ExpectedBaseFieldOptions = {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };

  type ExpectedTextFieldOptions = ExpectedBaseFieldOptions & {
    type: 'TEXT' | 'BOXED_TEXT';
    value?: string;
  };

  type ExpectedCheckboxFieldOptions = ExpectedBaseFieldOptions & {
    type: 'CHECKBOX';
    value?: 'checked' | 'unchecked';
  };

  type ExpectedPictureFieldOptions = ExpectedBaseFieldOptions & {
    type: 'PICTURE';
    value?: string;
  };

  type ExpectedSignatureFieldOptions = ExpectedBaseFieldOptions & {
    type: 'SIGNATURE';
    value?: string;
  };

  type ExpectedCreateFieldOptions =
    | ExpectedTextFieldOptions
    | ExpectedCheckboxFieldOptions
    | ExpectedPictureFieldOptions
    | ExpectedSignatureFieldOptions;

  type ExpectedErrorResult = {
    success: false;
    error: { code: string; message: string };
  };

  type ExpectedSuccessResult<TData = undefined> = TData extends undefined
    ? { success: true }
    : { success: true; data: TData };

  type ExpectedActionResult<TData = undefined> = ExpectedSuccessResult<TData> | ExpectedErrorResult;

  describe('EmbedActions', () => {
    it('goTo accepts { page: number } and returns ActionResult', () => {
      expectTypeOf<EmbedActions['goTo']>().parameter(0).toEqualTypeOf<{ page: number }>();
      expectTypeOf<EmbedActions['goTo']>().returns.resolves.toExtend<ExpectedActionResult>();
    });

    it('selectTool accepts ToolType | null and returns ActionResult', () => {
      expectTypeOf<EmbedActions['selectTool']>().parameter(0).toEqualTypeOf<ExpectedToolType | null>();
      expectTypeOf<EmbedActions['selectTool']>().returns.resolves.toExtend<ExpectedActionResult>();
    });

    it('createField accepts CreateFieldOptions and returns ActionResult with field_id', () => {
      expectTypeOf<EmbedActions['createField']>().parameter(0).toEqualTypeOf<ExpectedCreateFieldOptions>();
      expectTypeOf<EmbedActions['createField']>().returns.resolves.toExtend<
        ExpectedActionResult<{ field_id: string }>
      >();
    });

    it('clearFields accepts optional { fieldIds?, page? } and returns ActionResult with cleared_count', () => {
      expectTypeOf<EmbedActions['clearFields']>()
        .parameter(0)
        .toEqualTypeOf<{ fieldIds?: string[]; page?: number } | undefined>();
      expectTypeOf<EmbedActions['clearFields']>().returns.resolves.toExtend<
        ExpectedActionResult<{ cleared_count: number }>
      >();
    });

    it('getDocumentContent requires { extractionMode } and returns ActionResult with document content', () => {
      expectTypeOf<EmbedActions['getDocumentContent']>().parameter(0).toEqualTypeOf<{
        extractionMode: 'auto' | 'ocr';
      }>();
      expectTypeOf<EmbedActions['getDocumentContent']>().returns.resolves.toExtend<
        ExpectedActionResult<{ name: string; pages: { page: number; content: string }[] }>
      >();
    });

    it('submit requires { downloadCopyOnDevice } and returns ActionResult', () => {
      expectTypeOf<EmbedActions['submit']>().parameter(0).toEqualTypeOf<{ downloadCopyOnDevice: boolean }>();
      expectTypeOf<EmbedActions['submit']>().returns.resolves.toExtend<ExpectedActionResult>();
    });
  });

  describe('createField discriminated union', () => {
    it('TEXT field options are accepted', () => {
      const textField = {
        type: 'TEXT' as const,
        page: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        value: 'hello',
      };
      expectTypeOf(textField).toExtend<ExpectedCreateFieldOptions>();
    });

    it('BOXED_TEXT field options are accepted', () => {
      const boxedTextField = {
        type: 'BOXED_TEXT' as const,
        page: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        value: 'hello',
      };
      expectTypeOf(boxedTextField).toExtend<ExpectedCreateFieldOptions>();
    });

    it('CHECKBOX field accepts only checked/unchecked values', () => {
      const checkedField = {
        type: 'CHECKBOX' as const,
        page: 1,
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        value: 'checked' as const,
      };
      expectTypeOf(checkedField).toExtend<ExpectedCreateFieldOptions>();

      const uncheckedField = {
        type: 'CHECKBOX' as const,
        page: 1,
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        value: 'unchecked' as const,
      };
      expectTypeOf(uncheckedField).toExtend<ExpectedCreateFieldOptions>();
    });

    it('PICTURE field options are accepted', () => {
      const pictureField = {
        type: 'PICTURE' as const,
        page: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        value: 'data:image/png;base64,...',
      };
      expectTypeOf(pictureField).toExtend<ExpectedCreateFieldOptions>();
    });

    it('SIGNATURE field options are accepted', () => {
      const signatureField = {
        type: 'SIGNATURE' as const,
        page: 1,
        x: 0,
        y: 0,
        width: 150,
        height: 50,
        value: 'John Doe',
      };
      expectTypeOf(signatureField).toExtend<ExpectedCreateFieldOptions>();
    });
  });
});
