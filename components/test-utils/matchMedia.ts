interface MediaState {
  matches: boolean;
  listeners: Set<EventListener>;
}

/** Installs the smallest event-capable matchMedia fake needed by overlay tests. */
export function installMatchMedia(initialMatches = false) {
  const original = window.matchMedia;
  const states = new Map<string, MediaState>();

  window.matchMedia = (query: string): MediaQueryList => {
    let state = states.get(query);
    if (!state) {
      state = { matches: initialMatches, listeners: new Set() };
      states.set(query, state);
    }
    const current = state;

    return {
      get matches() {
        return current.matches;
      },
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (type === "change" && typeof listener === "function") current.listeners.add(listener);
      },
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (type === "change" && typeof listener === "function") current.listeners.delete(listener);
      },
      dispatchEvent: (event) => {
        for (const listener of current.listeners) listener(event);
        return true;
      },
    };
  };

  return {
    emit(query: string, matches: boolean) {
      const state = states.get(query);
      if (!state) return false;
      state.matches = matches;
      const event = new Event("change") as MediaQueryListEvent;
      Object.defineProperties(event, {
        matches: { value: matches },
        media: { value: query },
      });
      for (const listener of state.listeners) listener(event);
      return true;
    },
    listenerCount(query: string) {
      return states.get(query)?.listeners.size ?? 0;
    },
    queries() {
      return [...states.keys()];
    },
    restore() {
      window.matchMedia = original;
    },
  };
}
