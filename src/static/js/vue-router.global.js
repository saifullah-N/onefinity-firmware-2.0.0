/*!
  * vue-router v4.1.6
  * (c) 2022 Eduardo San Martin Morote
  * @license MIT
  */
var VueRouter = (function (exports, vue) {
  'use strict';

  const isBrowser = typeof window !== 'undefined';

  function isESModule(obj) {
      return obj.__esModule || obj[Symbol.toStringTag] === 'Module';
  }
  const assign = Object.assign;
  function applyToParams(fn, params) {
      const newParams = {};
      for (const key in params) {
          const value = params[key];
          newParams[key] = isArray(value)
              ? value.map(fn)
              : fn(value);
      }
      return newParams;
  }
  const noop = () => { };
  /**
   * Typesafe alternative to Array.isArray
   * https://github.com/microsoft/TypeScript/pull/48228
   */
  const isArray = Array.isArray;

  function warn(msg) {
      // avoid using ...args as it breaks in older Edge builds
      const args = Array.from(arguments).slice(1);
      console.warn.apply(console, ['[Vue Router warn]: ' + msg].concat(args));
  }

  const TRAILING_SLASH_RE = /\/$/;
  const removeTrailingSlash = (path) => path.replace(TRAILING_SLASH_RE, '');
  /**
   * Transforms a URI into a normalized history location
   *
   * @param parseQuery
   * @param location - URI to normalize
   * @param currentLocation - current absolute location. Allows resolving relative
   * paths. Must start with `/`. Defaults to `/`
   * @returns a normalized history location
   */
  function parseURL(parseQuery, location, currentLocation = '/') {
      let path, query = {}, searchString = '', hash = '';
      // Could use URL and URLSearchParams but IE 11 doesn't support it
      // TODO: move to new URL()
      const hashPos = location.indexOf('#');
      let searchPos = location.indexOf('?');
      // the hash appears before the search, so it's not part of the search string
      if (hashPos < searchPos && hashPos >= 0) {
          searchPos = -1;
      }
      if (searchPos > -1) {
          path = location.slice(0, searchPos);
          searchString = location.slice(searchPos + 1, hashPos > -1 ? hashPos : location.length);
          query = parseQuery(searchString);
      }
      if (hashPos > -1) {
          path = path || location.slice(0, hashPos);
          // keep the # character
          hash = location.slice(hashPos, location.length);
      }
      // no search and no query
      path = resolveRelativePath(path != null ? path : location, currentLocation);
      // empty path means a relative query or hash `?foo=f`, `#thing`
      return {
          fullPath: path + (searchString && '?') + searchString + hash,
          path,
          query,
          hash,
      };
  }
  /**
   * Stringifies a URL object
   *
   * @param stringifyQuery
   * @param location
   */
  function stringifyURL(stringifyQuery, location) {
      const query = location.query ? stringifyQuery(location.query) : '';
      return location.path + (query && '?') + query + (location.hash || '');
  }
  /**
   * Strips off the base from the beginning of a location.pathname in a non-case-sensitive way.
   *
   * @param pathname - location.pathname
   * @param base - base to strip off
   */
  function stripBase(pathname, base) {
      // no base or base is not found at the beginning
      if (!base || !pathname.toLowerCase().startsWith(base.toLowerCase()))
          return pathname;
      return pathname.slice(base.length) || '/';
  }
  /**
   * Checks if two RouteLocation are equal. This means that both locations are
   * pointing towards the same {@link RouteRecord} and that all `params`, `query`
   * parameters and `hash` are the same
   *
   * @param a - first {@link RouteLocation}
   * @param b - second {@link RouteLocation}
   */
  function isSameRouteLocation(stringifyQuery, a, b) {
      const aLastIndex = a.matched.length - 1;
      const bLastIndex = b.matched.length - 1;
      return (aLastIndex > -1 &&
          aLastIndex === bLastIndex &&
          isSameRouteRecord(a.matched[aLastIndex], b.matched[bLastIndex]) &&
          isSameRouteLocationParams(a.params, b.params) &&
          stringifyQuery(a.query) === stringifyQuery(b.query) &&
          a.hash === b.hash);
  }
  /**
   * Check if two `RouteRecords` are equal. Takes into account aliases: they are
   * considered equal to the `RouteRecord` they are aliasing.
   *
   * @param a - first {@link RouteRecord}
   * @param b - second {@link RouteRecord}
   */
  function isSameRouteRecord(a, b) {
      // since the original record has an undefined value for aliasOf
      // but all aliases point to the original record, this will always compare
      // the original record
      return (a.aliasOf || a) === (b.aliasOf || b);
  }
  function isSameRouteLocationParams(a, b) {
      if (Object.keys(a).length !== Object.keys(b).length)
          return false;
      for (const key in a) {
          if (!isSameRouteLocationParamsValue(a[key], b[key]))
              return false;
      }
      return true;
  }
  function isSameRouteLocationParamsValue(a, b) {
      return isArray(a)
          ? isEquivalentArray(a, b)
          : isArray(b)
              ? isEquivalentArray(b, a)
              : a === b;
  }
  /**
   * Check if two arrays are the same or if an array with one single entry is the
   * same as another primitive value. Used to check query and parameters
   *
   * @param a - array of values
   * @param b - array of values or a single value
   */
  function isEquivalentArray(a, b) {
      return isArray(b)
          ? a.length === b.length && a.every((value, i) => value === b[i])
          : a.length === 1 && a[0] === b;
  }
  /**
   * Resolves a relative path that starts with `.`.
   *
   * @param to - path location we are resolving
   * @param from - currentLocation.path, should start with `/`
   */
  function resolveRelativePath(to, from) {
      if (to.startsWith('/'))
          return to;
      if (!from.startsWith('/')) {
          warn(`Cannot resolve a relative location without an absolute path. Trying to resolve "${to}" from "${from}". It should look like "/${from}".`);
          return to;
      }
      if (!to)
          return from;
      const fromSegments = from.split('/');
      const toSegments = to.split('/');
      let position = fromSegments.length - 1;
      let toPosition;
      let segment;
      for (toPosition = 0; toPosition < toSegments.length; toPosition++) {
          segment = toSegments[toPosition];
          // we stay on the same position
          if (segment === '.')
              continue;
          // go up in the from array
          if (segment === '..') {
              // we can't go below zero, but we still need to increment toPosition
              if (position > 1)
                  position--;
              // continue
          }
          // we reached a non-relative path, we stop here
          else
              break;
      }
      return (fromSegments.slice(0, position).join('/') +
          '/' +
          toSegments
              // ensure we use at least the last element in the toSegments
              .slice(toPosition - (toPosition === toSegments.length ? 1 : 0))
              .join('/'));
  }

  var NavigationType;
  (function (NavigationType) {
      NavigationType["pop"] = "pop";
      NavigationType["push"] = "push";
  })(NavigationType || (NavigationType = {}));
  var NavigationDirection;
  (function (NavigationDirection) {
      NavigationDirection["back"] = "back";
      NavigationDirection["forward"] = "forward";
      NavigationDirection["unknown"] = "";
  })(NavigationDirection || (NavigationDirection = {}));
  /**
   * Starting location for Histories
   */
  const START = '';
  // Generic utils
  /**
   * Normalizes a base by removing any trailing slash and reading the base tag if
   * present.
   *
   * @param base - base to normalize
   */
  function normalizeBase(base) {
      if (!base) {
          if (isBrowser) {
              // respect <base> tag
              const baseEl = document.querySelector('base');
              base = (baseEl && baseEl.getAttribute('href')) || '/';
              // strip full URL origin
              base = base.replace(/^\w+:\/\/[^\/]+/, '');
          }
          else {
              base = '/';
          }
      }
      // ensure leading slash when it was removed by the regex above avoid leading
      // slash with hash because the file could be read from the disk like file://
      // and the leading slash would cause problems
      if (base[0] !== '/' && base[0] !== '#')
          base = '/' + base;
      // remove the trailing slash so all other method can just do `base + fullPath`
      // to build an href
      return removeTrailingSlash(base);
  }
  // remove any character before the hash
  const BEFORE_HASH_RE = /^[^#]+#/;
  function createHref(base, location) {
      return base.replace(BEFORE_HASH_RE, '#') + location;
  }

  function getElementPosition(el, offset) {
      const docRect = document.documentElement.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      return {
          behavior: offset.behavior,
          left: elRect.left - docRect.left - (offset.left || 0),
          top: elRect.top - docRect.top - (offset.top || 0),
      };
  }
  const computeScrollPosition = () => ({
      left: window.pageXOffset,
      top: window.pageYOffset,
  });
  function scrollToPosition(position) {
      let scrollToOptions;
      if ('el' in position) {
          const positionEl = position.el;
          const isIdSelector = typeof positionEl === 'string' && positionEl.startsWith('#');
          /**
           * `id`s can accept pretty much any characters, including CSS combinators
           * like `>` or `~`. It's still possible to retrieve elements using
           * `document.getElementById('~')` but it needs to be escaped when using
           * `document.querySelector('#\\~')` for it to be valid. The only
           * requirements for `id`s are them to be unique on the page and to not be
           * empty (`id=""`). Because of that, when passing an id selector, it should
           * be properly escaped for it to work with `querySelector`. We could check
           * for the id selector to be simple (no CSS combinators `+ >~`) but that
           * would make things inconsistent since they are valid characters for an
           * `id` but would need to be escaped when using `querySelector`, breaking
           * their usage and ending up in no selector returned. Selectors need to be
           * escaped:
           *
           * - `#1-thing` becomes `#\31 -thing`
           * - `#with~symbols` becomes `#with\\~symbols`
           *
           * - More information about  the topic can be found at
           *   https://mathiasbynens.be/notes/html5-id-class.
           * - Practical example: https://mathiasbynens.be/demo/html5-id
           */
          if (typeof position.el === 'string') {
              if (!isIdSelector || !document.getElementById(position.el.slice(1))) {
                  try {
                      const foundEl = document.querySelector(position.el);
                      if (isIdSelector && foundEl) {
                          warn(`The selector "${position.el}" should be passed as "el: document.querySelector('${position.el}')" because it starts with "#".`);
                          // return to avoid other warnings
                          return;
                      }
                  }
                  catch (err) {
                      warn(`The selector "${position.el}" is invalid. If you are using an id selector, make sure to escape it. You can find more information about escaping characters in selectors at https://mathiasbynens.be/notes/css-escapes or use CSS.escape (https://developer.mozilla.org/en-US/docs/Web/API/CSS/escape).`);
                      // return to avoid other warnings
                      return;
                  }
              }
          }
          const el = typeof positionEl === 'string'
              ? isIdSelector
                  ? document.getElementById(positionEl.slice(1))
                  : document.querySelector(positionEl)
              : positionEl;
          if (!el) {
              warn(`Couldn't find element using selector "${position.el}" returned by scrollBehavior.`);
              return;
          }
          scrollToOptions = getElementPosition(el, position);
      }
      else {
          scrollToOptions = position;
      }
      if ('scrollBehavior' in document.documentElement.style)
          window.scrollTo(scrollToOptions);
      else {
          window.scrollTo(scrollToOptions.left != null ? scrollToOptions.left : window.pageXOffset, scrollToOptions.top != null ? scrollToOptions.top : window.pageYOffset);
      }
  }
  function getScrollKey(path, delta) {
      const position = history.state ? history.state.position - delta : -1;
      return position + path;
  }
  const scrollPositions = new Map();
  function saveScrollPosition(key, scrollPosition) {
      scrollPositions.set(key, scrollPosition);
  }
  function getSavedScrollPosition(key) {
      const scroll = scrollPositions.get(key);
      // consume it so it's not used again
      scrollPositions.delete(key);
      return scroll;
  }
  // TODO: RFC about how to save scroll position
  /**
   * ScrollBehavior instance used by the router to compute and restore the scroll
   * position when navigating.
   */
  // export interface ScrollHandler<ScrollPositionEntry extends HistoryStateValue, ScrollPosition extends ScrollPositionEntry> {
  //   // returns a scroll position that can be saved in history
  //   compute(): ScrollPositionEntry
  //   // can take an extended ScrollPositionEntry
  //   scroll(position: ScrollPosition): void
  // }
  // export const scrollHandler: ScrollHandler<ScrollPosition> = {
  //   compute: computeScroll,
  //   scroll: scrollToPosition,
  // }

  let createBaseLocation = () => location.protocol + '//' + location.host;
  /**
   * Creates a normalized history location from a window.location object
   * @param location -
   */
  function createCurrentLocation(base, location) {
      const { pathname, search, hash } = location;
      // allows hash bases like #, /#, #/, #!, #!/, /#!/, or even /folder#end
      const hashPos = base.indexOf('#');
      if (hashPos > -1) {
          let slicePos = hash.includes(base.slice(hashPos))
              ? base.slice(hashPos).length
              : 1;
          let pathFromHash = hash.slice(slicePos);
          // prepend the starting slash to hash so the url starts with /#
          if (pathFromHash[0] !== '/')
              pathFromHash = '/' + pathFromHash;
          return stripBase(pathFromHash, '');
      }
      const path = stripBase(pathname, base);
      return path + search + hash;
  }
  function useHistoryListeners(base, historyState, currentLocation, replace) {
      let listeners = [];
      let teardowns = [];
      // TODO: should it be a stack? a Dict. Check if the popstate listener
      // can trigger twice
      let pauseState = null;
      const popStateHandler = ({ state, }) => {
          const to = createCurrentLocation(base, location);
          const from = currentLocation.value;
          const fromState = historyState.value;
          let delta = 0;
          if (state) {
              currentLocation.value = to;
              historyState.value = state;
              // ignore the popstate and reset the pauseState
              if (pauseState && pauseState === from) {
                  pauseState = null;
                  return;
              }
              delta = fromState ? state.position - fromState.position : 0;
          }
          else {
              replace(to);
          }
          // console.log({ deltaFromCurrent })
          // Here we could also revert the navigation by calling history.go(-delta)
          // this listener will have to be adapted to not trigger again and to wait for the url
          // to be updated before triggering the listeners. Some kind of validation function would also
          // need to be passed to the listeners so the navigation can be accepted
          // call all listeners
          listeners.forEach(listener => {
              listener(currentLocation.value, from, {
                  delta,
                  type: NavigationType.pop,
                  direction: delta
                      ? delta > 0
                          ? NavigationDirection.forward
                          : NavigationDirection.back
                      : NavigationDirection.unknown,
              });
          });
      };
      function pauseListeners() {
          pauseState = currentLocation.value;
      }
      function listen(callback) {
          // set up the listener and prepare teardown callbacks
          listeners.push(callback);
          const teardown = () => {
              const index = listeners.indexOf(callback);
              if (index > -1)
                  listeners.splice(index, 1);
          };
          teardowns.push(teardown);
          return teardown;
      }
      function beforeUnloadListener() {
          const { history } = window;
          if (!history.state)
              return;
          history.replaceState(assign({}, history.state, { scroll: computeScrollPosition() }), '');
      }
      function destroy() {
          for (const teardown of teardowns)
              teardown();
          teardowns = [];
          window.removeEventListener('popstate', popStateHandler);
          window.removeEventListener('beforeunload', beforeUnloadListener);
      }
      // set up the listeners and prepare teardown callbacks
      window.addEventListener('popstate', popStateHandler);
      window.addEventListener('beforeunload', beforeUnloadListener);
      return {
          pauseListeners,
          listen,
          destroy,
      };
  }
  /**
   * Creates a state object
   */
  function buildState(back, current, forward, replaced = false, computeScroll = false) {
      return {
          back,
          current,
          forward,
          replaced,
          position: window.history.length,
          scroll: computeScroll ? computeScrollPosition() : null,
      };
  }
  function useHistoryStateNavigation(base) {
      const { history, location } = window;
      // private variables
      const currentLocation = {
          value: createCurrentLocation(base, location),
      };
      const historyState = { value: history.state };
      // build current history entry as this is a fresh navigation
      if (!historyState.value) {
          changeLocation(currentLocation.value, {
              back: null,
              current: currentLocation.value,
              forward: null,
              // the length is off by one, we need to decrease it
              position: history.length - 1,
              replaced: true,
              // don't add a scroll as the user may have an anchor, and we want
              // scrollBehavior to be triggered without a saved position
              scroll: null,
          }, true);
      }
      function changeLocation(to, state, replace) {
          /**
           * if a base tag is provided, and we are on a normal domain, we have to
           * respect the provided `base` attribute because pushState() will use it and
           * potentially erase anything before the `#` like at
           * https://github.com/vuejs/router/issues/685 where a base of
           * `/folder/#` but a base of `/` would erase the `/folder/` section. If
           * there is no host, the `<base>` tag makes no sense and if there isn't a
           * base tag we can just use everything after the `#`.
           */
          const hashIndex = base.indexOf('#');
          const url = hashIndex > -1
              ? (location.host && document.querySelector('base')
                  ? base
                  : base.slice(hashIndex)) + to
              : createBaseLocation() + base + to;
          try {
              // BROWSER QUIRK
              // NOTE: Safari throws a SecurityError when calling this function 100 times in 30 seconds
              history[replace ? 'replaceState' : 'pushState'](state, '', url);
              historyState.value = state;
          }
          catch (err) {
              {
                  warn('Error with push/replace State', err);
              }
              // Force the navigation, this also resets the call count
              location[replace ? 'replace' : 'assign'](url);
          }
      }
      function replace(to, data) {
          const state = assign({}, history.state, buildState(historyState.value.back, 
          // keep back and forward entries but override current position
          to, historyState.value.forward, true), data, { position: historyState.value.position });
          changeLocation(to, state, true);
          currentLocation.value = to;
      }
      function push(to, data) {
          // Add to current entry the information of where we are going
          // as well as saving the current position
          const currentState = assign({}, 
          // use current history state to gracefully handle a wrong call to
          // history.replaceState
          // https://github.com/vuejs/router/issues/366
          historyState.value, history.state, {
              forward: to,
              scroll: computeScrollPosition(),
          });
          if (!history.state) {
              warn(`history.state seems to have been manually replaced without preserving the necessary values. Make sure to preserve existing history state if you are manually calling history.replaceState:\n\n` +
                  `history.replaceState(history.state, '', url)\n\n` +
                  `You can find more information at https://next.router.vuejs.org/guide/migration/#usage-of-history-state.`);
          }
          changeLocation(currentState.current, currentState, true);
          const state = assign({}, buildState(currentLocation.value, to, null), { position: currentState.position + 1 }, data);
          changeLocation(to, state, false);
          currentLocation.value = to;
      }
      return {
          location: currentLocation,
          state: historyState,
          push,
          replace,
      };
  }
  /**
   * Creates an HTML5 history. Most common history for single page applications.
   *
   * @param base -
   */
  function createWebHistory(base) {
      base = normalizeBase(base);
      const historyNavigation = useHistoryStateNavigation(base);
      const historyListeners = useHistoryListeners(base, historyNavigation.state, historyNavigation.location, historyNavigation.replace);
      function go(delta, triggerListeners = true) {
          if (!triggerListeners)
              historyListeners.pauseListeners();
          history.go(delta);
      }
      const routerHistory = assign({
          // it's overridden right after
          location: '',
          base,
          go,
          createHref: createHref.bind(null, base),
      }, historyNavigation, historyListeners);
      Object.defineProperty(routerHistory, 'location', {
          enumerable: true,
          get: () => historyNavigation.location.value,
      });
      Object.defineProperty(routerHistory, 'state', {
          enumerable: true,
          get: () => historyNavigation.state.value,
      });
      return routerHistory;
  }

  /**
   * Creates an in-memory based history. The main purpose of this history is to handle SSR. It starts in a special location that is nowhere.
   * It's up to the user to replace that location with the starter location by either calling `router.push` or `router.replace`.
   *
   * @param base - Base applied to all urls, defaults to '/'
   * @returns a history object that can be passed to the router constructor
   */
  function createMemoryHistory(base = '') {
      let listeners = [];
      let queue = [START];
      let position = 0;
      base = normalizeBase(base);
      function setLocation(location) {
          position++;
          if (position === queue.length) {
              // we are at the end, we can simply append a new entry
              queue.push(location);
          }
          else {
              // we are in the middle, we remove everything from here in the queue
              queue.splice(position);
              queue.push(location);
          }
      }
      function triggerListeners(to, from, { direction, delta }) {
          const info = {
              direction,
              delta,
              type: NavigationType.pop,
          };
          for (const callback of listeners) {
              callback(to, from, info);
          }
      }
      const routerHistory = {
          // rewritten by Object.defineProperty
          location: START,
          // TODO: should be kept in queue
          state: {},
          base,
          createHref: createHref.bind(null, base),
          replace(to) {
              // remove current entry and decrement position
              queue.splice(position--, 1);
              setLocation(to);
          },
          push(to, data) {
              setLocation(to);
          },
          listen(callback) {
              listeners.push(callback);
              return () => {
                  const index = listeners.indexOf(callback);
                  if (index > -1)
                      listeners.splice(index, 1);
              };
          },
          destroy() {
              listeners = [];
              queue = [START];
              position = 0;
          },
          go(delta, shouldTrigger = true) {
              const from = this.location;
              const direction = 
              // we are considering delta === 0 going forward, but in abstract mode
              // using 0 for the delta doesn't make sense like it does in html5 where
              // it reloads the page
              delta < 0 ? NavigationDirection.back : NavigationDirection.forward;
              position = Math.max(0, Math.min(position + delta, queue.length - 1));
              if (shouldTrigger) {
                  triggerListeners(this.location, from, {
                      direction,
                      delta,
                  });
              }
          },
      };
      Object.defineProperty(routerHistory, 'location', {
          enumerable: true,
          get: () => queue[position],
      });
      return routerHistory;
  }

  /**
   * Creates a hash history. Useful for web applications with no host (e.g. `file://`) or when configuring a server to
   * handle any URL is not possible.
   *
   * @param base - optional base to provide. Defaults to `location.pathname + location.search` If there is a `<base>` tag
   * in the `head`, its value will be ignored in favor of this parameter **but note it affects all the history.pushState()
   * calls**, meaning that if you use a `<base>` tag, it's `href` value **has to match this parameter** (ignoring anything
   * after the `#`).
   *
   * @example
   * ```js
   * // at https://example.com/folder
   * createWebHashHistory() // gives a url of `https://example.com/folder#`
   * createWebHashHistory('/folder/') // gives a url of `https://example.com/folder/#`
   * // if the `#` is provided in the base, it won't be added by `createWebHashHistory`
   * createWebHashHistory('/folder/#/app/') // gives a url of `https://example.com/folder/#/app/`
   * // you should avoid doing this because it changes the original url and breaks copying urls
   * createWebHashHistory('/other-folder/') // gives a url of `https://example.com/other-folder/#`
   *
   * // at file:///usr/etc/folder/index.html
   * // for locations with no `host`, the base is ignored
   * createWebHashHistory('/iAmIgnored') // gives a url of `file:///usr/etc/folder/index.html#`
   * ```
   */
  function createWebHashHistory(base) {
      // Make sure this implementation is fine in terms of encoding, specially for IE11
      // for `file://`, directly use the pathname and ignore the base
      // location.pathname contains an initial `/` even at the root: `https://example.com`
      base = location.host ? base || location.pathname + location.search : '';
      // allow the user to provide a `#` in the middle: `/base/#/app`
      if (!base.includes('#'))
          base += '#';
      if (!base.endsWith('#/') && !base.endsWith('#')) {
          warn(`A hash base must end with a "#":\n"${base}" should be "${base.replace(/#.*$/, '#')}".`);
      }
      return createWebHistory(base);
  }

  function isRouteLocation(route) {
      return typeof route === 'string' || (route && typeof route === 'object');
  }
  function isRouteName(name) {
      return typeof name === 'string' || typeof name === 'symbol';
  }

  /**
   * Initial route location where the router is. Can be used in navigation guards
   * to differentiate the initial navigation.
   *
   * @example
   * ```js
   * import { START_LOCATION } from 'vue-router'
   *
   * router.beforeEach((to, from) => {
   *   if (from === START_LOCATION) {
   *     // initial navigation
   *   }
   * })
   * ```
   */
  const START_LOCATION_NORMALIZED = {
      path: '/',
      name: undefined,
      params: {},
      query: {},
      hash: '',
      fullPath: '/',
      matched: [],
      meta: {},
      redirectedFrom: undefined,
  };

  const NavigationFailureSymbol = Symbol('navigation failure' );
  /**
   * Enumeration with all possible types for navigation failures. Can be passed to
   * {@link isNavigationFailure} to check for specific failures.
   */
  exports.NavigationFailureType = void 0;
  (function (NavigationFailureType) {
      /**
       * An aborted navigation is a navigation that failed because a navigation
       * guard returned `false` or called `next(false)`
       */
      NavigationFailureType[NavigationFailureType["aborted"] = 4] = "aborted";
      /**
       * A cancelled navigation is a navigation that failed because a more recent
       * navigation finished started (not necessarily finished).
       */
      NavigationFailureType[NavigationFailureType["cancelled"] = 8] = "cancelled";
      /**
       * A duplicated navigation is a navigation that failed because it was
       * initiated while already being at the exact same location.
       */
      NavigationFailureType[NavigationFailureType["duplicated"] = 16] = "duplicated";
  })(exports.NavigationFailureType || (exports.NavigationFailureType = {}));
  // DEV only debug messages
  const ErrorTypeMessages = {
      [1 /* ErrorTypes.MATCHER_NOT_FOUND */]({ location, currentLocation }) {
          return `No match for\n ${JSON.stringify(location)}${currentLocation
            ? '\nwhile being at\n' + JSON.stringify(currentLocation)
            : ''}`;
      },
      [2 /* ErrorTypes.NAVIGATION_GUARD_REDIRECT */]({ from, to, }) {
          return `Redirected from "${from.fullPath}" to "${stringifyRoute(to)}" via a navigation guard.`;
      },
      [4 /* ErrorTypes.NAVIGATION_ABORTED */]({ from, to }) {
          return `Navigation aborted from "${from.fullPath}" to "${to.fullPath}" via a navigation guard.`;
      },
      [8 /* ErrorTypes.NAVIGATION_CANCELLED */]({ from, to }) {
          return `Navigation cancelled from "${from.fullPath}" to "${to.fullPath}" with a new navigation.`;
      },
      [16 /* ErrorTypes.NAVIGATION_DUPLICATED */]({ from, to }) {
          return `Avoided redundant navigation to current location: "${from.fullPath}".`;
      },
  };
  function createRouterError(type, params) {
      // keep full error messages in cjs versions
      {
          return assign(new Error(ErrorTypeMessages[type](params)), {
              type,
              [NavigationFailureSymbol]: true,
          }, params);
      }
  }
  function isNavigationFailure(error, type) {
      return (error instanceof Error &&
          NavigationFailureSymbol in error &&
          (type == null || !!(error.type & type)));
  }
  const propertiesToLog = ['params', 'query', 'hash'];
  function stringifyRoute(to) {
      if (typeof to === 'string')
          return to;
      if ('path' in to)
          return to.path;
      const location = {};
      for (const key of propertiesToLog) {
          if (key in to)
              location[key] = to[key];
      }
      return JSON.stringify(location, null, 2);
  }

  // default pattern for a param: non-greedy everything but /
  const BASE_PARAM_PATTERN = '[^/]+?';
  const BASE_PATH_PARSER_OPTIONS = {
      sensitive: false,
      strict: false,
      start: true,
      end: true,
  };
  // Special Regex characters that must be escaped in static tokens
  const REGEX_CHARS_RE = /[.+*?^${}()[\]/\\]/g;
  /**
   * Creates a path parser from an array of Segments (a segment is an array of Tokens)
   *
   * @param segments - array of segments returned by tokenizePath
   * @param extraOptions - optional options for the regexp
   * @returns a PathParser
   */
  function tokensToParser(segments, extraOptions) {
      const options = assign({}, BASE_PATH_PARSER_OPTIONS, extraOptions);
      // the amount of scores is the same as the length of segments except for the root segment "/"
      const score = [];
      // the regexp as a string
      let pattern = options.start ? '^' : '';
      // extracted keys
      const keys = [];
      for (const segment of segments) {
          // the root segment needs special treatment
          const segmentScores = segment.length ? [] : [90 /* PathScore.Root */];
          // allow trailing slash
          if (options.strict && !segment.length)
              pattern += '/';
          for (let tokenIndex = 0; tokenIndex < segment.length; tokenIndex++) {
              const token = segment[tokenIndex];
              // resets the score if we are inside a sub-segment /:a-other-:b
              let subSegmentScore = 40 /* PathScore.Segment */ +
                  (options.sensitive ? 0.25 /* PathScore.BonusCaseSensitive */ : 0);
              if (token.type === 0 /* TokenType.Static */) {
                  // prepend the slash if we are starting a new segment
                  if (!tokenIndex)
                      pattern += '/';
                  pattern += token.value.replace(REGEX_CHARS_RE, '\\$&');
                  subSegmentScore += 40 /* PathScore.Static */;
              }
              else if (token.type === 1 /* TokenType.Param */) {
                  const { value, repeatable, optional, regexp } = token;
                  keys.push({
                      name: value,
                      repeatable,
                      optional,
                  });
                  const re = regexp ? regexp : BASE_PARAM_PATTERN;
                  // the user provided a custom regexp /:id(\\d+)
                  if (re !== BASE_PARAM_PATTERN) {
                      subSegmentScore += 10 /* PathScore.BonusCustomRegExp */;
                      // make sure the regexp is valid before using it
                      try {
                          new RegExp(`(${re})`);
                      }
                      catch (err) {
                          throw new Error(`Invalid custom RegExp for param "${value}" (${re}): ` +
                              err.message);
                      }
                  }
                  // when we repeat we must take care of the repeating leading slash
                  let subPattern = repeatable ? `((?:${re})(?:/(?:${re}))*)` : `(${re})`;
                  // prepend the slash if we are starting a new segment
                  if (!tokenIndex)
                      subPattern =
                          // avoid an optional / if there are more segments e.g. /:p?-static
                          // or /:p?-:p2
                          optional && segment.length < 2
                              ? `(?:/${subPattern})`
                              : '/' + subPattern;
                  if (optional)
                      subPattern += '?';
                  pattern += subPattern;
                  subSegmentScore += 20 /* PathScore.Dynamic */;
                  if (optional)
                      subSegmentScore += -8 /* PathScore.BonusOptional */;
                  if (repeatable)
                      subSegmentScore += -20 /* PathScore.BonusRepeatable */;
                  if (re === '.*')
                      subSegmentScore += -50 /* PathScore.BonusWildcard */;
              }
              segmentScores.push(subSegmentScore);
          }
          // an empty array like /home/ -> [[{home}], []]
          // if (!segment.length) pattern += '/'
          score.push(segmentScores);
      }
      // only apply the strict bonus to the last score
      if (options.strict && options.end) {
          const i = score.length - 1;
          score[i][score[i].length - 1] += 0.7000000000000001 /* PathScore.BonusStrict */;
      }
      // TODO: dev only warn double trailing slash
      if (!options.strict)
          pattern += '/?';
      if (options.end)
          pattern += '$';
      // allow paths like /dynamic to only match dynamic or dynamic/... but not dynamic_something_else
      else if (options.strict)
          pattern += '(?:/|$)';
      const re = new RegExp(pattern, options.sensitive ? '' : 'i');
      function parse(path) {
          const match = path.match(re);
          const params = {};
          if (!match)
              return null;
          for (let i = 1; i < match.length; i++) {
              const value = match[i] || '';
              const key = keys[i - 1];
              params[key.name] = value && key.repeatable ? value.split('/') : value;
          }
          return params;
      }
      function stringify(params) {
          let path = '';
          // for optional parameters to allow to be empty
          let avoidDuplicatedSlash = false;
          for (const segment of segments) {
              if (!avoidDuplicatedSlash || !path.endsWith('/'))
                  path += '/';
              avoidDuplicatedSlash = false;
              for (const token of segment) {
                  if (token.type === 0 /* TokenType.Static */) {
                      path += token.value;
                  }
                  else if (token.type === 1 /* TokenType.Param */) {
                      const { value, repeatable, optional } = token;
                      const param = value in params ? params[value] : '';
                      if (isArray(param) && !repeatable) {
                          throw new Error(`Provided param "${value}" is an array but it is not repeatable (* or + modifiers)`);
                      }
                      const text = isArray(param)
                          ? param.join('/')
                          : param;
                      if (!text) {
                          if (optional) {
                              // if we have more than one optional param like /:a?-static we don't need to care about the optional param
                              if (segment.length < 2) {
                                  // remove the last slash as we could be at the end
                                  if (path.endsWith('/'))
                                      path = path.slice(0, -1);
                                  // do not append a slash on the next iteration
                                  else
                                      avoidDuplicatedSlash = true;
                              }
                          }
                          else
                              throw new Error(`Missing required param "${value}"`);
                      }
                      path += text;
                  }
              }
          }
          // avoid empty path when we have multiple optional params
          return path || '/';
      }
      return {
          re,
          score,
          keys,
          parse,
          stringify,
      };
  }
  /**
   * Compares an array of numbers as used in PathParser.score and returns a
   * number. This function can be used to `sort` an array
   *
   * @param a - first array of numbers
   * @param b - second array of numbers
   * @returns 0 if both are equal, < 0 if a should be sorted first, > 0 if b
   * should be sorted first
   */
  function compareScoreArray(a, b) {
      let i = 0;
      while (i < a.length && i < b.length) {
          const diff = b[i] - a[i];
          // only keep going if diff === 0
          if (diff)
              return diff;
          i++;
      }
      // if the last subsegment was Static, the shorter segments should be sorted first
      // otherwise sort the longest segment first
      if (a.length < b.length) {
          return a.length === 1 && a[0] === 40 /* PathScore.Static */ + 40 /* PathScore.Segment */
              ? -1
              : 1;
      }
      else if (a.length > b.length) {
          return b.length === 1 && b[0] === 40 /* PathScore.Static */ + 40 /* PathScore.Segment */
              ? 1
              : -1;
      }
      return 0;
  }
  /**
   * Compare function that can be used with `sort` to sort an array of PathParser
   *
   * @param a - first PathParser
   * @param b - second PathParser
   * @returns 0 if both are equal, < 0 if a should be sorted first, > 0 if b
   */
  function comparePathParserScore(a, b) {
      let i = 0;
      const aScore = a.score;
      const bScore = b.score;
      while (i < aScore.length && i < bScore.length) {
          const comp = compareScoreArray(aScore[i], bScore[i]);
          // do not return if both are equal
          if (comp)
              return comp;
          i++;
      }
      if (Math.abs(bScore.length - aScore.length) === 1) {
          if (isLastScoreNegative(aScore))
              return 1;
          if (isLastScoreNegative(bScore))
              return -1;
      }
      // if a and b share the same score entries but b has more, sort b first
      return bScore.length - aScore.length;
      // this is the ternary version
      // return aScore.length < bScore.length
      //   ? 1
      //   : aScore.length > bScore.length
      //   ? -1
      //   : 0
  }
  /**
   * This allows detecting splats at the end of a path: /home/:id(.*)*
   *
   * @param score - score to check
   * @returns true if the last entry is negative
   */
  function isLastScoreNegative(score) {
      const last = score[score.length - 1];
      return score.length > 0 && last[last.length - 1] < 0;
  }

  const ROOT_TOKEN = {
      type: 0 /* TokenType.Static */,
      value: '',
  };
  const VALID_PARAM_RE = /[a-zA-Z0-9_]/;
  // After some profiling, the cache seems to be unnecessary because tokenizePath
  // (the slowest part of adding a route) is very fast
  // const tokenCache = new Map<string, Token[][]>()
  function tokenizePath(path) {
      if (!path)
          return [[]];
      if (path === '/')
          return [[ROOT_TOKEN]];
      if (!path.startsWith('/')) {
          throw new Error(`Route paths should start with a "/": "${path}" should be "/${path}".`
              );
      }
      // if (tokenCache.has(path)) return tokenCache.get(path)!
      function crash(message) {
          throw new Error(`ERR (${state})/"${buffer}": ${message}`);
      }
      let state = 0 /* TokenizerState.Static */;
      let previousState = state;
      const tokens = [];
      // the segment will always be valid because we get into the initial state
      // with the leading /
      let segment;
      function finalizeSegment() {
          if (segment)
              tokens.push(segment);
          segment = [];
      }
      // index on the path
      let i = 0;
      // char at index
      let char;
      // buffer of the value read
      let buffer = '';
      // custom regexp for a param
      let customRe = '';
      function consumeBuffer() {
          if (!buffer)
              return;
          if (state === 0 /* TokenizerState.Static */) {
              segment.push({
                  type: 0 /* TokenType.Static */,
                  value: buffer,
              });
          }
          else if (state === 1 /* TokenizerState.Param */ ||
              state === 2 /* TokenizerState.ParamRegExp */ ||
              state === 3 /* TokenizerState.ParamRegExpEnd */) {
              if (segment.length > 1 && (char === '*' || char === '+'))
                  crash(`A repeatable param (${buffer}) must be alone in its segment. eg: '/:ids+.`);
              segment.push({
                  type: 1 /* TokenType.Param */,
                  value: buffer,
                  regexp: customRe,
                  repeatable: char === '*' || char === '+',
                  optional: char === '*' || char === '?',
              });
          }
          else {
              crash('Invalid state to consume buffer');
          }
          buffer = '';
      }
      function addCharToBuffer() {
          buffer += char;
      }
      while (i < path.length) {
          char = path[i++];
          if (char === '\\' && state !== 2 /* TokenizerState.ParamRegExp */) {
              previousState = state;
              state = 4 /* TokenizerState.EscapeNext */;
              continue;
          }
          switch (state) {
              case 0 /* TokenizerState.Static */:
                  if (char === '/') {
                      if (buffer) {
                          consumeBuffer();
                      }
                      finalizeSegment();
                  }
                  else if (char === ':') {
                      consumeBuffer();
                      state = 1 /* TokenizerState.Param */;
                  }
                  else {
                      addCharToBuffer();
                  }
                  break;
              case 4 /* TokenizerState.EscapeNext */:
                  addCharToBuffer();
                  state = previousState;
                  break;
              case 1 /* TokenizerState.Param */:
                  if (char === '(') {
                      state = 2 /* TokenizerState.ParamRegExp */;
                  }
                  else if (VALID_PARAM_RE.test(char)) {
                      addCharToBuffer();
                  }
                  else {
                      consumeBuffer();
                      state = 0 /* TokenizerState.Static */;
                      // go back one character if we were not modifying
                      if (char !== '*' && char !== '?' && char !== '+')
                          i--;
                  }
                  break;
              case 2 /* TokenizerState.ParamRegExp */:
                  // TODO: is it worth handling nested regexp? like :p(?:prefix_([^/]+)_suffix)
                  // it already works by escaping the closing )
                  // https://paths.esm.dev/?p=AAMeJbiAwQEcDKbAoAAkP60PG2R6QAvgNaA6AFACM2ABuQBB#
                  // is this really something people need since you can also write
                  // /prefix_:p()_suffix
                  if (char === ')') {
                      // handle the escaped )
                      if (customRe[customRe.length - 1] == '\\')
                          customRe = customRe.slice(0, -1) + char;
                      else
                          state = 3 /* TokenizerState.ParamRegExpEnd */;
                  }
                  else {
                      customRe += char;
                  }
                  break;
              case 3 /* TokenizerState.ParamRegExpEnd */:
                  // same as finalizing a param
                  consumeBuffer();
                  state = 0 /* TokenizerState.Static */;
                  // go back one character if we were not modifying
                  if (char !== '*' && char !== '?' && char !== '+')
                      i--;
                  customRe = '';
                  break;
              default:
                  crash('Unknown state');
                  break;
          }
      }
      if (state === 2 /* TokenizerState.ParamRegExp */)
          crash(`Unfinished custom RegExp for param "${buffer}"`);
      consumeBuffer();
      finalizeSegment();
      // tokenCache.set(path, tokens)
      return tokens;
  }

  function createRouteRecordMatcher(record, parent, options) {
      const parser = tokensToParser(tokenizePath(record.path), options);
      // warn against params with the same name
      {
          const existingKeys = new Set();
          for (const key of parser.keys) {
              if (existingKeys.has(key.name))
                  warn(`Found duplicated params with name "${key.name}" for path "${record.path}". Only the last one will be available on "$route.params".`);
              existingKeys.add(key.name);
          }
      }
      const matcher = assign(parser, {
          record,
          parent,
          // these needs to be populated by the parent
          children: [],
          alias: [],
      });
      if (parent) {
          // both are aliases or both are not aliases
          // we don't want to mix them because the order is used when
          // passing originalRecord in Matcher.addRoute
          if (!matcher.record.aliasOf === !parent.record.aliasOf)
              parent.children.push(matcher);
      }
      return matcher;
  }

  /**
   * Creates a Router Matcher.
   *
   * @internal
   * @param routes - array of initial routes
   * @param globalOptions - global route options
   */
  function createRouterMatcher(routes, globalOptions) {
      // normalized ordered array of matchers
      const matchers = [];
      const matcherMap = new Map();
      globalOptions = mergeOptions({ strict: false, end: true, sensitive: false }, globalOptions);
      function getRecordMatcher(name) {
          return matcherMap.get(name);
      }
      function addRoute(record, parent, originalRecord) {
          // used later on to remove by name
          const isRootAdd = !originalRecord;
          const mainNormalizedRecord = normalizeRouteRecord(record);
          {
              checkChildMissingNameWithEmptyPath(mainNormalizedRecord, parent);
          }
          // we might be the child of an alias
          mainNormalizedRecord.aliasOf = originalRecord && originalRecord.record;
          const options = mergeOptions(globalOptions, record);
          // generate an array of records to correctly handle aliases
          const normalizedRecords = [
              mainNormalizedRecord,
          ];
          if ('alias' in record) {
              const aliases = typeof record.alias === 'string' ? [record.alias] : record.alias;
              for (const alias of aliases) {
                  normalizedRecords.push(assign({}, mainNormalizedRecord, {
                      // this allows us to hold a copy of the `components` option
                      // so that async components cache is hold on the original record
                      components: originalRecord
                          ? originalRecord.record.components
                          : mainNormalizedRecord.components,
                      path: alias,
                      // we might be the child of an alias
                      aliasOf: originalRecord
                          ? originalRecord.record
                          : mainNormalizedRecord,
                      // the aliases are always of the same kind as the original since they
                      // are defined on the same record
                  }));
              }
          }
          let matcher;
          let originalMatcher;
          for (const normalizedRecord of normalizedRecords) {
              const { path } = normalizedRecord;
              // Build up the path for nested routes if the child isn't an absolute
              // route. Only add the / delimiter if the child path isn't empty and if the
              // parent path doesn't have a trailing slash
              if (parent && path[0] !== '/') {
                  const parentPath = parent.record.path;
                  const connectingSlash = parentPath[parentPath.length - 1] === '/' ? '' : '/';
                  normalizedRecord.path =
                      parent.record.path + (path && connectingSlash + path);
              }
              if (normalizedRecord.path === '*') {
                  throw new Error('Catch all routes ("*") must now be defined using a param with a custom regexp.\n' +
                      'See more at https://next.router.vuejs.org/guide/migration/#removed-star-or-catch-all-routes.');
              }
              // create the object beforehand, so it can be passed to children
              matcher = createRouteRecordMatcher(normalizedRecord, parent, options);
              if (parent && path[0] === '/')
                  checkMissingParamsInAbsolutePath(matcher, parent);
              // if we are an alias we must tell the original record that we exist,
              // so we can be removed
              if (originalRecord) {
                  originalRecord.alias.push(matcher);
                  {
                      checkSameParams(originalRecord, matcher);
                  }
              }
              else {
                  // otherwise, the first record is the original and others are aliases
                  originalMatcher = originalMatcher || matcher;
                  if (originalMatcher !== matcher)
                      originalMatcher.alias.push(matcher);
                  // remove the route if named and only for the top record (avoid in nested calls)
                  // this works because the original record is the first one
                  if (isRootAdd && record.name && !isAliasRecord(matcher))
                      removeRoute(record.name);
              }
              if (mainNormalizedRecord.children) {
                  const children = mainNormalizedRecord.children;
                  for (let i = 0; i < children.length; i++) {
                      addRoute(children[i], matcher, originalRecord && originalRecord.children[i]);
                  }
              }
              // if there was no original record, then the first one was not an alias and all
              // other aliases (if any) need to reference this record when adding children
              originalRecord = originalRecord || matcher;
              // TODO: add normalized records for more flexibility
              // if (parent && isAliasRecord(originalRecord)) {
              //   parent.children.push(originalRecord)
              // }
              // Avoid adding a record that doesn't display anything. This allows passing through records without a component to
              // not be reached and pass through the catch all route
              if ((matcher.record.components &&
                  Object.keys(matcher.record.components).length) ||
                  matcher.record.name ||
                  matcher.record.redirect) {
                  insertMatcher(matcher);
              }
          }
          return originalMatcher
              ? () => {
                  // since other matchers are aliases, they should be removed by the original matcher
                  removeRoute(originalMatcher);
              }
              : noop;
      }
      function removeRoute(matcherRef) {
          if (isRouteName(matcherRef)) {
              const matcher = matcherMap.get(matcherRef);
              if (matcher) {
                  matcherMap.delete(matcherRef);
                  matchers.splice(matchers.indexOf(matcher), 1);
                  matcher.children.forEach(removeRoute);
                  matcher.alias.forEach(removeRoute);
              }
          }
          else {
              const index = matchers.indexOf(matcherRef);
              if (index > -1) {
                  matchers.splice(index, 1);
                  if (matcherRef.record.name)
                      matcherMap.delete(matcherRef.record.name);
                  matcherRef.children.forEach(removeRoute);
                  matcherRef.alias.forEach(removeRoute);
              }
          }
      }
      function getRoutes() {
          return matchers;
      }
      function insertMatcher(matcher) {
          let i = 0;
          while (i < matchers.length &&
              comparePathParserScore(matcher, matchers[i]) >= 0 &&
              // Adding children with empty path should still appear before the parent
              // https://github.com/vuejs/router/issues/1124
              (matcher.record.path !== matchers[i].record.path ||
                  !isRecordChildOf(matcher, matchers[i])))
              i++;
          matchers.splice(i, 0, matcher);
          // only add the original record to the name map
          if (matcher.record.name && !isAliasRecord(matcher))
              matcherMap.set(matcher.record.name, matcher);
      }
      function resolve(location, currentLocation) {
          let matcher;
          let params = {};
          let path;
          let name;
          if ('name' in location && location.name) {
              matcher = matcherMap.get(location.name);
              if (!matcher)
                  throw createRouterError(1 /* ErrorTypes.MATCHER_NOT_FOUND */, {
                      location,
                  });
              // warn if the user is passing invalid params so they can debug it better when they get removed
              {
                  const invalidParams = Object.keys(location.params || {}).filter(paramName => !matcher.keys.find(k => k.name === paramName));
                  if (invalidParams.length) {
                      warn(`Discarded invalid param(s) "${invalidParams.join('", "')}" when navigating. See https://github.com/vuejs/router/blob/main/packages/router/CHANGELOG.md#414-2022-08-22 for more details.`);
                  }
              }
              name = matcher.record.name;
              params = assign(
              // paramsFromLocation is a new object
              paramsFromLocation(currentLocation.params, 
              // only keep params that exist in the resolved location
              // TODO: only keep optional params coming from a parent record
              matcher.keys.filter(k => !k.optional).map(k => k.name)), 
              // discard any existing params in the current location that do not exist here
              // #1497 this ensures better active/exact matching
              location.params &&
                  paramsFromLocation(location.params, matcher.keys.map(k => k.name)));
              // throws if cannot be stringified
              path = matcher.stringify(params);
          }
          else if ('path' in location) {
              // no need to resolve the path with the matcher as it was provided
              // this also allows the user to control the encoding
              path = location.path;
              if (!path.startsWith('/')) {
                  warn(`The Matcher cannot resolve relative paths but received "${path}". Unless you directly called \`matcher.resolve("${path}")\`, this is probably a bug in vue-router. Please open an issue at https://new-issue.vuejs.org/?repo=vuejs/router.`);
              }
              matcher = matchers.find(m => m.re.test(path));
              // matcher should have a value after the loop
              if (matcher) {
                  // we know the matcher works because we tested the regexp
                  params = matcher.parse(path);
                  name = matcher.record.name;
              }
              // location is a relative path
          }
          else {
              // match by name or path of current route
              matcher = currentLocation.name
                  ? matcherMap.get(currentLocation.name)
                  : matchers.find(m => m.re.test(currentLocation.path));
              if (!matcher)
                  throw createRouterError(1 /* ErrorTypes.MATCHER_NOT_FOUND */, {
                      location,
                      currentLocation,
                  });
              name = matcher.record.name;
              // since we are navigating to the same location, we don't need to pick the
              // params like when `name` is provided
              params = assign({}, currentLocation.params, location.params);
              path = matcher.stringify(params);
          }
          const matched = [];
          let parentMatcher = matcher;
          while (parentMatcher) {
              // reversed order so parents are at the beginning
              matched.unshift(parentMatcher.record);
              parentMatcher = parentMatcher.parent;
          }
          return {
              name,
              path,
              params,
              matched,
              meta: mergeMetaFields(matched),
          };
      }
      // add initial routes
      routes.forEach(route => addRoute(route));
      return { addRoute, resolve, removeRoute, getRoutes, getRecordMatcher };
  }
  function paramsFromLocation(params, keys) {
      const newParams = {};
      for (const key of keys) {
          if (key in params)
              newParams[key] = params[key];
      }
      return newParams;
  }
  /**
   * Normalizes a RouteRecordRaw. Creates a copy
   *
   * @param record
   * @returns the normalized version
   */
  function normalizeRouteRecord(record) {
      return {
          path: record.path,
          redirect: record.redirect,
          name: record.name,
          meta: record.meta || {},
          aliasOf: undefined,
          beforeEnter: record.beforeEnter,
          props: normalizeRecordProps(record),
          children: record.children || [],
          instances: {},
          leaveGuards: new Set(),
          updateGuards: new Set(),
          enterCallbacks: {},
          components: 'components' in record
              ? record.components || null
              : record.component && { default: record.component },
      };
  }
  /**
   * Normalize the optional `props` in a record to always be an object similar to
   * components. Also accept a boolean for components.
   * @param record
   */
  function normalizeRecordProps(record) {
      const propsObject = {};
      // props does not exist on redirect records, but we can set false directly
      const props = record.props || false;
      if ('component' in record) {
          propsObject.default = props;
      }
      else {
          // NOTE: we could also allow a function to be applied to every component.
          // Would need user feedback for use cases
          for (const name in record.components)
              propsObject[name] = typeof props === 'boolean' ? props : props[name];
      }
      return propsObject;
  }
  /**
   * Checks if a record or any of its parent is an alias
   * @param record
   */
  function isAliasRecord(record) {
      while (record) {
          if (record.record.aliasOf)
              return true;
          record = record.parent;
      }
      return false;
  }
  /**
   * Merge meta fields of an array of records
   *
   * @param matched - array of matched records
   */
  function mergeMetaFields(matched) {
      return matched.reduce((meta, record) => assign(meta, record.meta), {});
  }
  function mergeOptions(defaults, partialOptions) {
      const options = {};
      for (const key in defaults) {
          options[key] = key in partialOptions ? partialOptions[key] : defaults[key];
      }
      return options;
  }
  function isSameParam(a, b) {
      return (a.name === b.name &&
          a.optional === b.optional &&
          a.repeatable === b.repeatable);
  }
  /**
   * Check if a path and its alias have the same required params
   *
   * @param a - original record
   * @param b - alias record
   */
  function checkSameParams(a, b) {
      for (const key of a.keys) {
          if (!key.optional && !b.keys.find(isSameParam.bind(null, key)))
              return warn(`Alias "${b.record.path}" and the original record: "${a.record.path}" must have the exact same param named "${key.name}"`);
      }
      for (const key of b.keys) {
          if (!key.optional && !a.keys.find(isSameParam.bind(null, key)))
              return warn(`Alias "${b.record.path}" and the original record: "${a.record.path}" must have the exact same param named "${key.name}"`);
      }
  }
  /**
   * A route with a name and a child with an empty path without a name should warn when adding the route
   *
   * @param mainNormalizedRecord - RouteRecordNormalized
   * @param parent - RouteRecordMatcher
   */
  function checkChildMissingNameWithEmptyPath(mainNormalizedRecord, parent) {
      if (parent &&
          parent.record.name &&
          !mainNormalizedRecord.name &&
          !mainNormalizedRecord.path) {
          warn(`The route named "${String(parent.record.name)}" has a child without a name and an empty path. Using that name won't render the empty path child so you probably want to move the name to the child instead. If this is intentional, add a name to the child route to remove the warning.`);
      }
  }
  function checkMissingParamsInAbsolutePath(record, parent) {
      for (const key of parent.keys) {
          if (!record.keys.find(isSameParam.bind(null, key)))
              return warn(`Absolute path "${record.record.path}" must have the exact same param named "${key.name}" as its parent "${parent.record.path}".`);
      }
  }
  function isRecordChildOf(record, parent) {
      return parent.children.some(child => child === record || isRecordChildOf(record, child));
  }

  /**
   * Encoding Rules ␣ = Space Path: ␣ " < > # ? { } Query: ␣ " < > # & = Hash: ␣ "
   * < > `
   *
   * On top of that, the RFC3986 (https://tools.ietf.org/html/rfc3986#section-2.2)
   * defines some extra characters to be encoded. Most browsers do not encode them
   * in encodeURI https://github.com/whatwg/url/issues/369, so it may be safer to
   * also encode `!'()*`. Leaving un-encoded only ASCII alphanumeric(`a-zA-Z0-9`)
   * plus `-._~`. This extra safety should be applied to query by patching the
   * string returned by encodeURIComponent encodeURI also encodes `[\]^`. `\`
   * should be encoded to avoid ambiguity. Browsers (IE, FF, C) transform a `\`
   * into a `/` if directly typed in. The _backtick_ (`````) should also be
   * encoded everywhere because some browsers like FF encode it when directly
   * written while others don't. Safari and IE don't encode ``"<>{}``` in hash.
   */
  // const EXTRA_RESERVED_RE = /[!'()*]/g
  // const encodeReservedReplacer = (c: string) => '%' + c.charCodeAt(0).toString(16)
  const HASH_RE = /#/g; // %23
  const AMPERSAND_RE = /&/g; // %26
  const SLASH_RE = /\//g; // %2F
  const EQUAL_RE = /=/g; // %3D
  const IM_RE = /\?/g; // %3F
  const PLUS_RE = /\+/g; // %2B
  /**
   * NOTE: It's not clear to me if we should encode the + symbol in queries, it
   * seems to be less flexible than not doing so and I can't find out the legacy
   * systems requiring this for regular requests like text/html. In the standard,
   * the encoding of the plus character is only mentioned for
   * application/x-www-form-urlencoded
   * (https://url.spec.whatwg.org/#urlencoded-parsing) and most browsers seems lo
   * leave the plus character as is in queries. To be more flexible, we allow the
   * plus character on the query, but it can also be manually encoded by the user.
   *
   * Resources:
   * - https://url.spec.whatwg.org/#urlencoded-parsing
   * - https://stackoverflow.com/questions/1634271/url-encoding-the-space-character-or-20
   */
  const ENC_BRACKET_OPEN_RE = /%5B/g; // [
  const ENC_BRACKET_CLOSE_RE = /%5D/g; // ]
  const ENC_CARET_RE = /%5E/g; // ^
  const ENC_BACKTICK_RE = /%60/g; // `
  const ENC_CURLY_OPEN_RE = /%7B/g; // {
  const ENC_PIPE_RE = /%7C/g; // |
  const ENC_CURLY_CLOSE_RE = /%7D/g; // }
  const ENC_SPACE_RE = /%20/g; // }
  /**
   * Encode characters that need to be encoded on the path, search and hash
   * sections of the URL.
   *
   * @internal
   * @param text - string to encode
   * @returns encoded string
   */
  function commonEncode(text) {
      return encodeURI('' + text)
          .replace(ENC_PIPE_RE, '|')
          .replace(ENC_BRACKET_OPEN_RE, '[')
          .replace(ENC_BRACKET_CLOSE_RE, ']');
  }
  /**
   * Encode characters that need to be encoded on the hash section of the URL.
   *
   * @param text - string to encode
   * @returns encoded string
   */
  function encodeHash(text) {
      return commonEncode(text)
          .replace(ENC_CURLY_OPEN_RE, '{')
          .replace(ENC_CURLY_CLOSE_RE, '}')
          .replace(ENC_CARET_RE, '^');
  }
  /**
   * Encode characters that need to be encoded query values on the query
   * section of the URL.
   *
   * @param text - string to encode
   * @returns encoded string
   */
  function encodeQueryValue(text) {
      return (commonEncode(text)
          // Encode the space as +, encode the + to differentiate it from the space
          .replace(PLUS_RE, '%2B')
          .replace(ENC_SPACE_RE, '+')
          .replace(HASH_RE, '%23')
          .replace(AMPERSAND_RE, '%26')
          .replace(ENC_BACKTICK_RE, '`')
          .replace(ENC_CURLY_OPEN_RE, '{')
          .replace(ENC_CURLY_CLOSE_RE, '}')
          .replace(ENC_CARET_RE, '^'));
  }
  /**
   * Like `encodeQueryValue` but also encodes the `=` character.
   *
   * @param text - string to encode
   */
  function encodeQueryKey(text) {
      return encodeQueryValue(text).replace(EQUAL_RE, '%3D');
  }
  /**
   * Encode characters that need to be encoded on the path section of the URL.
   *
   * @param text - string to encode
   * @returns encoded string
   */
  function encodePath(text) {
      return commonEncode(text).replace(HASH_RE, '%23').replace(IM_RE, '%3F');
  }
  /**
   * Encode characters that need to be encoded on the path section of the URL as a
   * param. This function encodes everything {@link encodePath} does plus the
   * slash (`/`) character. If `text` is `null` or `undefined`, returns an empty
   * string instead.
   *
   * @param text - string to encode
   * @returns encoded string
   */
  function encodeParam(text) {
      return text == null ? '' : encodePath(text).replace(SLASH_RE, '%2F');
  }
  /**
   * Decode text using `decodeURIComponent`. Returns the original text if it
   * fails.
   *
   * @param text - string to decode
   * @returns decoded string
   */
  function decode(text) {
      try {
          return decodeURIComponent('' + text);
      }
      catch (err) {
          warn(`Error decoding "${text}". Using original value`);
      }
      return '' + text;
  }

  /**
   * Transforms a queryString into a {@link LocationQuery} object. Accept both, a
   * version with the leading `?` and without Should work as URLSearchParams

   * @internal
   *
   * @param search - search string to parse
   * @returns a query object
   */
  function parseQuery(search) {
      const query = {};
      // avoid creating an object with an empty key and empty value
      // because of split('&')
      if (search === '' || search === '?')
          return query;
      const hasLeadingIM = search[0] === '?';
      const searchParams = (hasLeadingIM ? search.slice(1) : search).split('&');
      for (let i = 0; i < searchParams.length; ++i) {
          // pre decode the + into space
          const searchParam = searchParams[i].replace(PLUS_RE, ' ');
          // allow the = character
          const eqPos = searchParam.indexOf('=');
          const key = decode(eqPos < 0 ? searchParam : searchParam.slice(0, eqPos));
          const value = eqPos < 0 ? null : decode(searchParam.slice(eqPos + 1));
          if (key in query) {
              // an extra variable for ts types
              let currentValue = query[key];
              if (!isArray(currentValue)) {
                  currentValue = query[key] = [currentValue];
              }
              currentValue.push(value);
          }
          else {
              query[key] = value;
          }
      }
      return query;
  }
  /**
   * Stringifies a {@link LocationQueryRaw} object. Like `URLSearchParams`, it
   * doesn't prepend a `?`
   *
   * @internal
   *
   * @param query - query object to stringify
   * @returns string version of the query without the leading `?`
   */
  function stringifyQuery(query) {
      let search = '';
      for (let key in query) {
          const value = query[key];
          key = encodeQueryKey(key);
          if (value == null) {
              // only null adds the value
              if (value !== undefined) {
                  search += (search.length ? '&' : '') + key;
              }
              continue;
          }
          // keep null values
          const values = isArray(value)
              ? value.map(v => v && encodeQueryValue(v))
              : [value && encodeQueryValue(value)];
          values.forEach(value => {
              // skip undefined values in arrays as if they were not present
              // smaller code than using filter
              if (value !== undefined) {
                  // only append & with non-empty search
                  search += (search.length ? '&' : '') + key;
                  if (value != null)
                      search += '=' + value;
              }
          });
      }
      return search;
  }
  /**
   * Transforms a {@link LocationQueryRaw} into a {@link LocationQuery} by casting
   * numbers into strings, removing keys with an undefined value and replacing
   * undefined with null in arrays
   *
   * @param query - query object to normalize
   * @returns a normalized query object
   */
  function normalizeQuery(query) {
      const normalizedQuery = {};
      for (const key in query) {
          const value = query[key];
          if (value !== undefined) {
              normalizedQuery[key] = isArray(value)
                  ? value.map(v => (v == null ? null : '' + v))
                  : value == null
                      ? value
                      : '' + value;
          }
      }
      return normalizedQuery;
  }

  /**
   * RouteRecord being rendered by the closest ancestor Router View. Used for
   * `onBeforeRouteUpdate` and `onBeforeRouteLeave`. rvlm stands for Router View
   * Location Matched
   *
   * @internal
   */
  const matchedRouteKey = Symbol('router view location matched' );
  /**
   * Allows overriding the router view depth to control which component in
   * `matched` is rendered. rvd stands for Router View Depth
   *
   * @internal
   */
  const viewDepthKey = Symbol('router view depth' );
  /**
   * Allows overriding the router instance returned by `useRouter` in tests. r
   * stands for router
   *
   * @internal
   */
  const routerKey = Symbol('router' );
  /**
   * Allows overriding the current route returned by `useRoute` in tests. rl
   * stands for route location
   *
   * @internal
   */
  const routeLocationKey = Symbol('route location' );
  /**
   * Allows overriding the current route used by router-view. Internally this is
   * used when the `route` prop is passed.
   *
   * @internal
   */
  const routerViewLocationKey = Symbol('router view location' );

  /**
   * Create a list of callbacks that can be reset. Used to create before and after navigation guards list
   */
  function useCallbacks() {
      let handlers = [];
      function add(handler) {
          handlers.push(handler);
          return () => {
              const i = handlers.indexOf(handler);
              if (i > -1)
                  handlers.splice(i, 1);
          };
      }
      function reset() {
          handlers = [];
      }
      return {
          add,
          list: () => handlers,
          reset,
      };
  }

  function registerGuard(record, name, guard) {
      const removeFromList = () => {
          record[name].delete(guard);
      };
      vue.onUnmounted(removeFromList);
      vue.onDeactivated(removeFromList);
      vue.onActivated(() => {
          record[name].add(guard);
      });
      record[name].add(guard);
  }
  /**
   * Add a navigation guard that triggers whenever the component for the current
   * location is about to be left. Similar to {@link beforeRouteLeave} but can be
   * used in any component. The guard is removed when the component is unmounted.
   *
   * @param leaveGuard - {@link NavigationGuard}
   */
  function onBeforeRouteLeave(leaveGuard) {
      if (!vue.getCurrentInstance()) {
          warn('getCurrentInstance() returned null. onBeforeRouteLeave() must be called at the top of a setup function');
          return;
      }
      const activeRecord = vue.inject(matchedRouteKey, 
      // to avoid warning
      {}).value;
      if (!activeRecord) {
          warn('No active route record was found when calling `onBeforeRouteLeave()`. Make sure you call this function inside a component child of <router-view>. Maybe you called it inside of App.vue?');
          return;
      }
      registerGuard(activeRecord, 'leaveGuards', leaveGuard);
  }
  /**
   * Add a navigation guard that triggers whenever the current location is about
   * to be updated. Similar to {@link beforeRouteUpdate} but can be used in any
   * component. The guard is removed when the component is unmounted.
   *
   * @param updateGuard - {@link NavigationGuard}
   */
  function onBeforeRouteUpdate(updateGuard) {
      if (!vue.getCurrentInstance()) {
          warn('getCurrentInstance() returned null. onBeforeRouteUpdate() must be called at the top of a setup function');
          return;
      }
      const activeRecord = vue.inject(matchedRouteKey, 
      // to avoid warning
      {}).value;
      if (!activeRecord) {
          warn('No active route record was found when calling `onBeforeRouteUpdate()`. Make sure you call this function inside a component child of <router-view>. Maybe you called it inside of App.vue?');
          return;
      }
      registerGuard(activeRecord, 'updateGuards', updateGuard);
  }
  function guardToPromiseFn(guard, to, from, record, name) {
      // keep a reference to the enterCallbackArray to prevent pushing callbacks if a new navigation took place
      const enterCallbackArray = record &&
          // name is defined if record is because of the function overload
          (record.enterCallbacks[name] = record.enterCallbacks[name] || []);
      return () => new Promise((resolve, reject) => {
          const next = (valid) => {
              if (valid === false) {
                  reject(createRouterError(4 /* ErrorTypes.NAVIGATION_ABORTED */, {
                      from,
                      to,
                  }));
              }
              else if (valid instanceof Error) {
                  reject(valid);
              }
              else if (isRouteLocation(valid)) {
                  reject(createRouterError(2 /* ErrorTypes.NAVIGATION_GUARD_REDIRECT */, {
                      from: to,
                      to: valid,
                  }));
              }
              else {
                  if (enterCallbackArray &&
                      // since enterCallbackArray is truthy, both record and name also are
                      record.enterCallbacks[name] === enterCallbackArray &&
                      typeof valid === 'function') {
                      enterCallbackArray.push(valid);
                  }
                  resolve();
              }
          };
          // wrapping with Promise.resolve allows it to work with both async and sync guards
          const guardReturn = guard.call(record && record.instances[name], to, from, canOnlyBeCalledOnce(next, to, from) );
          let guardCall = Promise.resolve(guardReturn);
          if (guard.length < 3)
              guardCall = guardCall.then(next);
          if (guard.length > 2) {
              const message = `The "next" callback was never called inside of ${guard.name ? '"' + guard.name + '"' : ''}:\n${guard.toString()}\n. If you are returning a value instead of calling "next", make sure to remove the "next" parameter from your function.`;
              if (typeof guardReturn === 'object' && 'then' in guardReturn) {
                  guardCall = guardCall.then(resolvedValue => {
                      // @ts-expect-error: _called is added at canOnlyBeCalledOnce
                      if (!next._called) {
                          warn(message);
                          return Promise.reject(new Error('Invalid navigation guard'));
                      }
                      return resolvedValue;
                  });
              }
              else if (guardReturn !== undefined) {
                  // @ts-expect-error: _called is added at canOnlyBeCalledOnce
                  if (!next._called) {
                      warn(message);
                      reject(new Error('Invalid navigation guard'));
                      return;
                  }
              }
          }
          guardCall.catch(err => reject(err));
      });
  }
  function canOnlyBeCalledOnce(next, to, from) {
      let called = 0;
      return function () {
          if (called++ === 1)
              warn(`The "next" callback was called more than once in one navigation guard when going from "${from.fullPath}" to "${to.fullPath}". It should be called exactly one time in each navigation guard. This will fail in production.`);
          // @ts-expect-error: we put it in the original one because it's easier to check
          next._called = true;
          if (called === 1)
              next.apply(null, arguments);
      };
  }
  function extractComponentsGuards(matched, guardType, to, from) {
      const guards = [];
      for (const record of matched) {
          if (!record.components && !record.children.length) {
              warn(`Record with path "${record.path}" is either missing a "component(s)"` +
                  ` or "children" property.`);
          }
          for (const name in record.components) {
              let rawComponent = record.components[name];
              {
                  if (!rawComponent ||
                      (typeof rawComponent !== 'object' &&
                          typeof rawComponent !== 'function')) {
                      warn(`Component "${name}" in record with path "${record.path}" is not` +
                          ` a valid component. Received "${String(rawComponent)}".`);
                      // throw to ensure we stop here but warn to ensure the message isn't
                      // missed by the user
                      throw new Error('Invalid route component');
                  }
                  else if ('then' in rawComponent) {
                      // warn if user wrote import('/component.vue') instead of () =>
                      // import('./component.vue')
                      warn(`Component "${name}" in record with path "${record.path}" is a ` +
                          `Promise instead of a function that returns a Promise. Did you ` +
                          `write "import('./MyPage.vue')" instead of ` +
                          `"() => import('./MyPage.vue')" ? This will break in ` +
                          `production if not fixed.`);
                      const promise = rawComponent;
                      rawComponent = () => promise;
                  }
                  else if (rawComponent.__asyncLoader &&
                      // warn only once per component
                      !rawComponent.__warnedDefineAsync) {
                      rawComponent.__warnedDefineAsync = true;
                      warn(`Component "${name}" in record with path "${record.path}" is defined ` +
                          `using "defineAsyncComponent()". ` +
                          `Write "() => import('./MyPage.vue')" instead of ` +
                          `"defineAsyncComponent(() => import('./MyPage.vue'))".`);
                  }
              }
              // skip update and leave guards if the route component is not mounted
              if (guardType !== 'beforeRouteEnter' && !record.instances[name])
                  continue;
              if (isRouteComponent(rawComponent)) {
                  // __vccOpts is added by vue-class-component and contain the regular options
                  const options = rawComponent.__vccOpts || rawComponent;
                  const guard = options[guardType];
                  guard && guards.push(guardToPromiseFn(guard, to, from, record, name));
              }
              else {
                  // start requesting the chunk already
                  let componentPromise = rawComponent();
                  if (!('catch' in componentPromise)) {
                      warn(`Component "${name}" in record with path "${record.path}" is a function that does not return a Promise. If you were passing a functional component, make sure to add a "displayName" to the component. This will break in production if not fixed.`);
                      componentPromise = Promise.resolve(componentPromise);
                  }
                  guards.push(() => componentPromise.then(resolved => {
                      if (!resolved)
                          return Promise.reject(new Error(`Couldn't resolve component "${name}" at "${record.path}"`));
                      const resolvedComponent = isESModule(resolved)
                          ? resolved.default
                          : resolved;
                      // replace the function with the resolved component
                      // cannot be null or undefined because we went into the for loop
                      record.components[name] = resolvedComponent;
                      // __vccOpts is added by vue-class-component and contain the regular options
                      const options = resolvedComponent.__vccOpts || resolvedComponent;
                      const guard = options[guardType];
                      return guard && guardToPromiseFn(guard, to, from, record, name)();
                  }));
              }
          }
      }
      return guards;
  }
  /**
   * Allows differentiating lazy components from functional components and vue-class-component
   * @internal
   *
   * @param component
   */
  function isRouteComponent(component) {
      return (typeof component === 'object' ||
          'displayName' in component ||
          'props' in component ||
          '__vccOpts' in component);
  }
  /**
   * Ensures a route is loaded, so it can be passed as o prop to `<RouterView>`.
   *
   * @param route - resolved route to load
   */
  function loadRouteLocation(route) {
      return route.matched.every(record => record.redirect)
          ? Promise.reject(new Error('Cannot load a route that redirects.'))
          : Promise.all(route.matched.map(record => record.components &&
              Promise.all(Object.keys(record.components).reduce((promises, name) => {
                  const rawComponent = record.components[name];
                  if (typeof rawComponent === 'function' &&
                      !('displayName' in rawComponent)) {
                      promises.push(rawComponent().then(resolved => {
                          if (!resolved)
                              return Promise.reject(new Error(`Couldn't resolve component "${name}" at "${record.path}". Ensure you passed a function that returns a promise.`));
                          const resolvedComponent = isESModule(resolved)
                              ? resolved.default
                              : resolved;
                          // replace the function with the resolved component
                          // cannot be null or undefined because we went into the for loop
                          record.components[name] = resolvedComponent;
                          return;
                      }));
                  }
                  return promises;
              }, [])))).then(() => route);
  }

  // TODO: we could allow currentRoute as a prop to expose `isActive` and
  // `isExactActive` behavior should go through an RFC
  function useLink(props) {
      const router = vue.inject(routerKey);
      const currentRoute = vue.inject(routeLocationKey);
      const route = vue.computed(() => router.resolve(vue.unref(props.to)));
      const activeRecordIndex = vue.computed(() => {
          const { matched } = route.value;
          const { length } = matched;
          const routeMatched = matched[length - 1];
          const currentMatched = currentRoute.matched;
          if (!routeMatched || !currentMatched.length)
              return -1;
          const index = currentMatched.findIndex(isSameRouteRecord.bind(null, routeMatched));
          if (index > -1)
              return index;
          // possible parent record
          const parentRecordPath = getOriginalPath(matched[length - 2]);
          return (
          // we are dealing with nested routes
          length > 1 &&
              // if the parent and matched route have the same path, this link is
              // referring to the empty child. Or we currently are on a different
              // child of the same parent
              getOriginalPath(routeMatched) === parentRecordPath &&
              // avoid comparing the child with its parent
              currentMatched[currentMatched.length - 1].path !== parentRecordPath
              ? currentMatched.findIndex(isSameRouteRecord.bind(null, matched[length - 2]))
              : index);
      });
      const isActive = vue.computed(() => activeRecordIndex.value > -1 &&
          includesParams(currentRoute.params, route.value.params));
      const isExactActive = vue.computed(() => activeRecordIndex.value > -1 &&
          activeRecordIndex.value === currentRoute.matched.length - 1 &&
          isSameRouteLocationParams(currentRoute.params, route.value.params));
      function navigate(e = {}) {
          if (guardEvent(e)) {
              return router[vue.unref(props.replace) ? 'replace' : 'push'](vue.unref(props.to)
              // avoid uncaught errors are they are logged anyway
              ).catch(noop);
          }
          return Promise.resolve();
      }
      // devtools only
      if (isBrowser) {
          const instance = vue.getCurrentInstance();
          if (instance) {
              const linkContextDevtools = {
                  route: route.value,
                  isActive: isActive.value,
                  isExactActive: isExactActive.value,
              };
              // @ts-expect-error: this is internal
              instance.__vrl_devtools = instance.__vrl_devtools || [];
              // @ts-expect-error: this is internal
              instance.__vrl_devtools.push(linkContextDevtools);
              vue.watchEffect(() => {
                  linkContextDevtools.route = route.value;
                  linkContextDevtools.isActive = isActive.value;
                  linkContextDevtools.isExactActive = isExactActive.value;
              }, { flush: 'post' });
          }
      }
      /**
       * NOTE: update {@link _RouterLinkI}'s `$slots` type when updating this
       */
      return {
          route,
          href: vue.computed(() => route.value.href),
          isActive,
          isExactActive,
          navigate,
      };
  }
  const RouterLinkImpl = /*#__PURE__*/ vue.defineComponent({
      name: 'RouterLink',
      compatConfig: { MODE: 3 },
      props: {
          to: {
              type: [String, Object],
              required: true,
          },
          replace: Boolean,
          activeClass: String,
          // inactiveClass: String,
          exactActiveClass: String,
          custom: Boolean,
          ariaCurrentValue: {
              type: String,
              default: 'page',
          },
      },
      useLink,
      setup(props, { slots }) {
          const link = vue.reactive(useLink(props));
          const { options } = vue.inject(routerKey);
          const elClass = vue.computed(() => ({
              [getLinkClass(props.activeClass, options.linkActiveClass, 'router-link-active')]: link.isActive,
              // [getLinkClass(
              //   props.inactiveClass,
              //   options.linkInactiveClass,
              //   'router-link-inactive'
              // )]: !link.isExactActive,
              [getLinkClass(props.exactActiveClass, options.linkExactActiveClass, 'router-link-exact-active')]: link.isExactActive,
          }));
          return () => {
              const children = slots.default && slots.default(link);
              return props.custom
                  ? children
                  : vue.h('a', {
                      'aria-current': link.isExactActive
                          ? props.ariaCurrentValue
                          : null,
                      href: link.href,
                      // this would override user added attrs but Vue will still add
                      // the listener, so we end up triggering both
                      onClick: link.navigate,
                      class: elClass.value,
                  }, children);
          };
      },
  });
  // export the public type for h/tsx inference
  // also to avoid inline import() in generated d.ts files
  /**
   * Component to render a link that triggers a navigation on click.
   */
  const RouterLink = RouterLinkImpl;
  function guardEvent(e) {
      // don't redirect with control keys
      if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
          return;
      // don't redirect when preventDefault called
      if (e.defaultPrevented)
          return;
      // don't redirect on right click
      if (e.button !== undefined && e.button !== 0)
          return;
      // don't redirect if `target="_blank"`
      // @ts-expect-error getAttribute does exist
      if (e.currentTarget && e.currentTarget.getAttribute) {
          // @ts-expect-error getAttribute exists
          const target = e.currentTarget.getAttribute('target');
          if (/\b_blank\b/i.test(target))
              return;
      }
      // this may be a Weex event which doesn't have this method
      if (e.preventDefault)
          e.preventDefault();
      return true;
  }
  function includesParams(outer, inner) {
      for (const key in inner) {
          const innerValue = inner[key];
          const outerValue = outer[key];
          if (typeof innerValue === 'string') {
              if (innerValue !== outerValue)
                  return false;
          }
          else {
              if (!isArray(outerValue) ||
                  outerValue.length !== innerValue.length ||
                  innerValue.some((value, i) => value !== outerValue[i]))
                  return false;
          }
      }
      return true;
  }
  /**
   * Get the original path value of a record by following its aliasOf
   * @param record
   */
  function getOriginalPath(record) {
      return record ? (record.aliasOf ? record.aliasOf.path : record.path) : '';
  }
  /**
   * Utility class to get the active class based on defaults.
   * @param propClass
   * @param globalClass
   * @param defaultClass
   */
  const getLinkClass = (propClass, globalClass, defaultClass) => propClass != null
      ? propClass
      : globalClass != null
          ? globalClass
          : defaultClass;

  const RouterViewImpl = /*#__PURE__*/ vue.defineComponent({
      name: 'RouterView',
      // #674 we manually inherit them
      inheritAttrs: false,
      props: {
          name: {
              type: String,
              default: 'default',
          },
          route: Object,
      },
      // Better compat for @vue/compat users
      // https://github.com/vuejs/router/issues/1315
      compatConfig: { MODE: 3 },
      setup(props, { attrs, slots }) {
          warnDeprecatedUsage();
          const injectedRoute = vue.inject(routerViewLocationKey);
          const routeToDisplay = vue.computed(() => props.route || injectedRoute.value);
          const injectedDepth = vue.inject(viewDepthKey, 0);
          // The depth changes based on empty components option, which allows passthrough routes e.g. routes with children
          // that are used to reuse the `path` property
          const depth = vue.computed(() => {
              let initialDepth = vue.unref(injectedDepth);
              const { matched } = routeToDisplay.value;
              let matchedRoute;
              while ((matchedRoute = matched[initialDepth]) &&
                  !matchedRoute.components) {
                  initialDepth++;
              }
              return initialDepth;
          });
          const matchedRouteRef = vue.computed(() => routeToDisplay.value.matched[depth.value]);
          vue.provide(viewDepthKey, vue.computed(() => depth.value + 1));
          vue.provide(matchedRouteKey, matchedRouteRef);
          vue.provide(routerViewLocationKey, routeToDisplay);
          const viewRef = vue.ref();
          // watch at the same time the component instance, the route record we are
          // rendering, and the name
          vue.watch(() => [viewRef.value, matchedRouteRef.value, props.name], ([instance, to, name], [oldInstance, from, oldName]) => {
              // copy reused instances
              if (to) {
                  // this will update the instance for new instances as well as reused
                  // instances when navigating to a new route
                  to.instances[name] = instance;
                  // the component instance is reused for a different route or name, so
                  // we copy any saved update or leave guards. With async setup, the
                  // mounting component will mount before the matchedRoute changes,
                  // making instance === oldInstance, so we check if guards have been
                  // added before. This works because we remove guards when
                  // unmounting/deactivating components
                  if (from && from !== to && instance && instance === oldInstance) {
                      if (!to.leaveGuards.size) {
                          to.leaveGuards = from.leaveGuards;
                      }
                      if (!to.updateGuards.size) {
                          to.updateGuards = from.updateGuards;
                      }
                  }
              }
              // trigger beforeRouteEnter next callbacks
              if (instance &&
                  to &&
                  // if there is no instance but to and from are the same this might be
                  // the first visit
                  (!from || !isSameRouteRecord(to, from) || !oldInstance)) {
                  (to.enterCallbacks[name] || []).forEach(callback => callback(instance));
              }
          }, { flush: 'post' });
          return () => {
              const route = routeToDisplay.value;
              // we need the value at the time we render because when we unmount, we
              // navigated to a different location so the value is different
              const currentName = props.name;
              const matchedRoute = matchedRouteRef.value;
              const ViewComponent = matchedRoute && matchedRoute.components[currentName];
              if (!ViewComponent) {
                  return normalizeSlot(slots.default, { Component: ViewComponent, route });
              }
              // props from route configuration
              const routePropsOption = matchedRoute.props[currentName];
              const routeProps = routePropsOption
                  ? routePropsOption === true
                      ? route.params
                      : typeof routePropsOption === 'function'
                          ? routePropsOption(route)
                          : routePropsOption
                  : null;
              const onVnodeUnmounted = vnode => {
                  // remove the instance reference to prevent leak
                  if (vnode.component.isUnmounted) {
                      matchedRoute.instances[currentName] = null;
                  }
              };
              const component = vue.h(ViewComponent, assign({}, routeProps, attrs, {
                  onVnodeUnmounted,
                  ref: viewRef,
              }));
              if (isBrowser &&
                  component.ref) {
                  // TODO: can display if it's an alias, its props
                  const info = {
                      depth: depth.value,
                      name: matchedRoute.name,
                      path: matchedRoute.path,
                      meta: matchedRoute.meta,
                  };
                  const internalInstances = isArray(component.ref)
                      ? component.ref.map(r => r.i)
                      : [component.ref.i];
                  internalInstances.forEach(instance => {
                      // @ts-expect-error
                      instance.__vrv_devtools = info;
                  });
              }
              return (
              // pass the vnode to the slot as a prop.
              // h and <component :is="..."> both accept vnodes
              normalizeSlot(slots.default, { Component: component, route }) ||
                  component);
          };
      },
  });
  function normalizeSlot(slot, data) {
      if (!slot)
          return null;
      const slotContent = slot(data);
      return slotContent.length === 1 ? slotContent[0] : slotContent;
  }
  // export the public type for h/tsx inference
  // also to avoid inline import() in generated d.ts files
  /**
   * Component to display the current route the user is at.
   */
  const RouterView = RouterViewImpl;
  // warn against deprecated usage with <transition> & <keep-alive>
  // due to functional component being no longer eager in Vue 3
  function warnDeprecatedUsage() {
      const instance = vue.getCurrentInstance();
      const parentName = instance.parent && instance.parent.type.name;
      if (parentName &&
          (parentName === 'KeepAlive' || parentName.includes('Transition'))) {
          const comp = parentName === 'KeepAlive' ? 'keep-alive' : 'transition';
          warn(`<router-view> can no longer be used directly inside <transition> or <keep-alive>.\n` +
              `Use slot props instead:\n\n` +
              `<router-view v-slot="{ Component }">\n` +
              `  <${comp}>\n` +
              `    <component :is="Component" />\n` +
              `  </${comp}>\n` +
              `</router-view>`);
      }
  }

  function getDevtoolsGlobalHook() {
      return getTarget().__VUE_DEVTOOLS_GLOBAL_HOOK__;
  }
  function getTarget() {
      // @ts-ignore
      return (typeof navigator !== 'undefined' && typeof window !== 'undefined')
          ? window
          : typeof global !== 'undefined'
              ? global
              : {};
  }
  const isProxyAvailable = typeof Proxy === 'function';

  const HOOK_SETUP = 'devtools-plugin:setup';
  const HOOK_PLUGIN_SETTINGS_SET = 'plugin:settings:set';

  let supported;
  let perf;
  function isPerformanceSupported() {
      var _a;
      if (supported !== undefined) {
          return supported;
      }
      if (typeof window !== 'undefined' && window.performance) {
          supported = true;
          perf = window.performance;
      }
      else if (typeof global !== 'undefined' && ((_a = global.perf_hooks) === null || _a === void 0 ? void 0 : _a.performance)) {
          supported = true;
          perf = global.perf_hooks.performance;
      }
      else {
          supported = false;
      }
      return supported;
  }
  function now() {
      return isPerformanceSupported() ? perf.now() : Date.now();
  }

  class ApiProxy {
      constructor(plugin, hook) {
          this.target = null;
          this.targetQueue = [];
          this.onQueue = [];
          this.plugin = plugin;
          this.hook = hook;
          const defaultSettings = {};
          if (plugin.settings) {
              for (const id in plugin.settings) {
                  const item = plugin.settings[id];
                  defaultSettings[id] = item.defaultValue;
              }
          }
          const localSettingsSaveId = `__vue-devtools-plugin-settings__${plugin.id}`;
          let currentSettings = Object.assign({}, defaultSettings);
          try {
              const raw = localStorage.getItem(localSettingsSaveId);
              const data = JSON.parse(raw);
              Object.assign(currentSettings, data);
          }
          catch (e) {
              // noop
          }
          this.fallbacks = {
              getSettings() {
                  return currentSettings;
              },
              setSettings(value) {
                  try {
                      localStorage.setItem(localSettingsSaveId, JSON.stringify(value));
                  }
                  catch (e) {
                      // noop
                  }
                  currentSettings = value;
              },
              now() {
                  return now();
              },
          };
          if (hook) {
              hook.on(HOOK_PLUGIN_SETTINGS_SET, (pluginId, value) => {
                  if (pluginId === this.plugin.id) {
                      this.fallbacks.setSettings(value);
                  }
              });
          }
          this.proxiedOn = new Proxy({}, {
              get: (_target, prop) => {
                  if (this.target) {
                      return this.target.on[prop];
                  }
                  else {
                      return (...args) => {
                          this.onQueue.push({
                              method: prop,
                              args,
                          });
                      };
                  }
              },
          });
          this.proxiedTarget = new Proxy({}, {
              get: (_target, prop) => {
                  if (this.target) {
                      return this.target[prop];
                  }
                  else if (prop === 'on') {
                      return this.proxiedOn;
                  }
                  else if (Object.keys(this.fallbacks).includes(prop)) {
                      return (...args) => {
                          this.targetQueue.push({
                              method: prop,
                              args,
                              resolve: () => { },
                          });
                          return this.fallbacks[prop](...args);
                      };
                  }
                  else {
                      return (...args) => {
                          return new Promise(resolve => {
                              this.targetQueue.push({
                                  method: prop,
                                  args,
                                  resolve,
                              });
                          });
                      };
                  }
              },
          });
      }
      async setRealTarget(target) {
          this.target = target;
          for (const item of this.onQueue) {
              this.target.on[item.method](...item.args);
          }
          for (const item of this.targetQueue) {
              item.resolve(await this.target[item.method](...item.args));
          }
      }
  }

  function setupDevtoolsPlugin(pluginDescriptor, setupFn) {
      const descriptor = pluginDescriptor;
      const target = getTarget();
      const hook = getDevtoolsGlobalHook();
      const enableProxy = isProxyAvailable && descriptor.enableEarlyProxy;
      if (hook && (target.__VUE_DEVTOOLS_PLUGIN_API_AVAILABLE__ || !enableProxy)) {
          hook.emit(HOOK_SETUP, pluginDescriptor, setupFn);
      }
      else {
          const proxy = enableProxy ? new ApiProxy(descriptor, hook) : null;
          const list = target.__VUE_DEVTOOLS_PLUGINS__ = target.__VUE_DEVTOOLS_PLUGINS__ || [];
          list.push({
              pluginDescriptor: descriptor,
              setupFn,
              proxy,
          });
          if (proxy)
              setupFn(proxy.proxiedTarget);
      }
  }

  /**
   * Copies a route location and removes any problematic properties that cannot be shown in devtools (e.g. Vue instances).
   *
   * @param routeLocation - routeLocation to format
   * @param tooltip - optional tooltip
   * @returns a copy of the routeLocation
   */
  function formatRouteLocation(routeLocation, tooltip) {
      const copy = assign({}, routeLocation, {
          // remove variables that can contain vue instances
          matched: routeLocation.matched.map(matched => omit(matched, ['instances', 'children', 'aliasOf'])),
      });
      return {
          _custom: {
              type: null,
              readOnly: true,
              display: routeLocation.fullPath,
              tooltip,
              value: copy,
          },
      };
  }
  function formatDisplay(display) {
      return {
          _custom: {
              display,
          },
      };
  }
  // to support multiple router instances
  let routerId = 0;
  function addDevtools(app, router, matcher) {
      // Take over router.beforeEach and afterEach
      // make sure we are not registering the devtool twice
      if (router.__hasDevtools)
          return;
      router.__hasDevtools = true;
      // increment to support multiple router instances
      const id = routerId++;
      setupDevtoolsPlugin({
          id: 'org.vuejs.router' + (id ? '.' + id : ''),
          label: 'Vue Router',
          packageName: 'vue-router',
          homepage: 'https://router.vuejs.org',
          logo: 'https://router.vuejs.org/logo.png',
          componentStateTypes: ['Routing'],
          app,
      }, api => {
          if (typeof api.now !== 'function') {
              console.warn('[Vue Router]: You seem to be using an outdated version of Vue Devtools. Are you still using the Beta release instead of the stable one? You can find the links at https://devtools.vuejs.org/guide/installation.html.');
          }
          // display state added by the router
          api.on.inspectComponent((payload, ctx) => {
              if (payload.instanceData) {
                  payload.instanceData.state.push({
                      type: 'Routing',
                      key: '$route',
                      editable: false,
                      value: formatRouteLocation(router.currentRoute.value, 'Current Route'),
                  });
              }
          });
          // mark router-link as active and display tags on router views
          api.on.visitComponentTree(({ treeNode: node, componentInstance }) => {
              if (componentInstance.__vrv_devtools) {
                  const info = componentInstance.__vrv_devtools;
                  node.tags.push({
                      label: (info.name ? `${info.name.toString()}: ` : '') + info.path,
                      textColor: 0,
                      tooltip: 'This component is rendered by &lt;router-view&gt;',
                      backgroundColor: PINK_500,
                  });
              }
              // if multiple useLink are used
              if (isArray(componentInstance.__vrl_devtools)) {
                  componentInstance.__devtoolsApi = api;
                  componentInstance.__vrl_devtools.forEach(devtoolsData => {
                      let backgroundColor = ORANGE_400;
                      let tooltip = '';
                      if (devtoolsData.isExactActive) {
                          backgroundColor = LIME_500;
                          tooltip = 'This is exactly active';
                      }
                      else if (devtoolsData.isActive) {
                          backgroundColor = BLUE_600;
                          tooltip = 'This link is active';
                      }
                      node.tags.push({
                          label: devtoolsData.route.path,
                          textColor: 0,
                          tooltip,
                          backgroundColor,
                      });
                  });
              }
          });
          vue.watch(router.currentRoute, () => {
              // refresh active state
              refreshRoutesView();
              api.notifyComponentUpdate();
              api.sendInspectorTree(routerInspectorId);
              api.sendInspectorState(routerInspectorId);
          });
          const navigationsLayerId = 'router:navigations:' + id;
          api.addTimelineLayer({
              id: navigationsLayerId,
              label: `Router${id ? ' ' + id : ''} Navigations`,
              color: 0x40a8c4,
          });
          // const errorsLayerId = 'router:errors'
          // api.addTimelineLayer({
          //   id: errorsLayerId,
          //   label: 'Router Errors',
          //   color: 0xea5455,
          // })
          router.onError((error, to) => {
              api.addTimelineEvent({
                  layerId: navigationsLayerId,
                  event: {
                      title: 'Error during Navigation',
                      subtitle: to.fullPath,
                      logType: 'error',
                      time: api.now(),
                      data: { error },
                      groupId: to.meta.__navigationId,
                  },
              });
          });
          // attached to `meta` and used to group events
          let navigationId = 0;
          router.beforeEach((to, from) => {
              const data = {
                  guard: formatDisplay('beforeEach'),
                  from: formatRouteLocation(from, 'Current Location during this navigation'),
                  to: formatRouteLocation(to, 'Target location'),
              };
              // Used to group navigations together, hide from devtools
              Object.defineProperty(to.meta, '__navigationId', {
                  value: navigationId++,
              });
              api.addTimelineEvent({
                  layerId: navigationsLayerId,
                  event: {
                      time: api.now(),
                      title: 'Start of navigation',
                      subtitle: to.fullPath,
                      data,
                      groupId: to.meta.__navigationId,
                  },
              });
          });
          router.afterEach((to, from, failure) => {
              const data = {
                  guard: formatDisplay('afterEach'),
              };
              if (failure) {
                  data.failure = {
                      _custom: {
                          type: Error,
                          readOnly: true,
                          display: failure ? failure.message : '',
                          tooltip: 'Navigation Failure',
                          value: failure,
                      },
                  };
                  data.status = formatDisplay('❌');
              }
              else {
                  data.status = formatDisplay('✅');
              }
              // we set here to have the right order
              data.from = formatRouteLocation(from, 'Current Location during this navigation');
              data.to = formatRouteLocation(to, 'Target location');
              api.addTimelineEvent({
                  layerId: navigationsLayerId,
                  event: {
                      title: 'End of navigation',
                      subtitle: to.fullPath,
                      time: api.now(),
                      data,
                      logType: failure ? 'warning' : 'default',
                      groupId: to.meta.__navigationId,
                  },
              });
          });
          /**
           * Inspector of Existing routes
           */
          const routerInspectorId = 'router-inspector:' + id;
          api.addInspector({
              id: routerInspectorId,
              label: 'Routes' + (id ? ' ' + id : ''),
              icon: 'book',
              treeFilterPlaceholder: 'Search routes',
          });
          function refreshRoutesView() {
              // the routes view isn't active
              if (!activeRoutesPayload)
                  return;
              const payload = activeRoutesPayload;
              // children routes will appear as nested
              let routes = matcher.getRoutes().filter(route => !route.parent);
              // reset match state to false
              routes.forEach(resetMatchStateOnRouteRecord);
              // apply a match state if there is a payload
              if (payload.filter) {
                  routes = routes.filter(route => 
                  // save matches state based on the payload
                  isRouteMatching(route, payload.filter.toLowerCase()));
              }
              // mark active routes
              routes.forEach(route => markRouteRecordActive(route, router.currentRoute.value));
              payload.rootNodes = routes.map(formatRouteRecordForInspector);
          }
          let activeRoutesPayload;
          api.on.getInspectorTree(payload => {
              activeRoutesPayload = payload;
              if (payload.app === app && payload.inspectorId === routerInspectorId) {
                  refreshRoutesView();
              }
          });
          /**
           * Display information about the currently selected route record
           */
          api.on.getInspectorState(payload => {
              if (payload.app === app && payload.inspectorId === routerInspectorId) {
                  const routes = matcher.getRoutes();
                  const route = routes.find(route => route.record.__vd_id === payload.nodeId);
                  if (route) {
                      payload.state = {
                          options: formatRouteRecordMatcherForStateInspector(route),
                      };
                  }
              }
          });
          api.sendInspectorTree(routerInspectorId);
          api.sendInspectorState(routerInspectorId);
      });
  }
  function modifierForKey(key) {
      if (key.optional) {
          return key.repeatable ? '*' : '?';
      }
      else {
          return key.repeatable ? '+' : '';
      }
  }
  function formatRouteRecordMatcherForStateInspector(route) {
      const { record } = route;
      const fields = [
          { editable: false, key: 'path', value: record.path },
      ];
      if (record.name != null) {
          fields.push({
              editable: false,
              key: 'name',
              value: record.name,
          });
      }
      fields.push({ editable: false, key: 'regexp', value: route.re });
      if (route.keys.length) {
          fields.push({
              editable: false,
              key: 'keys',
              value: {
                  _custom: {
                      type: null,
                      readOnly: true,
                      display: route.keys
                          .map(key => `${key.name}${modifierForKey(key)}`)
                          .join(' '),
                      tooltip: 'Param keys',
                      value: route.keys,
                  },
              },
          });
      }
      if (record.redirect != null) {
          fields.push({
              editable: false,
              key: 'redirect',
              value: record.redirect,
          });
      }
      if (route.alias.length) {
          fields.push({
              editable: false,
              key: 'aliases',
              value: route.alias.map(alias => alias.record.path),
          });
      }
      if (Object.keys(route.record.meta).length) {
          fields.push({
              editable: false,
              key: 'meta',
              value: route.record.meta,
          });
      }
      fields.push({
          key: 'score',
          editable: false,
          value: {
              _custom: {
                  type: null,
                  readOnly: true,
                  display: route.score.map(score => score.join(', ')).join(' | '),
                  tooltip: 'Score used to sort routes',
                  value: route.score,
              },
          },
      });
      return fields;
  }
  /**
   * Extracted from tailwind palette
   */
  const PINK_500 = 0xec4899;
  const BLUE_600 = 0x2563eb;
  const LIME_500 = 0x84cc16;
  const CYAN_400 = 0x22d3ee;
  const ORANGE_400 = 0xfb923c;
  // const GRAY_100 = 0xf4f4f5
  const DARK = 0x666666;
  function formatRouteRecordForInspector(route) {
      const tags = [];
      const { record } = route;
      if (record.name != null) {
          tags.push({
              label: String(record.name),
              textColor: 0,
              backgroundColor: CYAN_400,
          });
      }
      if (record.aliasOf) {
          tags.push({
              label: 'alias',
              textColor: 0,
              backgroundColor: ORANGE_400,
          });
      }
      if (route.__vd_match) {
          tags.push({
              label: 'matches',
              textColor: 0,
              backgroundColor: PINK_500,
          });
      }
      if (route.__vd_exactActive) {
          tags.push({
              label: 'exact',
              textColor: 0,
              backgroundColor: LIME_500,
          });
      }
      if (route.__vd_active) {
          tags.push({
              label: 'active',
              textColor: 0,
              backgroundColor: BLUE_600,
          });
      }
      if (record.redirect) {
          tags.push({
              label: typeof record.redirect === 'string'
                  ? `redirect: ${record.redirect}`
                  : 'redirects',
              textColor: 0xffffff,
              backgroundColor: DARK,
          });
      }
      // add an id to be able to select it. Using the `path` is not possible because
      // empty path children would collide with their parents
      let id = record.__vd_id;
      if (id == null) {
          id = String(routeRecordId++);
          record.__vd_id = id;
      }
      return {
          id,
          label: record.path,
          tags,
          children: route.children.map(formatRouteRecordForInspector),
      };
  }
  //  incremental id for route records and inspector state
  let routeRecordId = 0;
  const EXTRACT_REGEXP_RE = /^\/(.*)\/([a-z]*)$/;
  function markRouteRecordActive(route, currentRoute) {
      // no route will be active if matched is empty
      // reset the matching state
      const isExactActive = currentRoute.matched.length &&
          isSameRouteRecord(currentRoute.matched[currentRoute.matched.length - 1], route.record);
      route.__vd_exactActive = route.__vd_active = isExactActive;
      if (!isExactActive) {
          route.__vd_active = currentRoute.matched.some(match => isSameRouteRecord(match, route.record));
      }
      route.children.forEach(childRoute => markRouteRecordActive(childRoute, currentRoute));
  }
  function resetMatchStateOnRouteRecord(route) {
      route.__vd_match = false;
      route.children.forEach(resetMatchStateOnRouteRecord);
  }
  function isRouteMatching(route, filter) {
      const found = String(route.re).match(EXTRACT_REGEXP_RE);
      route.__vd_match = false;
      if (!found || found.length < 3) {
          return false;
      }
      // use a regexp without $ at the end to match nested routes better
      const nonEndingRE = new RegExp(found[1].replace(/\$$/, ''), found[2]);
      if (nonEndingRE.test(filter)) {
          // mark children as matches
          route.children.forEach(child => isRouteMatching(child, filter));
          // exception case: `/`
          if (route.record.path !== '/' || filter === '/') {
              route.__vd_match = route.re.test(filter);
              return true;
          }
          // hide the / route
          return false;
      }
      const path = route.record.path.toLowerCase();
      const decodedPath = decode(path);
      // also allow partial matching on the path
      if (!filter.startsWith('/') &&
          (decodedPath.includes(filter) || path.includes(filter)))
          return true;
      if (decodedPath.startsWith(filter) || path.startsWith(filter))
          return true;
      if (route.record.name && String(route.record.name).includes(filter))
          return true;
      return route.children.some(child => isRouteMatching(child, filter));
  }
  function omit(obj, keys) {
      const ret = {};
      for (const key in obj) {
          if (!keys.includes(key)) {
              // @ts-expect-error
              ret[key] = obj[key];
          }
      }
      return ret;
  }

  /**
   * Creates a Router instance that can be used by a Vue app.
   *
   * @param options - {@link RouterOptions}
   */
  function createRouter(options) {
      const matcher = createRouterMatcher(options.routes, options);
      const parseQuery$1 = options.parseQuery || parseQuery;
      const stringifyQuery$1 = options.stringifyQuery || stringifyQuery;
      const routerHistory = options.history;
      if (!routerHistory)
          throw new Error('Provide the "history" option when calling "createRouter()":' +
              ' https://next.router.vuejs.org/api/#history.');
      const beforeGuards = useCallbacks();
      const beforeResolveGuards = useCallbacks();
      const afterGuards = useCallbacks();
      const currentRoute = vue.shallowRef(START_LOCATION_NORMALIZED);
      let pendingLocation = START_LOCATION_NORMALIZED;
      // leave the scrollRestoration if no scrollBehavior is provided
      if (isBrowser && options.scrollBehavior && 'scrollRestoration' in history) {
          history.scrollRestoration = 'manual';
      }
      const normalizeParams = applyToParams.bind(null, paramValue => '' + paramValue);
      const encodeParams = applyToParams.bind(null, encodeParam);
      const decodeParams = 
      // @ts-expect-error: intentionally avoid the type check
      applyToParams.bind(null, decode);
      function addRoute(parentOrRoute, route) {
          let parent;
          let record;
          if (isRouteName(parentOrRoute)) {
              parent = matcher.getRecordMatcher(parentOrRoute);
              record = route;
          }
          else {
              record = parentOrRoute;
          }
          return matcher.addRoute(record, parent);
      }
      function removeRoute(name) {
          const recordMatcher = matcher.getRecordMatcher(name);
          if (recordMatcher) {
              matcher.removeRoute(recordMatcher);
          }
          else {
              warn(`Cannot remove non-existent route "${String(name)}"`);
          }
      }
      function getRoutes() {
          return matcher.getRoutes().map(routeMatcher => routeMatcher.record);
      }
      function hasRoute(name) {
          return !!matcher.getRecordMatcher(name);
      }
      function resolve(rawLocation, currentLocation) {
          // const objectLocation = routerLocationAsObject(rawLocation)
          // we create a copy to modify it later
          currentLocation = assign({}, currentLocation || currentRoute.value);
          if (typeof rawLocation === 'string') {
              const locationNormalized = parseURL(parseQuery$1, rawLocation, currentLocation.path);
              const matchedRoute = matcher.resolve({ path: locationNormalized.path }, currentLocation);
              const href = routerHistory.createHref(locationNormalized.fullPath);
              {
                  if (href.startsWith('//'))
                      warn(`Location "${rawLocation}" resolved to "${href}". A resolved location cannot start with multiple slashes.`);
                  else if (!matchedRoute.matched.length) {
                      warn(`No match found for location with path "${rawLocation}"`);
                  }
              }
              // locationNormalized is always a new object
              return assign(locationNormalized, matchedRoute, {
                  params: decodeParams(matchedRoute.params),
                  hash: decode(locationNormalized.hash),
                  redirectedFrom: undefined,
                  href,
              });
          }
          let matcherLocation;
          // path could be relative in object as well
          if ('path' in rawLocation) {
              if ('params' in rawLocation &&
                  !('name' in rawLocation) &&
                  // @ts-expect-error: the type is never
                  Object.keys(rawLocation.params).length) {
                  warn(`Path "${
                // @ts-expect-error: the type is never
                rawLocation.path}" was passed with params but they will be ignored. Use a named route alongside params instead.`);
              }
              matcherLocation = assign({}, rawLocation, {
                  path: parseURL(parseQuery$1, rawLocation.path, currentLocation.path).path,
              });
          }
          else {
              // remove any nullish param
              const targetParams = assign({}, rawLocation.params);
              for (const key in targetParams) {
                  if (targetParams[key] == null) {
                      delete targetParams[key];
                  }
              }
              // pass encoded values to the matcher, so it can produce encoded path and fullPath
              matcherLocation = assign({}, rawLocation, {
                  params: encodeParams(rawLocation.params),
              });
              // current location params are decoded, we need to encode them in case the
              // matcher merges the params
              currentLocation.params = encodeParams(currentLocation.params);
          }
          const matchedRoute = matcher.resolve(matcherLocation, currentLocation);
          const hash = rawLocation.hash || '';
          if (hash && !hash.startsWith('#')) {
              warn(`A \`hash\` should always start with the character "#". Replace "${hash}" with "#${hash}".`);
          }
          // the matcher might have merged current location params, so
          // we need to run the decoding again
          matchedRoute.params = normalizeParams(decodeParams(matchedRoute.params));
          const fullPath = stringifyURL(stringifyQuery$1, assign({}, rawLocation, {
              hash: encodeHash(hash),
              path: matchedRoute.path,
          }));
          const href = routerHistory.createHref(fullPath);
          {
              if (href.startsWith('//')) {
                  warn(`Location "${rawLocation}" resolved to "${href}". A resolved location cannot start with multiple slashes.`);
              }
              else if (!matchedRoute.matched.length) {
                  warn(`No match found for location with path "${'path' in rawLocation ? rawLocation.path : rawLocation}"`);
              }
          }
          return assign({
              fullPath,
              // keep the hash encoded so fullPath is effectively path + encodedQuery +
              // hash
              hash,
              query: 
              // if the user is using a custom query lib like qs, we might have
              // nested objects, so we keep the query as is, meaning it can contain
              // numbers at `$route.query`, but at the point, the user will have to
              // use their own type anyway.
              // https://github.com/vuejs/router/issues/328#issuecomment-649481567
              stringifyQuery$1 === stringifyQuery
                  ? normalizeQuery(rawLocation.query)
                  : (rawLocation.query || {}),
          }, matchedRoute, {
              redirectedFrom: undefined,
              href,
          });
      }
      function locationAsObject(to) {
          return typeof to === 'string'
              ? parseURL(parseQuery$1, to, currentRoute.value.path)
              : assign({}, to);
      }
      function checkCanceledNavigation(to, from) {
          if (pendingLocation !== to) {
              return createRouterError(8 /* ErrorTypes.NAVIGATION_CANCELLED */, {
                  from,
                  to,
              });
          }
      }
      function push(to) {
          return pushWithRedirect(to);
      }
      function replace(to) {
          return push(assign(locationAsObject(to), { replace: true }));
      }
      function handleRedirectRecord(to) {
          const lastMatched = to.matched[to.matched.length - 1];
          if (lastMatched && lastMatched.redirect) {
              const { redirect } = lastMatched;
              let newTargetLocation = typeof redirect === 'function' ? redirect(to) : redirect;
              if (typeof newTargetLocation === 'string') {
                  newTargetLocation =
                      newTargetLocation.includes('?') || newTargetLocation.includes('#')
                          ? (newTargetLocation = locationAsObject(newTargetLocation))
                          : // force empty params
                              { path: newTargetLocation };
                  // @ts-expect-error: force empty params when a string is passed to let
                  // the router parse them again
                  newTargetLocation.params = {};
              }
              if (!('path' in newTargetLocation) &&
                  !('name' in newTargetLocation)) {
                  warn(`Invalid redirect found:\n${JSON.stringify(newTargetLocation, null, 2)}\n when navigating to "${to.fullPath}". A redirect must contain a name or path. This will break in production.`);
                  throw new Error('Invalid redirect');
              }
              return assign({
                  query: to.query,
                  hash: to.hash,
                  // avoid transferring params if the redirect has a path
                  params: 'path' in newTargetLocation ? {} : to.params,
              }, newTargetLocation);
          }
      }
      function pushWithRedirect(to, redirectedFrom) {
          const targetLocation = (pendingLocation = resolve(to));
          const from = currentRoute.value;
          const data = to.state;
          const force = to.force;
          // to could be a string where `replace` is a function
          const replace = to.replace === true;
          const shouldRedirect = handleRedirectRecord(targetLocation);
          if (shouldRedirect)
              return pushWithRedirect(assign(locationAsObject(shouldRedirect), {
                  state: typeof shouldRedirect === 'object'
                      ? assign({}, data, shouldRedirect.state)
                      : data,
                  force,
                  replace,
              }), 
              // keep original redirectedFrom if it exists
              redirectedFrom || targetLocation);
          // if it was a redirect we already called `pushWithRedirect` above
          const toLocation = targetLocation;
          toLocation.redirectedFrom = redirectedFrom;
          let failure;
          if (!force && isSameRouteLocation(stringifyQuery$1, from, targetLocation)) {
              failure = createRouterError(16 /* ErrorTypes.NAVIGATION_DUPLICATED */, { to: toLocation, from });
              // trigger scroll to allow scrolling to the same anchor
              handleScroll(from, from, 
              // this is a push, the only way for it to be triggered from a
              // history.listen is with a redirect, which makes it become a push
              true, 
              // This cannot be the first navigation because the initial location
              // cannot be manually navigated to
              false);
          }
          return (failure ? Promise.resolve(failure) : navigate(toLocation, from))
              .catch((error) => isNavigationFailure(error)
              ? // navigation redirects still mark the router as ready
                  isNavigationFailure(error, 2 /* ErrorTypes.NAVIGATION_GUARD_REDIRECT */)
                      ? error
                      : markAsReady(error) // also returns the error
              : // reject any unknown error
                  triggerError(error, toLocation, from))
              .then((failure) => {
              if (failure) {
                  if (isNavigationFailure(failure, 2 /* ErrorTypes.NAVIGATION_GUARD_REDIRECT */)) {
                      if (// we are redirecting to the same location we were already at
                          isSameRouteLocation(stringifyQuery$1, resolve(failure.to), toLocation) &&
                          // and we have done it a couple of times
                          redirectedFrom &&
                          // @ts-expect-error: added only in dev
                          (redirectedFrom._count = redirectedFrom._count
                              ? // @ts-expect-error
                                  redirectedFrom._count + 1
                              : 1) > 10) {
                          warn(`Detected an infinite redirection in a navigation guard when going from "${from.fullPath}" to "${toLocation.fullPath}". Aborting to avoid a Stack Overflow. This will break in production if not fixed.`);
                          return Promise.reject(new Error('Infinite redirect in navigation guard'));
                      }
                      return pushWithRedirect(
                      // keep options
                      assign({
                          // preserve an existing replacement but allow the redirect to override it
                          replace,
                      }, locationAsObject(failure.to), {
                          state: typeof failure.to === 'object'
                              ? assign({}, data, failure.to.state)
                              : data,
                          force,
                      }), 
                      // preserve the original redirectedFrom if any
                      redirectedFrom || toLocation);
                  }
              }
              else {
                  // if we fail we don't finalize the navigation
                  failure = finalizeNavigation(toLocation, from, true, replace, data);
              }
              triggerAfterEach(toLocation, from, failure);
              return failure;
          });
      }
      /**
       * Helper to reject and skip all navigation guards if a new navigation happened
       * @param to
       * @param from
       */
      function checkCanceledNavigationAndReject(to, from) {
          const error = checkCanceledNavigation(to, from);
          return error ? Promise.reject(error) : Promise.resolve();
      }
      // TODO: refactor the whole before guards by internally using router.beforeEach
      function navigate(to, from) {
          let guards;
          const [leavingRecords, updatingRecords, enteringRecords] = extractChangingRecords(to, from);
          // all components here have been resolved once because we are leaving
          guards = extractComponentsGuards(leavingRecords.reverse(), 'beforeRouteLeave', to, from);
          // leavingRecords is already reversed
          for (const record of leavingRecords) {
              record.leaveGuards.forEach(guard => {
                  guards.push(guardToPromiseFn(guard, to, from));
              });
          }
          const canceledNavigationCheck = checkCanceledNavigationAndReject.bind(null, to, from);
          guards.push(canceledNavigationCheck);
          // run the queue of per route beforeRouteLeave guards
          return (runGuardQueue(guards)
              .then(() => {
              // check global guards beforeEach
              guards = [];
              for (const guard of beforeGuards.list()) {
                  guards.push(guardToPromiseFn(guard, to, from));
              }
              guards.push(canceledNavigationCheck);
              return runGuardQueue(guards);
          })
              .then(() => {
              // check in components beforeRouteUpdate
              guards = extractComponentsGuards(updatingRecords, 'beforeRouteUpdate', to, from);
              for (const record of updatingRecords) {
                  record.updateGuards.forEach(guard => {
                      guards.push(guardToPromiseFn(guard, to, from));
                  });
              }
              guards.push(canceledNavigationCheck);
              // run the queue of per route beforeEnter guards
              return runGuardQueue(guards);
          })
              .then(() => {
              // check the route beforeEnter
              guards = [];
              for (const record of to.matched) {
                  // do not trigger beforeEnter on reused views
                  if (record.beforeEnter && !from.matched.includes(record)) {
                      if (isArray(record.beforeEnter)) {
                          for (const beforeEnter of record.beforeEnter)
                              guards.push(guardToPromiseFn(beforeEnter, to, from));
                      }
                      else {
                          guards.push(guardToPromiseFn(record.beforeEnter, to, from));
                      }
                  }
              }
              guards.push(canceledNavigationCheck);
              // run the queue of per route beforeEnter guards
              return runGuardQueue(guards);
          })
              .then(() => {
              // NOTE: at this point to.matched is normalized and does not contain any () => Promise<Component>
              // clear existing enterCallbacks, these are added by extractComponentsGuards
              to.matched.forEach(record => (record.enterCallbacks = {}));
              // check in-component beforeRouteEnter
              guards = extractComponentsGuards(enteringRecords, 'beforeRouteEnter', to, from);
              guards.push(canceledNavigationCheck);
              // run the queue of per route beforeEnter guards
              return runGuardQueue(guards);
          })
              .then(() => {
              // check global guards beforeResolve
              guards = [];
              for (const guard of beforeResolveGuards.list()) {
                  guards.push(guardToPromiseFn(guard, to, from));
              }
              guards.push(canceledNavigationCheck);
              return runGuardQueue(guards);
          })
              // catch any navigation canceled
              .catch(err => isNavigationFailure(err, 8 /* ErrorTypes.NAVIGATION_CANCELLED */)
              ? err
              : Promise.reject(err)));
      }
      function triggerAfterEach(to, from, failure) {
          // navigation is confirmed, call afterGuards
          // TODO: wrap with error handlers
          for (const guard of afterGuards.list())
              guard(to, from, failure);
      }
      /**
       * - Cleans up any navigation guards
       * - Changes the url if necessary
       * - Calls the scrollBehavior
       */
      function finalizeNavigation(toLocation, from, isPush, replace, data) {
          // a more recent navigation took place
          const error = checkCanceledNavigation(toLocation, from);
          if (error)
              return error;
          // only consider as push if it's not the first navigation
          const isFirstNavigation = from === START_LOCATION_NORMALIZED;
          const state = !isBrowser ? {} : history.state;
          // change URL only if the user did a push/replace and if it's not the initial navigation because
          // it's just reflecting the url
          if (isPush) {
              // on the initial navigation, we want to reuse the scroll position from
              // history state if it exists
              if (replace || isFirstNavigation)
                  routerHistory.replace(toLocation.fullPath, assign({
                      scroll: isFirstNavigation && state && state.scroll,
                  }, data));
              else
                  routerHistory.push(toLocation.fullPath, data);
          }
          // accept current navigation
          currentRoute.value = toLocation;
          handleScroll(toLocation, from, isPush, isFirstNavigation);
          markAsReady();
      }
      let removeHistoryListener;
      // attach listener to history to trigger navigations
      function setupListeners() {
          // avoid setting up listeners twice due to an invalid first navigation
          if (removeHistoryListener)
              return;
          removeHistoryListener = routerHistory.listen((to, _from, info) => {
              if (!router.listening)
                  return;
              // cannot be a redirect route because it was in history
              const toLocation = resolve(to);
              // due to dynamic routing, and to hash history with manual navigation
              // (manually changing the url or calling history.hash = '#/somewhere'),
              // there could be a redirect record in history
              const shouldRedirect = handleRedirectRecord(toLocation);
              if (shouldRedirect) {
                  pushWithRedirect(assign(shouldRedirect, { replace: true }), toLocation).catch(noop);
                  return;
              }
              pendingLocation = toLocation;
              const from = currentRoute.value;
              // TODO: should be moved to web history?
              if (isBrowser) {
                  saveScrollPosition(getScrollKey(from.fullPath, info.delta), computeScrollPosition());
              }
              navigate(toLocation, from)
                  .catch((error) => {
                  if (isNavigationFailure(error, 4 /* ErrorTypes.NAVIGATION_ABORTED */ | 8 /* ErrorTypes.NAVIGATION_CANCELLED */)) {
                      return error;
                  }
                  if (isNavigationFailure(error, 2 /* ErrorTypes.NAVIGATION_GUARD_REDIRECT */)) {
                      // Here we could call if (info.delta) routerHistory.go(-info.delta,
                      // false) but this is bug prone as we have no way to wait the
                      // navigation to be finished before calling pushWithRedirect. Using
                      // a setTimeout of 16ms seems to work but there is no guarantee for
                      // it to work on every browser. So instead we do not restore the
                      // history entry and trigger a new navigation as requested by the
                      // navigation guard.
                      // the error is already handled by router.push we just want to avoid
                      // logging the error
                      pushWithRedirect(error.to, toLocation
                      // avoid an uncaught rejection, let push call triggerError
                      )
                          .then(failure => {
                          // manual change in hash history #916 ending up in the URL not
                          // changing, but it was changed by the manual url change, so we
                          // need to manually change it ourselves
                          if (isNavigationFailure(failure, 4 /* ErrorTypes.NAVIGATION_ABORTED */ |
                              16 /* ErrorTypes.NAVIGATION_DUPLICATED */) &&
                              !info.delta &&
                              info.type === NavigationType.pop) {
                              routerHistory.go(-1, false);
                          }
                      })
                          .catch(noop);
                      // avoid the then branch
                      return Promise.reject();
                  }
                  // do not restore history on unknown direction
                  if (info.delta) {
                      routerHistory.go(-info.delta, false);
                  }
                  // unrecognized error, transfer to the global handler
                  return triggerError(error, toLocation, from);
              })
                  .then((failure) => {
                  failure =
                      failure ||
                          finalizeNavigation(
                          // after navigation, all matched components are resolved
                          toLocation, from, false);
                  // revert the navigation
                  if (failure) {
                      if (info.delta &&
                          // a new navigation has been triggered, so we do not want to revert, that will change the current history
                          // entry while a different route is displayed
                          !isNavigationFailure(failure, 8 /* ErrorTypes.NAVIGATION_CANCELLED */)) {
                          routerHistory.go(-info.delta, false);
                      }
                      else if (info.type === NavigationType.pop &&
                          isNavigationFailure(failure, 4 /* ErrorTypes.NAVIGATION_ABORTED */ | 16 /* ErrorTypes.NAVIGATION_DUPLICATED */)) {
                          // manual change in hash history #916
                          // it's like a push but lacks the information of the direction
                          routerHistory.go(-1, false);
                      }
                  }
                  triggerAfterEach(toLocation, from, failure);
              })
                  .catch(noop);
          });
      }
      // Initialization and Errors
      let readyHandlers = useCallbacks();
      let errorHandlers = useCallbacks();
      let ready;
      /**
       * Trigger errorHandlers added via onError and throws the error as well
       *
       * @param error - error to throw
       * @param to - location we were navigating to when the error happened
       * @param from - location we were navigating from when the error happened
       * @returns the error as a rejected promise
       */
      function triggerError(error, to, from) {
          markAsReady(error);
          const list = errorHandlers.list();
          if (list.length) {
              list.forEach(handler => handler(error, to, from));
          }
          else {
              {
                  warn('uncaught error during route navigation:');
              }
              console.error(error);
          }
          return Promise.reject(error);
      }
      function isReady() {
          if (ready && currentRoute.value !== START_LOCATION_NORMALIZED)
              return Promise.resolve();
          return new Promise((resolve, reject) => {
              readyHandlers.add([resolve, reject]);
          });
      }
      function markAsReady(err) {
          if (!ready) {
              // still not ready if an error happened
              ready = !err;
              setupListeners();
              readyHandlers
                  .list()
                  .forEach(([resolve, reject]) => (err ? reject(err) : resolve()));
              readyHandlers.reset();
          }
          return err;
      }
      // Scroll behavior
      function handleScroll(to, from, isPush, isFirstNavigation) {
          const { scrollBehavior } = options;
          if (!isBrowser || !scrollBehavior)
              return Promise.resolve();
          const scrollPosition = (!isPush && getSavedScrollPosition(getScrollKey(to.fullPath, 0))) ||
              ((isFirstNavigation || !isPush) &&
                  history.state &&
                  history.state.scroll) ||
              null;
          return vue.nextTick()
              .then(() => scrollBehavior(to, from, scrollPosition))
              .then(position => position && scrollToPosition(position))
              .catch(err => triggerError(err, to, from));
      }
      const go = (delta) => routerHistory.go(delta);
      let started;
      const installedApps = new Set();
      const router = {
          currentRoute,
          listening: true,
          addRoute,
          removeRoute,
          hasRoute,
          getRoutes,
          resolve,
          options,
          push,
          replace,
          go,
          back: () => go(-1),
          forward: () => go(1),
          beforeEach: beforeGuards.add,
          beforeResolve: beforeResolveGuards.add,
          afterEach: afterGuards.add,
          onError: errorHandlers.add,
          isReady,
          install(app) {
              const router = this;
              app.component('RouterLink', RouterLink);
              app.component('RouterView', RouterView);
              app.config.globalProperties.$router = router;
              Object.defineProperty(app.config.globalProperties, '$route', {
                  enumerable: true,
                  get: () => vue.unref(currentRoute),
              });
              // this initial navigation is only necessary on client, on server it doesn't
              // make sense because it will create an extra unnecessary navigation and could
              // lead to problems
              if (isBrowser &&
                  // used for the initial navigation client side to avoid pushing
                  // multiple times when the router is used in multiple apps
                  !started &&
                  currentRoute.value === START_LOCATION_NORMALIZED) {
                  // see above
                  started = true;
                  push(routerHistory.location).catch(err => {
                      warn('Unexpected error when starting the router:', err);
                  });
              }
              const reactiveRoute = {};
              for (const key in START_LOCATION_NORMALIZED) {
                  // @ts-expect-error: the key matches
                  reactiveRoute[key] = vue.computed(() => currentRoute.value[key]);
              }
              app.provide(routerKey, router);
              app.provide(routeLocationKey, vue.reactive(reactiveRoute));
              app.provide(routerViewLocationKey, currentRoute);
              const unmountApp = app.unmount;
              installedApps.add(app);
              app.unmount = function () {
                  installedApps.delete(app);
                  // the router is not attached to an app anymore
                  if (installedApps.size < 1) {
                      // invalidate the current navigation
                      pendingLocation = START_LOCATION_NORMALIZED;
                      removeHistoryListener && removeHistoryListener();
                      removeHistoryListener = null;
                      currentRoute.value = START_LOCATION_NORMALIZED;
                      started = false;
                      ready = false;
                  }
                  unmountApp();
              };
              // TODO: this probably needs to be updated so it can be used by vue-termui
              if (isBrowser) {
                  addDevtools(app, router, matcher);
              }
          },
      };
      return router;
  }
  function runGuardQueue(guards) {
      return guards.reduce((promise, guard) => promise.then(() => guard()), Promise.resolve());
  }
  function extractChangingRecords(to, from) {
      const leavingRecords = [];
      const updatingRecords = [];
      const enteringRecords = [];
      const len = Math.max(from.matched.length, to.matched.length);
      for (let i = 0; i < len; i++) {
          const recordFrom = from.matched[i];
          if (recordFrom) {
              if (to.matched.find(record => isSameRouteRecord(record, recordFrom)))
                  updatingRecords.push(recordFrom);
              else
                  leavingRecords.push(recordFrom);
          }
          const recordTo = to.matched[i];
          if (recordTo) {
              // the type doesn't matter because we are comparing per reference
              if (!from.matched.find(record => isSameRouteRecord(record, recordTo))) {
                  enteringRecords.push(recordTo);
              }
          }
      }
      return [leavingRecords, updatingRecords, enteringRecords];
  }

  /**
   * Returns the router instance. Equivalent to using `$router` inside
   * templates.
   */
  function useRouter() {
      return vue.inject(routerKey);
  }
  /**
   * Returns the current route location. Equivalent to using `$route` inside
   * templates.
   */
  function useRoute() {
      return vue.inject(routeLocationKey);
  }

  exports.RouterLink = RouterLink;
  exports.RouterView = RouterView;
  exports.START_LOCATION = START_LOCATION_NORMALIZED;
  exports.createMemoryHistory = createMemoryHistory;
  exports.createRouter = createRouter;
  exports.createRouterMatcher = createRouterMatcher;
  exports.createWebHashHistory = createWebHashHistory;
  exports.createWebHistory = createWebHistory;
  exports.isNavigationFailure = isNavigationFailure;
  exports.loadRouteLocation = loadRouteLocation;
  exports.matchedRouteKey = matchedRouteKey;
  exports.onBeforeRouteLeave = onBeforeRouteLeave;
  exports.onBeforeRouteUpdate = onBeforeRouteUpdate;
  exports.parseQuery = parseQuery;
  exports.routeLocationKey = routeLocationKey;
  exports.routerKey = routerKey;
  exports.routerViewLocationKey = routerViewLocationKey;
  exports.stringifyQuery = stringifyQuery;
  exports.useLink = useLink;
  exports.useRoute = useRoute;
  exports.useRouter = useRouter;
  exports.viewDepthKey = viewDepthKey;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({}, Vue);

 /*vue-router v0.7.13
 * (c) 2016 Evan You
 * Released under the MIT License.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  global.VueRouter = factory();
}(this, function () { 'use strict';

  var babelHelpers = {};

  babelHelpers.classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };
  function Target(path, matcher, delegate) {
    this.path = path;
    this.matcher = matcher;
    this.delegate = delegate;
  }

  Target.prototype = {
    to: function to(target, callback) {
      var delegate = this.delegate;

      if (delegate && delegate.willAddRoute) {
        target = delegate.willAddRoute(this.matcher.target, target);
      }

      this.matcher.add(this.path, target);

      if (callback) {
        if (callback.length === 0) {
          throw new Error("You must have an argument in the function passed to `to`");
        }
        this.matcher.addChild(this.path, target, callback, this.delegate);
      }
      return this;
    }
  };

  function Matcher(target) {
    this.routes = {};
    this.children = {};
    this.target = target;
  }

  Matcher.prototype = {
    add: function add(path, handler) {
      this.routes[path] = handler;
    },

    addChild: function addChild(path, target, callback, delegate) {
      var matcher = new Matcher(target);
      this.children[path] = matcher;

      var match = generateMatch(path, matcher, delegate);

      if (delegate && delegate.contextEntered) {
        delegate.contextEntered(target, match);
      }

      callback(match);
    }
  };

  function generateMatch(startingPath, matcher, delegate) {
    return function (path, nestedCallback) {
      var fullPath = startingPath + path;

      if (nestedCallback) {
        nestedCallback(generateMatch(fullPath, matcher, delegate));
      } else {
        return new Target(startingPath + path, matcher, delegate);
      }
    };
  }

  function addRoute(routeArray, path, handler) {
    var len = 0;
    for (var i = 0, l = routeArray.length; i < l; i++) {
      len += routeArray[i].path.length;
    }

    path = path.substr(len);
    var route = { path: path, handler: handler };
    routeArray.push(route);
  }

  function eachRoute(baseRoute, matcher, callback, binding) {
    var routes = matcher.routes;

    for (var path in routes) {
      if (routes.hasOwnProperty(path)) {
        var routeArray = baseRoute.slice();
        addRoute(routeArray, path, routes[path]);

        if (matcher.children[path]) {
          eachRoute(routeArray, matcher.children[path], callback, binding);
        } else {
          callback.call(binding, routeArray);
        }
      }
    }
  }

  function map (callback, addRouteCallback) {
    var matcher = new Matcher();

    callback(generateMatch("", matcher, this.delegate));

    eachRoute([], matcher, function (route) {
      if (addRouteCallback) {
        addRouteCallback(this, route);
      } else {
        this.add(route);
      }
    }, this);
  }

  var specials = ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\'];

  var escapeRegex = new RegExp('(\\' + specials.join('|\\') + ')', 'g');

  var noWarning = false;
  function warn(msg) {
    if (!noWarning && typeof console !== 'undefined') {
      console.error('[vue-router] ' + msg);
    }
  }

  function tryDecode(uri, asComponent) {
    try {
      return asComponent ? decodeURIComponent(uri) : decodeURI(uri);
    } catch (e) {
      warn('malformed URI' + (asComponent ? ' component: ' : ': ') + uri);
    }
  }

  function isArray(test) {
    return Object.prototype.toString.call(test) === "[object Array]";
  }

  // A Segment represents a segment in the original route description.
  // Each Segment type provides an `eachChar` and `regex` method.
  //
  // The `eachChar` method invokes the callback with one or more character
  // specifications. A character specification consumes one or more input
  // characters.
  //
  // The `regex` method returns a regex fragment for the segment. If the
  // segment is a dynamic of star segment, the regex fragment also includes
  // a capture.
  //
  // A character specification contains:
  //
  // * `validChars`: a String with a list of all valid characters, or
  // * `invalidChars`: a String with a list of all invalid characters
  // * `repeat`: true if the character specification can repeat

  function StaticSegment(string) {
    this.string = string;
  }
  StaticSegment.prototype = {
    eachChar: function eachChar(callback) {
      var string = this.string,
          ch;

      for (var i = 0, l = string.length; i < l; i++) {
        ch = string.charAt(i);
        callback({ validChars: ch });
      }
    },

    regex: function regex() {
      return this.string.replace(escapeRegex, '\\$1');
    },

    generate: function generate() {
      return this.string;
    }
  };

  function DynamicSegment(name) {
    this.name = name;
  }
  DynamicSegment.prototype = {
    eachChar: function eachChar(callback) {
      callback({ invalidChars: "/", repeat: true });
    },

    regex: function regex() {
      return "([^/]+)";
    },

    generate: function generate(params) {
      var val = params[this.name];
      return val == null ? ":" + this.name : val;
    }
  };

  function StarSegment(name) {
    this.name = name;
  }
  StarSegment.prototype = {
    eachChar: function eachChar(callback) {
      callback({ invalidChars: "", repeat: true });
    },

    regex: function regex() {
      return "(.+)";
    },

    generate: function generate(params) {
      var val = params[this.name];
      return val == null ? ":" + this.name : val;
    }
  };

  function EpsilonSegment() {}
  EpsilonSegment.prototype = {
    eachChar: function eachChar() {},
    regex: function regex() {
      return "";
    },
    generate: function generate() {
      return "";
    }
  };

  function parse(route, names, specificity) {
    // normalize route as not starting with a "/". Recognition will
    // also normalize.
    if (route.charAt(0) === "/") {
      route = route.substr(1);
    }

    var segments = route.split("/"),
        results = [];

    // A routes has specificity determined by the order that its different segments
    // appear in. This system mirrors how the magnitude of numbers written as strings
    // works.
    // Consider a number written as: "abc". An example would be "200". Any other number written
    // "xyz" will be smaller than "abc" so long as `a > z`. For instance, "199" is smaller
    // then "200", even though "y" and "z" (which are both 9) are larger than "0" (the value
    // of (`b` and `c`). This is because the leading symbol, "2", is larger than the other
    // leading symbol, "1".
    // The rule is that symbols to the left carry more weight than symbols to the right
    // when a number is written out as a string. In the above strings, the leading digit
    // represents how many 100's are in the number, and it carries more weight than the middle
    // number which represents how many 10's are in the number.
    // This system of number magnitude works well for route specificity, too. A route written as
    // `a/b/c` will be more specific than `x/y/z` as long as `a` is more specific than
    // `x`, irrespective of the other parts.
    // Because of this similarity, we assign each type of segment a number value written as a
    // string. We can find the specificity of compound routes by concatenating these strings
    // together, from left to right. After we have looped through all of the segments,
    // we convert the string to a number.
    specificity.val = '';

    for (var i = 0, l = segments.length; i < l; i++) {
      var segment = segments[i],
          match;

      if (match = segment.match(/^:([^\/]+)$/)) {
        results.push(new DynamicSegment(match[1]));
        names.push(match[1]);
        specificity.val += '3';
      } else if (match = segment.match(/^\*([^\/]+)$/)) {
        results.push(new StarSegment(match[1]));
        specificity.val += '2';
        names.push(match[1]);
      } else if (segment === "") {
        results.push(new EpsilonSegment());
        specificity.val += '1';
      } else {
        results.push(new StaticSegment(segment));
        specificity.val += '4';
      }
    }

    specificity.val = +specificity.val;

    return results;
  }

  // A State has a character specification and (`charSpec`) and a list of possible
  // subsequent states (`nextStates`).
  //
  // If a State is an accepting state, it will also have several additional
  // properties:
  //
  // * `regex`: A regular expression that is used to extract parameters from paths
  //   that reached this accepting state.
  // * `handlers`: Information on how to convert the list of captures into calls
  //   to registered handlers with the specified parameters
  // * `types`: How many static, dynamic or star segments in this route. Used to
  //   decide which route to use if multiple registered routes match a path.
  //
  // Currently, State is implemented naively by looping over `nextStates` and
  // comparing a character specification against a character. A more efficient
  // implementation would use a hash of keys pointing at one or more next states.

  function State(charSpec) {
    this.charSpec = charSpec;
    this.nextStates = [];
  }

  State.prototype = {
    get: function get(charSpec) {
      var nextStates = this.nextStates;

      for (var i = 0, l = nextStates.length; i < l; i++) {
        var child = nextStates[i];

        var isEqual = child.charSpec.validChars === charSpec.validChars;
        isEqual = isEqual && child.charSpec.invalidChars === charSpec.invalidChars;

        if (isEqual) {
          return child;
        }
      }
    },

    put: function put(charSpec) {
      var state;

      // If the character specification already exists in a child of the current
      // state, just return that state.
      if (state = this.get(charSpec)) {
        return state;
      }

      // Make a new state for the character spec
      state = new State(charSpec);

      // Insert the new state as a child of the current state
      this.nextStates.push(state);

      // If this character specification repeats, insert the new state as a child
      // of itself. Note that this will not trigger an infinite loop because each
      // transition during recognition consumes a character.
      if (charSpec.repeat) {
        state.nextStates.push(state);
      }

      // Return the new state
      return state;
    },

    // Find a list of child states matching the next character
    match: function match(ch) {
      // DEBUG "Processing `" + ch + "`:"
      var nextStates = this.nextStates,
          child,
          charSpec,
          chars;

      // DEBUG "  " + debugState(this)
      var returned = [];

      for (var i = 0, l = nextStates.length; i < l; i++) {
        child = nextStates[i];

        charSpec = child.charSpec;

        if (typeof (chars = charSpec.validChars) !== 'undefined') {
          if (chars.indexOf(ch) !== -1) {
            returned.push(child);
          }
        } else if (typeof (chars = charSpec.invalidChars) !== 'undefined') {
          if (chars.indexOf(ch) === -1) {
            returned.push(child);
          }
        }
      }

      return returned;
    }

    /** IF DEBUG
    , debug: function() {
      var charSpec = this.charSpec,
          debug = "[",
          chars = charSpec.validChars || charSpec.invalidChars;
       if (charSpec.invalidChars) { debug += "^"; }
      debug += chars;
      debug += "]";
       if (charSpec.repeat) { debug += "+"; }
       return debug;
    }
    END IF **/
  };

  /** IF DEBUG
  function debug(log) {
    console.log(log);
  }

  function debugState(state) {
    return state.nextStates.map(function(n) {
      if (n.nextStates.length === 0) { return "( " + n.debug() + " [accepting] )"; }
      return "( " + n.debug() + " <then> " + n.nextStates.map(function(s) { return s.debug() }).join(" or ") + " )";
    }).join(", ")
  }
  END IF **/

  // Sort the routes by specificity
  function sortSolutions(states) {
    return states.sort(function (a, b) {
      return b.specificity.val - a.specificity.val;
    });
  }

  function recognizeChar(states, ch) {
    var nextStates = [];

    for (var i = 0, l = states.length; i < l; i++) {
      var state = states[i];

      nextStates = nextStates.concat(state.match(ch));
    }

    return nextStates;
  }

  var oCreate = Object.create || function (proto) {
    function F() {}
    F.prototype = proto;
    return new F();
  };

  function RecognizeResults(queryParams) {
    this.queryParams = queryParams || {};
  }
  RecognizeResults.prototype = oCreate({
    splice: Array.prototype.splice,
    slice: Array.prototype.slice,
    push: Array.prototype.push,
    length: 0,
    queryParams: null
  });

  function findHandler(state, path, queryParams) {
    var handlers = state.handlers,
        regex = state.regex;
    var captures = path.match(regex),
        currentCapture = 1;
    var result = new RecognizeResults(queryParams);

    for (var i = 0, l = handlers.length; i < l; i++) {
      var handler = handlers[i],
          names = handler.names,
          params = {};

      for (var j = 0, m = names.length; j < m; j++) {
        params[names[j]] = captures[currentCapture++];
      }

      result.push({ handler: handler.handler, params: params, isDynamic: !!names.length });
    }

    return result;
  }

  function addSegment(currentState, segment) {
    segment.eachChar(function (ch) {
      var state;

      currentState = currentState.put(ch);
    });

    return currentState;
  }

  function decodeQueryParamPart(part) {
    // http://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.1
    part = part.replace(/\+/gm, '%20');
    return tryDecode(part, true);
  }

  // The main interface

  var RouteRecognizer = function RouteRecognizer() {
    this.rootState = new State();
    this.names = {};
  };

  RouteRecognizer.prototype = {
    add: function add(routes, options) {
      var currentState = this.rootState,
          regex = "^",
          specificity = {},
          handlers = [],
          allSegments = [],
          name;

      var isEmpty = true;

      for (var i = 0, l = routes.length; i < l; i++) {
        var route = routes[i],
            names = [];

        var segments = parse(route.path, names, specificity);

        allSegments = allSegments.concat(segments);

        for (var j = 0, m = segments.length; j < m; j++) {
          var segment = segments[j];

          if (segment instanceof EpsilonSegment) {
            continue;
          }

          isEmpty = false;

          // Add a "/" for the new segment
          currentState = currentState.put({ validChars: "/" });
          regex += "/";

          // Add a representation of the segment to the NFA and regex
          currentState = addSegment(currentState, segment);
          regex += segment.regex();
        }

        var handler = { handler: route.handler, names: names };
        handlers.push(handler);
      }

      if (isEmpty) {
        currentState = currentState.put({ validChars: "/" });
        regex += "/";
      }

      currentState.handlers = handlers;
      currentState.regex = new RegExp(regex + "$");
      currentState.specificity = specificity;

      if (name = options && options.as) {
        this.names[name] = {
          segments: allSegments,
          handlers: handlers
        };
      }
    },

    handlersFor: function handlersFor(name) {
      var route = this.names[name],
          result = [];
      if (!route) {
        throw new Error("There is no route named " + name);
      }

      for (var i = 0, l = route.handlers.length; i < l; i++) {
        result.push(route.handlers[i]);
      }

      return result;
    },

    hasRoute: function hasRoute(name) {
      return !!this.names[name];
    },

    generate: function generate(name, params) {
      var route = this.names[name],
          output = "";
      if (!route) {
        throw new Error("There is no route named " + name);
      }

      var segments = route.segments;

      for (var i = 0, l = segments.length; i < l; i++) {
        var segment = segments[i];

        if (segment instanceof EpsilonSegment) {
          continue;
        }

        output += "/";
        output += segment.generate(params);
      }

      if (output.charAt(0) !== '/') {
        output = '/' + output;
      }

      if (params && params.queryParams) {
        output += this.generateQueryString(params.queryParams);
      }

      return output;
    },

    generateQueryString: function generateQueryString(params) {
      var pairs = [];
      var keys = [];
      for (var key in params) {
        if (params.hasOwnProperty(key)) {
          keys.push(key);
        }
      }
      keys.sort();
      for (var i = 0, len = keys.length; i < len; i++) {
        key = keys[i];
        var value = params[key];
        if (value == null) {
          continue;
        }
        var pair = encodeURIComponent(key);
        if (isArray(value)) {
          for (var j = 0, l = value.length; j < l; j++) {
            var arrayPair = key + '[]' + '=' + encodeURIComponent(value[j]);
            pairs.push(arrayPair);
          }
        } else {
          pair += "=" + encodeURIComponent(value);
          pairs.push(pair);
        }
      }

      if (pairs.length === 0) {
        return '';
      }

      return "?" + pairs.join("&");
    },

    parseQueryString: function parseQueryString(queryString) {
      var pairs = queryString.split("&"),
          queryParams = {};
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('='),
            key = decodeQueryParamPart(pair[0]),
            keyLength = key.length,
            isArray = false,
            value;
        if (pair.length === 1) {
          value = 'true';
        } else {
          //Handle arrays
          if (keyLength > 2 && key.slice(keyLength - 2) === '[]') {
            isArray = true;
            key = key.slice(0, keyLength - 2);
            if (!queryParams[key]) {
              queryParams[key] = [];
            }
          }
          value = pair[1] ? decodeQueryParamPart(pair[1]) : '';
        }
        if (isArray) {
          queryParams[key].push(value);
        } else {
          queryParams[key] = value;
        }
      }
      return queryParams;
    },

    recognize: function recognize(path, silent) {
      noWarning = silent;
      var states = [this.rootState],
          pathLen,
          i,
          l,
          queryStart,
          queryParams = {},
          isSlashDropped = false;

      queryStart = path.indexOf('?');
      if (queryStart !== -1) {
        var queryString = path.substr(queryStart + 1, path.length);
        path = path.substr(0, queryStart);
        if (queryString) {
          queryParams = this.parseQueryString(queryString);
        }
      }

      path = tryDecode(path);
      if (!path) return;

      // DEBUG GROUP path

      if (path.charAt(0) !== "/") {
        path = "/" + path;
      }

      pathLen = path.length;
      if (pathLen > 1 && path.charAt(pathLen - 1) === "/") {
        path = path.substr(0, pathLen - 1);
        isSlashDropped = true;
      }

      for (i = 0, l = path.length; i < l; i++) {
        states = recognizeChar(states, path.charAt(i));
        if (!states.length) {
          break;
        }
      }

      // END DEBUG GROUP

      var solutions = [];
      for (i = 0, l = states.length; i < l; i++) {
        if (states[i].handlers) {
          solutions.push(states[i]);
        }
      }

      states = sortSolutions(solutions);

      var state = solutions[0];

      if (state && state.handlers) {
        // if a trailing slash was dropped and a star segment is the last segment
        // specified, put the trailing slash back
        if (isSlashDropped && state.regex.source.slice(-5) === "(.+)$") {
          path = path + "/";
        }
        return findHandler(state, path, queryParams);
      }
    }
  };

  RouteRecognizer.prototype.map = map;

  var genQuery = RouteRecognizer.prototype.generateQueryString;

  // export default for holding the Vue reference
  var exports$1 = {};
  /**
   * Warn stuff.
   *
   * @param {String} msg
   */

  function warn$1(msg) {
    /* istanbul ignore next */
    if (typeof console !== 'undefined') {
      console.error('[vue-router] ' + msg);
    }
  }

  /**
   * Resolve a relative path.
   *
   * @param {String} base
   * @param {String} relative
   * @param {Boolean} append
   * @return {String}
   */

  function resolvePath(base, relative, append) {
    var query = base.match(/(\?.*)$/);
    if (query) {
      query = query[1];
      base = base.slice(0, -query.length);
    }
    // a query!
    if (relative.charAt(0) === '?') {
      return base + relative;
    }
    var stack = base.split('/');
    // remove trailing segment if:
    // - not appending
    // - appending to trailing slash (last segment is empty)
    if (!append || !stack[stack.length - 1]) {
      stack.pop();
    }
    // resolve relative path
    var segments = relative.replace(/^\//, '').split('/');
    for (var i = 0; i < segments.length; i++) {
      var segment = segments[i];
      if (segment === '.') {
        continue;
      } else if (segment === '..') {
        stack.pop();
      } else {
        stack.push(segment);
      }
    }
    // ensure leading slash
    if (stack[0] !== '') {
      stack.unshift('');
    }
    return stack.join('/');
  }

  /**
   * Forgiving check for a promise
   *
   * @param {Object} p
   * @return {Boolean}
   */

  function isPromise(p) {
    return p && typeof p.then === 'function';
  }

  /**
   * Retrive a route config field from a component instance
   * OR a component contructor.
   *
   * @param {Function|Vue} component
   * @param {String} name
   * @return {*}
   */

  function getRouteConfig(component, name) {
    var options = component && (component.$options || component.options);
    return options && options.route && options.route[name];
  }

  /**
   * Resolve an async component factory. Have to do a dirty
   * mock here because of Vue core's internal API depends on
   * an ID check.
   *
   * @param {Object} handler
   * @param {Function} cb
   */

  var resolver = undefined;

  function resolveAsyncComponent(handler, cb) {
    if (!resolver) {
      resolver = {
        resolve: exports$1.Vue.prototype._resolveComponent,
        $options: {
          components: {
            _: handler.component
          }
        }
      };
    } else {
      resolver.$options.components._ = handler.component;
    }
    resolver.resolve('_', function (Component) {
      handler.component = Component;
      cb(Component);
    });
  }

  /**
   * Map the dynamic segments in a path to params.
   *
   * @param {String} path
   * @param {Object} params
   * @param {Object} query
   */

  function mapParams(path, params, query) {
    if (params === undefined) params = {};

    path = path.replace(/:([^\/]+)/g, function (_, key) {
      var val = params[key];
      /* istanbul ignore if */
      if (!val) {
        warn$1('param "' + key + '" not found when generating ' + 'path for "' + path + '" with params ' + JSON.stringify(params));
      }
      return val || '';
    });
    if (query) {
      path += genQuery(query);
    }
    return path;
  }

  var hashRE = /#.*$/;

  var HTML5History = (function () {
    function HTML5History(_ref) {
      var root = _ref.root;
      var onChange = _ref.onChange;
      babelHelpers.classCallCheck(this, HTML5History);

      if (root && root !== '/') {
        // make sure there's the starting slash
        if (root.charAt(0) !== '/') {
          root = '/' + root;
        }
        // remove trailing slash
        this.root = root.replace(/\/$/, '');
        this.rootRE = new RegExp('^\\' + this.root);
      } else {
        this.root = null;
      }
      this.onChange = onChange;
      // check base tag
      var baseEl = document.querySelector('base');
      this.base = baseEl && baseEl.getAttribute('href');
    }

    HTML5History.prototype.start = function start() {
      var _this = this;

      this.listener = function (e) {
        var url = location.pathname + location.search;
        if (_this.root) {
          url = url.replace(_this.rootRE, '');
        }
        _this.onChange(url, e && e.state, location.hash);
      };
      window.addEventListener('popstate', this.listener);
      this.listener();
    };

    HTML5History.prototype.stop = function stop() {
      window.removeEventListener('popstate', this.listener);
    };

    HTML5History.prototype.go = function go(path, replace, append) {
      var url = this.formatPath(path, append);
      if (replace) {
        history.replaceState({}, '', url);
      } else {
        // record scroll position by replacing current state
        history.replaceState({
          pos: {
            x: window.pageXOffset,
            y: window.pageYOffset
          }
        }, '', location.href);
        // then push new state
        history.pushState({}, '', url);
      }
      var hashMatch = path.match(hashRE);
      var hash = hashMatch && hashMatch[0];
      path = url
      // strip hash so it doesn't mess up params
      .replace(hashRE, '')
      // remove root before matching
      .replace(this.rootRE, '');
      this.onChange(path, null, hash);
    };

    HTML5History.prototype.formatPath = function formatPath(path, append) {
      return path.charAt(0) === '/'
      // absolute path
      ? this.root ? this.root + '/' + path.replace(/^\//, '') : path : resolvePath(this.base || location.pathname, path, append);
    };

    return HTML5History;
  })();

  var HashHistory = (function () {
    function HashHistory(_ref) {
      var hashbang = _ref.hashbang;
      var onChange = _ref.onChange;
      babelHelpers.classCallCheck(this, HashHistory);

      this.hashbang = hashbang;
      this.onChange = onChange;
    }

    HashHistory.prototype.start = function start() {
      var self = this;
      this.listener = function () {
        var path = location.hash;
        var raw = path.replace(/^#!?/, '');
        // always
        if (raw.charAt(0) !== '/') {
          raw = '/' + raw;
        }
        var formattedPath = self.formatPath(raw);
        if (formattedPath !== path) {
          location.replace(formattedPath);
          return;
        }
        // determine query
        // note it's possible to have queries in both the actual URL
        // and the hash fragment itself.
        var query = location.search && path.indexOf('?') > -1 ? '&' + location.search.slice(1) : location.search;
        self.onChange(path.replace(/^#!?/, '') + query);
      };
      window.addEventListener('hashchange', this.listener);
      this.listener();
    };

    HashHistory.prototype.stop = function stop() {
      window.removeEventListener('hashchange', this.listener);
    };

    HashHistory.prototype.go = function go(path, replace, append) {
      path = this.formatPath(path, append);
      if (replace) {
        location.replace(path);
      } else {
        location.hash = path;
      }
    };

    HashHistory.prototype.formatPath = function formatPath(path, append) {
      var isAbsoloute = path.charAt(0) === '/';
      var prefix = '#' + (this.hashbang ? '!' : '');
      return isAbsoloute ? prefix + path : prefix + resolvePath(location.hash.replace(/^#!?/, ''), path, append);
    };

    return HashHistory;
  })();

  var AbstractHistory = (function () {
    function AbstractHistory(_ref) {
      var onChange = _ref.onChange;
      babelHelpers.classCallCheck(this, AbstractHistory);

      this.onChange = onChange;
      this.currentPath = '/';
    }

    AbstractHistory.prototype.start = function start() {
      this.onChange('/');
    };

    AbstractHistory.prototype.stop = function stop() {
      // noop
    };

    AbstractHistory.prototype.go = function go(path, replace, append) {
      path = this.currentPath = this.formatPath(path, append);
      this.onChange(path);
    };

    AbstractHistory.prototype.formatPath = function formatPath(path, append) {
      return path.charAt(0) === '/' ? path : resolvePath(this.currentPath, path, append);
    };

    return AbstractHistory;
  })();

  /**
   * Determine the reusability of an existing router view.
   *
   * @param {Directive} view
   * @param {Object} handler
   * @param {Transition} transition
   */

  function canReuse(view, handler, transition) {
    var component = view.childVM;
    if (!component || !handler) {
      return false;
    }
    // important: check view.Component here because it may
    // have been changed in activate hook
    if (view.Component !== handler.component) {
      return false;
    }
    var canReuseFn = getRouteConfig(component, 'canReuse');
    return typeof canReuseFn === 'boolean' ? canReuseFn : canReuseFn ? canReuseFn.call(component, {
      to: transition.to,
      from: transition.from
    }) : true; // defaults to true
  }

  /**
   * Check if a component can deactivate.
   *
   * @param {Directive} view
   * @param {Transition} transition
   * @param {Function} next
   */

  function canDeactivate(view, transition, next) {
    var fromComponent = view.childVM;
    var hook = getRouteConfig(fromComponent, 'canDeactivate');
    if (!hook) {
      next();
    } else {
      transition.callHook(hook, fromComponent, next, {
        expectBoolean: true
      });
    }
  }

  /**
   * Check if a component can activate.
   *
   * @param {Object} handler
   * @param {Transition} transition
   * @param {Function} next
   */

  function canActivate(handler, transition, next) {
    resolveAsyncComponent(handler, function (Component) {
      // have to check due to async-ness
      if (transition.aborted) {
        return;
      }
      // determine if this component can be activated
      var hook = getRouteConfig(Component, 'canActivate');
      if (!hook) {
        next();
      } else {
        transition.callHook(hook, null, next, {
          expectBoolean: true
        });
      }
    });
  }

  /**
   * Call deactivate hooks for existing router-views.
   *
   * @param {Directive} view
   * @param {Transition} transition
   * @param {Function} next
   */

  function deactivate(view, transition, next) {
    var component = view.childVM;
    var hook = getRouteConfig(component, 'deactivate');
    if (!hook) {
      next();
    } else {
      transition.callHooks(hook, component, next);
    }
  }

  /**
   * Activate / switch component for a router-view.
   *
   * @param {Directive} view
   * @param {Transition} transition
   * @param {Number} depth
   * @param {Function} [cb]
   */

  function activate(view, transition, depth, cb, reuse) {
    var handler = transition.activateQueue[depth];
    if (!handler) {
      saveChildView(view);
      if (view._bound) {
        view.setComponent(null);
      }
      cb && cb();
      return;
    }

    var Component = view.Component = handler.component;
    var activateHook = getRouteConfig(Component, 'activate');
    var dataHook = getRouteConfig(Component, 'data');
    var waitForData = getRouteConfig(Component, 'waitForData');

    view.depth = depth;
    view.activated = false;

    var component = undefined;
    var loading = !!(dataHook && !waitForData);

    // "reuse" is a flag passed down when the parent view is
    // either reused via keep-alive or as a child of a kept-alive view.
    // of course we can only reuse if the current kept-alive instance
    // is of the correct type.
    reuse = reuse && view.childVM && view.childVM.constructor === Component;

    if (reuse) {
      // just reuse
      component = view.childVM;
      component.$loadingRouteData = loading;
    } else {
      saveChildView(view);

      // unbuild current component. this step also destroys
      // and removes all nested child views.
      view.unbuild(true);

      // build the new component. this will also create the
      // direct child view of the current one. it will register
      // itself as view.childView.
      component = view.build({
        _meta: {
          $loadingRouteData: loading
        },
        created: function created() {
          this._routerView = view;
        }
      });

      // handle keep-alive.
      // when a kept-alive child vm is restored, we need to
      // add its cached child views into the router's view list,
      // and also properly update current view's child view.
      if (view.keepAlive) {
        component.$loadingRouteData = loading;
        var cachedChildView = component._keepAliveRouterView;
        if (cachedChildView) {
          view.childView = cachedChildView;
          component._keepAliveRouterView = null;
        }
      }
    }

    // cleanup the component in case the transition is aborted
    // before the component is ever inserted.
    var cleanup = function cleanup() {
      component.$destroy();
    };

    // actually insert the component and trigger transition
    var insert = function insert() {
      if (reuse) {
        cb && cb();
        return;
      }
      var router = transition.router;
      if (router._rendered || router._transitionOnLoad) {
        view.transition(component);
      } else {
        // no transition on first render, manual transition
        /* istanbul ignore if */
        if (view.setCurrent) {
          // 0.12 compat
          view.setCurrent(component);
        } else {
          // 1.0
          view.childVM = component;
        }
        component.$before(view.anchor, null, false);
      }
      cb && cb();
    };

    var afterData = function afterData() {
      // activate the child view
      if (view.childView) {
        activate(view.childView, transition, depth + 1, null, reuse || view.keepAlive);
      }
      insert();
    };

    // called after activation hook is resolved
    var afterActivate = function afterActivate() {
      view.activated = true;
      if (dataHook && waitForData) {
        // wait until data loaded to insert
        loadData(component, transition, dataHook, afterData, cleanup);
      } else {
        // load data and insert at the same time
        if (dataHook) {
          loadData(component, transition, dataHook);
        }
        afterData();
      }
    };

    if (activateHook) {
      transition.callHooks(activateHook, component, afterActivate, {
        cleanup: cleanup,
        postActivate: true
      });
    } else {
      afterActivate();
    }
  }

  /**
   * Reuse a view, just reload data if necessary.
   *
   * @param {Directive} view
   * @param {Transition} transition
   */

  function reuse(view, transition) {
    var component = view.childVM;
    var dataHook = getRouteConfig(component, 'data');
    if (dataHook) {
      loadData(component, transition, dataHook);
    }
  }

  /**
   * Asynchronously load and apply data to component.
   *
   * @param {Vue} component
   * @param {Transition} transition
   * @param {Function} hook
   * @param {Function} cb
   * @param {Function} cleanup
   */

  function loadData(component, transition, hook, cb, cleanup) {
    component.$loadingRouteData = true;
    transition.callHooks(hook, component, function () {
      component.$loadingRouteData = false;
      component.$emit('route-data-loaded', component);
      cb && cb();
    }, {
      cleanup: cleanup,
      postActivate: true,
      processData: function processData(data) {
        // handle promise sugar syntax
        var promises = [];
        if (isPlainObject(data)) {
          Object.keys(data).forEach(function (key) {
            var val = data[key];
            if (isPromise(val)) {
              promises.push(val.then(function (resolvedVal) {
                component.$set(key, resolvedVal);
              }));
            } else {
              component.$set(key, val);
            }
          });
        }
        if (promises.length) {
          return promises[0].constructor.all(promises);
        }
      }
    });
  }

  /**
   * Save the child view for a kept-alive view so that
   * we can restore it when it is switched back to.
   *
   * @param {Directive} view
   */

  function saveChildView(view) {
    if (view.keepAlive && view.childVM && view.childView) {
      view.childVM._keepAliveRouterView = view.childView;
    }
    view.childView = null;
  }

  /**
   * Check plain object.
   *
   * @param {*} val
   */

  function isPlainObject(val) {
    return Object.prototype.toString.call(val) === '[object Object]';
  }

  /**
   * A RouteTransition object manages the pipeline of a
   * router-view switching process. This is also the object
   * passed into user route hooks.
   *
   * @param {Router} router
   * @param {Route} to
   * @param {Route} from
   */

  var RouteTransition = (function () {
    function RouteTransition(router, to, from) {
      babelHelpers.classCallCheck(this, RouteTransition);

      this.router = router;
      this.to = to;
      this.from = from;
      this.next = null;
      this.aborted = false;
      this.done = false;
    }

    /**
     * Abort current transition and return to previous location.
     */

    RouteTransition.prototype.abort = function abort() {
      if (!this.aborted) {
        this.aborted = true;
        // if the root path throws an error during validation
        // on initial load, it gets caught in an infinite loop.
        var abortingOnLoad = !this.from.path && this.to.path === '/';
        if (!abortingOnLoad) {
          this.router.replace(this.from.path || '/');
        }
      }
    };

    /**
     * Abort current transition and redirect to a new location.
     *
     * @param {String} path
     */

    RouteTransition.prototype.redirect = function redirect(path) {
      if (!this.aborted) {
        this.aborted = true;
        if (typeof path === 'string') {
          path = mapParams(path, this.to.params, this.to.query);
        } else {
          path.params = path.params || this.to.params;
          path.query = path.query || this.to.query;
        }
        this.router.replace(path);
      }
    };

    /**
     * A router view transition's pipeline can be described as
     * follows, assuming we are transitioning from an existing
     * <router-view> chain [Component A, Component B] to a new
     * chain [Component A, Component C]:
     *
     *  A    A
     *  | => |
     *  B    C
     *
     * 1. Reusablity phase:
     *   -> canReuse(A, A)
     *   -> canReuse(B, C)
     *   -> determine new queues:
     *      - deactivation: [B]
     *      - activation: [C]
     *
     * 2. Validation phase:
     *   -> canDeactivate(B)
     *   -> canActivate(C)
     *
     * 3. Activation phase:
     *   -> deactivate(B)
     *   -> activate(C)
     *
     * Each of these steps can be asynchronous, and any
     * step can potentially abort the transition.
     *
     * @param {Function} cb
     */

    RouteTransition.prototype.start = function start(cb) {
      var transition = this;

      // determine the queue of views to deactivate
      var deactivateQueue = [];
      var view = this.router._rootView;
      while (view) {
        deactivateQueue.unshift(view);
        view = view.childView;
      }
      var reverseDeactivateQueue = deactivateQueue.slice().reverse();

      // determine the queue of route handlers to activate
      var activateQueue = this.activateQueue = toArray(this.to.matched).map(function (match) {
        return match.handler;
      });

      // 1. Reusability phase
      var i = undefined,
          reuseQueue = undefined;
      for (i = 0; i < reverseDeactivateQueue.length; i++) {
        if (!canReuse(reverseDeactivateQueue[i], activateQueue[i], transition)) {
          break;
        }
      }
      if (i > 0) {
        reuseQueue = reverseDeactivateQueue.slice(0, i);
        deactivateQueue = reverseDeactivateQueue.slice(i).reverse();
        activateQueue = activateQueue.slice(i);
      }

      // 2. Validation phase
      transition.runQueue(deactivateQueue, canDeactivate, function () {
        transition.runQueue(activateQueue, canActivate, function () {
          transition.runQueue(deactivateQueue, deactivate, function () {
            // 3. Activation phase

            // Update router current route
            transition.router._onTransitionValidated(transition);

            // trigger reuse for all reused views
            reuseQueue && reuseQueue.forEach(function (view) {
              return reuse(view, transition);
            });

            // the root of the chain that needs to be replaced
            // is the top-most non-reusable view.
            if (deactivateQueue.length) {
              var _view = deactivateQueue[deactivateQueue.length - 1];
              var depth = reuseQueue ? reuseQueue.length : 0;
              activate(_view, transition, depth, cb);
            } else {
              cb();
            }
          });
        });
      });
    };

    /**
     * Asynchronously and sequentially apply a function to a
     * queue.
     *
     * @param {Array} queue
     * @param {Function} fn
     * @param {Function} cb
     */

    RouteTransition.prototype.runQueue = function runQueue(queue, fn, cb) {
      var transition = this;
      step(0);
      function step(index) {
        if (index >= queue.length) {
          cb();
        } else {
          fn(queue[index], transition, function () {
            step(index + 1);
          });
        }
      }
    };

    /**
     * Call a user provided route transition hook and handle
     * the response (e.g. if the user returns a promise).
     *
     * If the user neither expects an argument nor returns a
     * promise, the hook is assumed to be synchronous.
     *
     * @param {Function} hook
     * @param {*} [context]
     * @param {Function} [cb]
     * @param {Object} [options]
     *                 - {Boolean} expectBoolean
     *                 - {Boolean} postActive
     *                 - {Function} processData
     *                 - {Function} cleanup
     */

    RouteTransition.prototype.callHook = function callHook(hook, context, cb) {
      var _ref = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

      var _ref$expectBoolean = _ref.expectBoolean;
      var expectBoolean = _ref$expectBoolean === undefined ? false : _ref$expectBoolean;
      var _ref$postActivate = _ref.postActivate;
      var postActivate = _ref$postActivate === undefined ? false : _ref$postActivate;
      var processData = _ref.processData;
      var cleanup = _ref.cleanup;

      var transition = this;
      var nextCalled = false;

      // abort the transition
      var abort = function abort() {
        cleanup && cleanup();
        transition.abort();
      };

      // handle errors
      var onError = function onError(err) {
        postActivate ? next() : abort();
        if (err && !transition.router._suppress) {
          warn$1('Uncaught error during transition: ');
          throw err instanceof Error ? err : new Error(err);
        }
      };

      // since promise swallows errors, we have to
      // throw it in the next tick...
      var onPromiseError = function onPromiseError(err) {
        try {
          onError(err);
        } catch (e) {
          setTimeout(function () {
            throw e;
          }, 0);
        }
      };

      // advance the transition to the next step
      var next = function next() {
        if (nextCalled) {
          warn$1('transition.next() should be called only once.');
          return;
        }
        nextCalled = true;
        if (transition.aborted) {
          cleanup && cleanup();
          return;
        }
        cb && cb();
      };

      var nextWithBoolean = function nextWithBoolean(res) {
        if (typeof res === 'boolean') {
          res ? next() : abort();
        } else if (isPromise(res)) {
          res.then(function (ok) {
            ok ? next() : abort();
          }, onPromiseError);
        } else if (!hook.length) {
          next();
        }
      };

      var nextWithData = function nextWithData(data) {
        var res = undefined;
        try {
          res = processData(data);
        } catch (err) {
          return onError(err);
        }
        if (isPromise(res)) {
          res.then(next, onPromiseError);
        } else {
          next();
        }
      };

      // expose a clone of the transition object, so that each
      // hook gets a clean copy and prevent the user from
      // messing with the internals.
      var exposed = {
        to: transition.to,
        from: transition.from,
        abort: abort,
        next: processData ? nextWithData : next,
        redirect: function redirect() {
          transition.redirect.apply(transition, arguments);
        }
      };

      // actually call the hook
      var res = undefined;
      try {
        res = hook.call(context, exposed);
      } catch (err) {
        return onError(err);
      }

      if (expectBoolean) {
        // boolean hooks
        nextWithBoolean(res);
      } else if (isPromise(res)) {
        // promise
        if (processData) {
          res.then(nextWithData, onPromiseError);
        } else {
          res.then(next, onPromiseError);
        }
      } else if (processData && isPlainOjbect(res)) {
        // data promise sugar
        nextWithData(res);
      } else if (!hook.length) {
        next();
      }
    };

    /**
     * Call a single hook or an array of async hooks in series.
     *
     * @param {Array} hooks
     * @param {*} context
     * @param {Function} cb
     * @param {Object} [options]
     */

    RouteTransition.prototype.callHooks = function callHooks(hooks, context, cb, options) {
      var _this = this;

      if (Array.isArray(hooks)) {
        this.runQueue(hooks, function (hook, _, next) {
          if (!_this.aborted) {
            _this.callHook(hook, context, next, options);
          }
        }, cb);
      } else {
        this.callHook(hooks, context, cb, options);
      }
    };

    return RouteTransition;
  })();

  function isPlainOjbect(val) {
    return Object.prototype.toString.call(val) === '[object Object]';
  }

  function toArray(val) {
    return val ? Array.prototype.slice.call(val) : [];
  }

  var internalKeysRE = /^(component|subRoutes|fullPath)$/;

  /**
   * Route Context Object
   *
   * @param {String} path
   * @param {Router} router
   */

  var Route = function Route(path, router) {
    var _this = this;

    babelHelpers.classCallCheck(this, Route);

    var matched = router._recognizer.recognize(path);
    if (matched) {
      // copy all custom fields from route configs
      [].forEach.call(matched, function (match) {
        for (var key in match.handler) {
          if (!internalKeysRE.test(key)) {
            _this[key] = match.handler[key];
          }
        }
      });
      // set query and params
      this.query = matched.queryParams;
      this.params = [].reduce.call(matched, function (prev, cur) {
        if (cur.params) {
          for (var key in cur.params) {
            prev[key] = cur.params[key];
          }
        }
        return prev;
      }, {});
    }
    // expose path and router
    this.path = path;
    // for internal use
    this.matched = matched || router._notFoundHandler;
    // internal reference to router
    Object.defineProperty(this, 'router', {
      enumerable: false,
      value: router
    });
    // Important: freeze self to prevent observation
    Object.freeze(this);
  };

  function applyOverride (Vue) {
    var _Vue$util = Vue.util;
    var extend = _Vue$util.extend;
    var isArray = _Vue$util.isArray;
    var defineReactive = _Vue$util.defineReactive;

    // override Vue's init and destroy process to keep track of router instances
    var init = Vue.prototype._init;
    Vue.prototype._init = function (options) {
      options = options || {};
      var root = options._parent || options.parent || this;
      var router = root.$router;
      var route = root.$route;
      if (router) {
        // expose router
        this.$router = router;
        router._children.push(this);
        /* istanbul ignore if */
        if (this._defineMeta) {
          // 0.12
          this._defineMeta('$route', route);
        } else {
          // 1.0
          defineReactive(this, '$route', route);
        }
      }
      init.call(this, options);
    };

    var destroy = Vue.prototype._destroy;
    Vue.prototype._destroy = function () {
      if (!this._isBeingDestroyed && this.$router) {
        this.$router._children.$remove(this);
      }
      destroy.apply(this, arguments);
    };

    // 1.0 only: enable route mixins
    var strats = Vue.config.optionMergeStrategies;
    var hooksToMergeRE = /^(data|activate|deactivate)$/;

    if (strats) {
      strats.route = function (parentVal, childVal) {
        if (!childVal) return parentVal;
        if (!parentVal) return childVal;
        var ret = {};
        extend(ret, parentVal);
        for (var key in childVal) {
          var a = ret[key];
          var b = childVal[key];
          // for data, activate and deactivate, we need to merge them into
          // arrays similar to lifecycle hooks.
          if (a && hooksToMergeRE.test(key)) {
            ret[key] = (isArray(a) ? a : [a]).concat(b);
          } else {
            ret[key] = b;
          }
        }
        return ret;
      };
    }
  }

  function View (Vue) {

    var _ = Vue.util;
    var componentDef =
    // 0.12
    Vue.directive('_component') ||
    // 1.0
    Vue.internalDirectives.component;
    // <router-view> extends the internal component directive
    var viewDef = _.extend({}, componentDef);

    // with some overrides
    _.extend(viewDef, {

      _isRouterView: true,

      bind: function bind() {
        var route = this.vm.$route;
        /* istanbul ignore if */
        if (!route) {
          warn$1('<router-view> can only be used inside a ' + 'router-enabled app.');
          return;
        }
        // force dynamic directive so v-component doesn't
        // attempt to build right now
        this._isDynamicLiteral = true;
        // finally, init by delegating to v-component
        componentDef.bind.call(this);

        // locate the parent view
        var parentView = undefined;
        var parent = this.vm;
        while (parent) {
          if (parent._routerView) {
            parentView = parent._routerView;
            break;
          }
          parent = parent.$parent;
        }
        if (parentView) {
          // register self as a child of the parent view,
          // instead of activating now. This is so that the
          // child's activate hook is called after the
          // parent's has resolved.
          this.parentView = parentView;
          parentView.childView = this;
        } else {
          // this is the root view!
          var router = route.router;
          router._rootView = this;
        }

        // handle late-rendered view
        // two possibilities:
        // 1. root view rendered after transition has been
        //    validated;
        // 2. child view rendered after parent view has been
        //    activated.
        var transition = route.router._currentTransition;
        if (!parentView && transition.done || parentView && parentView.activated) {
          var depth = parentView ? parentView.depth + 1 : 0;
          activate(this, transition, depth);
        }
      },

      unbind: function unbind() {
        if (this.parentView) {
          this.parentView.childView = null;
        }
        componentDef.unbind.call(this);
      }
    });

    Vue.elementDirective('router-view', viewDef);
  }

  var trailingSlashRE = /\/$/;
  var regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g;
  var queryStringRE = /\?.*$/;

  // install v-link, which provides navigation support for
  // HTML5 history mode
  function Link (Vue) {
    var _Vue$util = Vue.util;
    var _bind = _Vue$util.bind;
    var isObject = _Vue$util.isObject;
    var addClass = _Vue$util.addClass;
    var removeClass = _Vue$util.removeClass;

    var onPriority = Vue.directive('on').priority;
    var LINK_UPDATE = '__vue-router-link-update__';

    var activeId = 0;

    Vue.directive('link-active', {
      priority: 9999,
      bind: function bind() {
        var _this = this;

        var id = String(activeId++);
        // collect v-links contained within this element.
        // we need do this here before the parent-child relationship
        // gets messed up by terminal directives (if, for, components)
        var childLinks = this.el.querySelectorAll('[v-link]');
        for (var i = 0, l = childLinks.length; i < l; i++) {
          var link = childLinks[i];
          var existingId = link.getAttribute(LINK_UPDATE);
          var value = existingId ? existingId + ',' + id : id;
          // leave a mark on the link element which can be persisted
          // through fragment clones.
          link.setAttribute(LINK_UPDATE, value);
        }
        this.vm.$on(LINK_UPDATE, this.cb = function (link, path) {
          if (link.activeIds.indexOf(id) > -1) {
            link.updateClasses(path, _this.el);
          }
        });
      },
      unbind: function unbind() {
        this.vm.$off(LINK_UPDATE, this.cb);
      }
    });

    Vue.directive('link', {
      priority: onPriority - 2,

      bind: function bind() {
        var vm = this.vm;
        /* istanbul ignore if */
        if (!vm.$route) {
          warn$1('v-link can only be used inside a router-enabled app.');
          return;
        }
        this.router = vm.$route.router;
        // update things when the route changes
        this.unwatch = vm.$watch('$route', _bind(this.onRouteUpdate, this));
        // check v-link-active ids
        var activeIds = this.el.getAttribute(LINK_UPDATE);
        if (activeIds) {
          this.el.removeAttribute(LINK_UPDATE);
          this.activeIds = activeIds.split(',');
        }
        // no need to handle click if link expects to be opened
        // in a new window/tab.
        /* istanbul ignore if */
        if (this.el.tagName === 'A' && this.el.getAttribute('target') === '_blank') {
          return;
        }
        // handle click
        this.handler = _bind(this.onClick, this);
        this.el.addEventListener('click', this.handler);
      },

      update: function update(target) {
        this.target = target;
        if (isObject(target)) {
          this.append = target.append;
          this.exact = target.exact;
          this.prevActiveClass = this.activeClass;
          this.activeClass = target.activeClass;
        }
        this.onRouteUpdate(this.vm.$route);
      },

      onClick: function onClick(e) {
        // don't redirect with control keys
        /* istanbul ignore if */
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        // don't redirect when preventDefault called
        /* istanbul ignore if */
        if (e.defaultPrevented) return;
        // don't redirect on right click
        /* istanbul ignore if */
        if (e.button !== 0) return;

        var target = this.target;
        if (target) {
          // v-link with expression, just go
          e.preventDefault();
          this.router.go(target);
        } else {
          // no expression, delegate for an <a> inside
          var el = e.target;
          while (el.tagName !== 'A' && el !== this.el) {
            el = el.parentNode;
          }
          if (el.tagName === 'A' && sameOrigin(el)) {
            e.preventDefault();
            var path = el.pathname;
            if (this.router.history.root) {
              path = path.replace(this.router.history.rootRE, '');
            }
            this.router.go({
              path: path,
              replace: target && target.replace,
              append: target && target.append
            });
          }
        }
      },

      onRouteUpdate: function onRouteUpdate(route) {
        // router.stringifyPath is dependent on current route
        // and needs to be called again whenver route changes.
        var newPath = this.router.stringifyPath(this.target);
        if (this.path !== newPath) {
          this.path = newPath;
          this.updateActiveMatch();
          this.updateHref();
        }
        if (this.activeIds) {
          this.vm.$emit(LINK_UPDATE, this, route.path);
        } else {
          this.updateClasses(route.path, this.el);
        }
      },

      updateActiveMatch: function updateActiveMatch() {
        this.activeRE = this.path && !this.exact ? new RegExp('^' + this.path.replace(/\/$/, '').replace(queryStringRE, '').replace(regexEscapeRE, '\\$&') + '(\\/|$)') : null;
      },

      updateHref: function updateHref() {
        if (this.el.tagName !== 'A') {
          return;
        }
        var path = this.path;
        var router = this.router;
        var isAbsolute = path.charAt(0) === '/';
        // do not format non-hash relative paths
        var href = path && (router.mode === 'hash' || isAbsolute) ? router.history.formatPath(path, this.append) : path;
        if (href) {
          this.el.href = href;
        } else {
          this.el.removeAttribute('href');
        }
      },

      updateClasses: function updateClasses(path, el) {
        var activeClass = this.activeClass || this.router._linkActiveClass;
        // clear old class
        if (this.prevActiveClass && this.prevActiveClass !== activeClass) {
          toggleClasses(el, this.prevActiveClass, removeClass);
        }
        // remove query string before matching
        var dest = this.path.replace(queryStringRE, '');
        path = path.replace(queryStringRE, '');
        // add new class
        if (this.exact) {
          if (dest === path ||
          // also allow additional trailing slash
          dest.charAt(dest.length - 1) !== '/' && dest === path.replace(trailingSlashRE, '')) {
            toggleClasses(el, activeClass, addClass);
          } else {
            toggleClasses(el, activeClass, removeClass);
          }
        } else {
          if (this.activeRE && this.activeRE.test(path)) {
            toggleClasses(el, activeClass, addClass);
          } else {
            toggleClasses(el, activeClass, removeClass);
          }
        }
      },

      unbind: function unbind() {
        this.el.removeEventListener('click', this.handler);
        this.unwatch && this.unwatch();
      }
    });

    function sameOrigin(link) {
      return link.protocol === location.protocol && link.hostname === location.hostname && link.port === location.port;
    }

    // this function is copied from v-bind:class implementation until
    // we properly expose it...
    function toggleClasses(el, key, fn) {
      key = key.trim();
      if (key.indexOf(' ') === -1) {
        fn(el, key);
        return;
      }
      var keys = key.split(/\s+/);
      for (var i = 0, l = keys.length; i < l; i++) {
        fn(el, keys[i]);
      }
    }
  }

  var historyBackends = {
    abstract: AbstractHistory,
    hash: HashHistory,
    html5: HTML5History
  };

  // late bind during install
  var Vue = undefined;

  /**
   * Router constructor
   *
   * @param {Object} [options]
   */

  var Router = (function () {
    function Router() {
      var _this = this;

      var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var _ref$hashbang = _ref.hashbang;
      var hashbang = _ref$hashbang === undefined ? true : _ref$hashbang;
      var _ref$abstract = _ref.abstract;
      var abstract = _ref$abstract === undefined ? false : _ref$abstract;
      var _ref$history = _ref.history;
      var history = _ref$history === undefined ? false : _ref$history;
      var _ref$saveScrollPosition = _ref.saveScrollPosition;
      var saveScrollPosition = _ref$saveScrollPosition === undefined ? false : _ref$saveScrollPosition;
      var _ref$transitionOnLoad = _ref.transitionOnLoad;
      var transitionOnLoad = _ref$transitionOnLoad === undefined ? false : _ref$transitionOnLoad;
      var _ref$suppressTransitionError = _ref.suppressTransitionError;
      var suppressTransitionError = _ref$suppressTransitionError === undefined ? false : _ref$suppressTransitionError;
      var _ref$root = _ref.root;
      var root = _ref$root === undefined ? null : _ref$root;
      var _ref$linkActiveClass = _ref.linkActiveClass;
      var linkActiveClass = _ref$linkActiveClass === undefined ? 'v-link-active' : _ref$linkActiveClass;
      babelHelpers.classCallCheck(this, Router);

      /* istanbul ignore if */
      if (!Router.installed) {
        throw new Error('Please install the Router with Vue.use() before ' + 'creating an instance.');
      }

      // Vue instances
      this.app = null;
      this._children = [];

      // route recognizer
      this._recognizer = new RouteRecognizer();
      this._guardRecognizer = new RouteRecognizer();

      // state
      this._started = false;
      this._startCb = null;
      this._currentRoute = {};
      this._currentTransition = null;
      this._previousTransition = null;
      this._notFoundHandler = null;
      this._notFoundRedirect = null;
      this._beforeEachHooks = [];
      this._afterEachHooks = [];

      // trigger transition on initial render?
      this._rendered = false;
      this._transitionOnLoad = transitionOnLoad;

      // history mode
      this._root = root;
      this._abstract = abstract;
      this._hashbang = hashbang;

      // check if HTML5 history is available
      var hasPushState = typeof window !== 'undefined' && window.history && window.history.pushState;
      this._history = history && hasPushState;
      this._historyFallback = history && !hasPushState;

      // create history object
      var inBrowser = Vue.util.inBrowser;
      this.mode = !inBrowser || this._abstract ? 'abstract' : this._history ? 'html5' : 'hash';

      var History = historyBackends[this.mode];
      this.history = new History({
        root: root,
        hashbang: this._hashbang,
        onChange: function onChange(path, state, anchor) {
          _this._match(path, state, anchor);
        }
      });

      // other options
      this._saveScrollPosition = saveScrollPosition;
      this._linkActiveClass = linkActiveClass;
      this._suppress = suppressTransitionError;
    }

    /**
     * Allow directly passing components to a route
     * definition.
     *
     * @param {String} path
     * @param {Object} handler
     */

    // API ===================================================

    /**
    * Register a map of top-level paths.
    *
    * @param {Object} map
    */

    Router.prototype.map = function map(_map) {
      for (var route in _map) {
        this.on(route, _map[route]);
      }
      return this;
    };

    /**
     * Register a single root-level path
     *
     * @param {String} rootPath
     * @param {Object} handler
     *                 - {String} component
     *                 - {Object} [subRoutes]
     *                 - {Boolean} [forceRefresh]
     *                 - {Function} [before]
     *                 - {Function} [after]
     */

    Router.prototype.on = function on(rootPath, handler) {
      if (rootPath === '*') {
        this._notFound(handler);
      } else {
        this._addRoute(rootPath, handler, []);
      }
      return this;
    };

    /**
     * Set redirects.
     *
     * @param {Object} map
     */

    Router.prototype.redirect = function redirect(map) {
      for (var path in map) {
        this._addRedirect(path, map[path]);
      }
      return this;
    };

    /**
     * Set aliases.
     *
     * @param {Object} map
     */

    Router.prototype.alias = function alias(map) {
      for (var path in map) {
        this._addAlias(path, map[path]);
      }
      return this;
    };

    /**
     * Set global before hook.
     *
     * @param {Function} fn
     */

    Router.prototype.beforeEach = function beforeEach(fn) {
      this._beforeEachHooks.push(fn);
      return this;
    };

    /**
     * Set global after hook.
     *
     * @param {Function} fn
     */

    Router.prototype.afterEach = function afterEach(fn) {
      this._afterEachHooks.push(fn);
      return this;
    };

    /**
     * Navigate to a given path.
     * The path can be an object describing a named path in
     * the format of { name: '...', params: {}, query: {}}
     * The path is assumed to be already decoded, and will
     * be resolved against root (if provided)
     *
     * @param {String|Object} path
     * @param {Boolean} [replace]
     */

    Router.prototype.go = function go(path) {
      var replace = false;
      var append = false;
      if (Vue.util.isObject(path)) {
        replace = path.replace;
        append = path.append;
      }
      path = this.stringifyPath(path);
      if (path) {
        this.history.go(path, replace, append);
      }
    };

    /**
     * Short hand for replacing current path
     *
     * @param {String} path
     */

    Router.prototype.replace = function replace(path) {
      if (typeof path === 'string') {
        path = { path: path };
      }
      path.replace = true;
      this.go(path);
    };

    /**
     * Start the router.
     *
     * @param {VueConstructor} App
     * @param {String|Element} container
     * @param {Function} [cb]
     */

    Router.prototype.start = function start(App, container, cb) {
      /* istanbul ignore if */
      if (this._started) {
        warn$1('already started.');
        return;
      }
      this._started = true;
      this._startCb = cb;
      if (!this.app) {
        /* istanbul ignore if */
        if (!App || !container) {
          throw new Error('Must start vue-router with a component and a ' + 'root container.');
        }
        /* istanbul ignore if */
        if (App instanceof Vue) {
          throw new Error('Must start vue-router with a component, not a ' + 'Vue instance.');
        }
        this._appContainer = container;
        var Ctor = this._appConstructor = typeof App === 'function' ? App : Vue.extend(App);
        // give it a name for better debugging
        Ctor.options.name = Ctor.options.name || 'RouterApp';
      }

      // handle history fallback in browsers that do not
      // support HTML5 history API
      if (this._historyFallback) {
        var _location = window.location;
        var _history = new HTML5History({ root: this._root });
        var path = _history.root ? _location.pathname.replace(_history.rootRE, '') : _location.pathname;
        if (path && path !== '/') {
          _location.assign((_history.root || '') + '/' + this.history.formatPath(path) + _location.search);
          return;
        }
      }

      this.history.start();
    };

    /**
     * Stop listening to route changes.
     */

    Router.prototype.stop = function stop() {
      this.history.stop();
      this._started = false;
    };

    /**
     * Normalize named route object / string paths into
     * a string.
     *
     * @param {Object|String|Number} path
     * @return {String}
     */

    Router.prototype.stringifyPath = function stringifyPath(path) {
      var generatedPath = '';
      if (path && typeof path === 'object') {
        if (path.name) {
          var extend = Vue.util.extend;
          var currentParams = this._currentTransition && this._currentTransition.to.params;
          var targetParams = path.params || {};
          var params = currentParams ? extend(extend({}, currentParams), targetParams) : targetParams;
          generatedPath = encodeURI(this._recognizer.generate(path.name, params));
        } else if (path.path) {
          generatedPath = encodeURI(path.path);
        }
        if (path.query) {
          // note: the generated query string is pre-URL-encoded by the recognizer
          var query = this._recognizer.generateQueryString(path.query);
          if (generatedPath.indexOf('?') > -1) {
            generatedPath += '&' + query.slice(1);
          } else {
            generatedPath += query;
          }
        }
      } else {
        generatedPath = encodeURI(path ? path + '' : '');
      }
      return generatedPath;
    };

    // Internal methods ======================================

    /**
    * Add a route containing a list of segments to the internal
    * route recognizer. Will be called recursively to add all
    * possible sub-routes.
    *
    * @param {String} path
    * @param {Object} handler
    * @param {Array} segments
    */

    Router.prototype._addRoute = function _addRoute(path, handler, segments) {
      guardComponent(path, handler);
      handler.path = path;
      handler.fullPath = (segments.reduce(function (path, segment) {
        return path + segment.path;
      }, '') + path).replace('//', '/');
      segments.push({
        path: path,
        handler: handler
      });
      this._recognizer.add(segments, {
        as: handler.name
      });
      // add sub routes
      if (handler.subRoutes) {
        for (var subPath in handler.subRoutes) {
          // recursively walk all sub routes
          this._addRoute(subPath, handler.subRoutes[subPath],
          // pass a copy in recursion to avoid mutating
          // across branches
          segments.slice());
        }
      }
    };

    /**
     * Set the notFound route handler.
     *
     * @param {Object} handler
     */

    Router.prototype._notFound = function _notFound(handler) {
      guardComponent('*', handler);
      this._notFoundHandler = [{ handler: handler }];
    };

    /**
     * Add a redirect record.
     *
     * @param {String} path
     * @param {String} redirectPath
     */

    Router.prototype._addRedirect = function _addRedirect(path, redirectPath) {
      if (path === '*') {
        this._notFoundRedirect = redirectPath;
      } else {
        this._addGuard(path, redirectPath, this.replace);
      }
    };

    /**
     * Add an alias record.
     *
     * @param {String} path
     * @param {String} aliasPath
     */

    Router.prototype._addAlias = function _addAlias(path, aliasPath) {
      this._addGuard(path, aliasPath, this._match);
    };

    /**
     * Add a path guard.
     *
     * @param {String} path
     * @param {String} mappedPath
     * @param {Function} handler
     */

    Router.prototype._addGuard = function _addGuard(path, mappedPath, _handler) {
      var _this2 = this;

      this._guardRecognizer.add([{
        path: path,
        handler: function handler(match, query) {
          var realPath = mapParams(mappedPath, match.params, query);
          _handler.call(_this2, realPath);
        }
      }]);
    };

    /**
     * Check if a path matches any redirect records.
     *
     * @param {String} path
     * @return {Boolean} - if true, will skip normal match.
     */

    Router.prototype._checkGuard = function _checkGuard(path) {
      var matched = this._guardRecognizer.recognize(path, true);
      if (matched) {
        matched[0].handler(matched[0], matched.queryParams);
        return true;
      } else if (this._notFoundRedirect) {
        matched = this._recognizer.recognize(path);
        if (!matched) {
          this.replace(this._notFoundRedirect);
          return true;
        }
      }
    };

    /**
     * Match a URL path and set the route context on vm,
     * triggering view updates.
     *
     * @param {String} path
     * @param {Object} [state]
     * @param {String} [anchor]
     */

    Router.prototype._match = function _match(path, state, anchor) {
      var _this3 = this;

      if (this._checkGuard(path)) {
        return;
      }

      var currentRoute = this._currentRoute;
      var currentTransition = this._currentTransition;

      if (currentTransition) {
        if (currentTransition.to.path === path) {
          // do nothing if we have an active transition going to the same path
          return;
        } else if (currentRoute.path === path) {
          // We are going to the same path, but we also have an ongoing but
          // not-yet-validated transition. Abort that transition and reset to
          // prev transition.
          currentTransition.aborted = true;
          this._currentTransition = this._prevTransition;
          return;
        } else {
          // going to a totally different path. abort ongoing transition.
          currentTransition.aborted = true;
        }
      }

      // construct new route and transition context
      var route = new Route(path, this);
      var transition = new RouteTransition(this, route, currentRoute);

      // current transition is updated right now.
      // however, current route will only be updated after the transition has
      // been validated.
      this._prevTransition = currentTransition;
      this._currentTransition = transition;

      if (!this.app) {
        (function () {
          // initial render
          var router = _this3;
          _this3.app = new _this3._appConstructor({
            el: _this3._appContainer,
            created: function created() {
              this.$router = router;
            },
            _meta: {
              $route: route
            }
          });
        })();
      }

      // check global before hook
      var beforeHooks = this._beforeEachHooks;
      var startTransition = function startTransition() {
        transition.start(function () {
          _this3._postTransition(route, state, anchor);
        });
      };

      if (beforeHooks.length) {
        transition.runQueue(beforeHooks, function (hook, _, next) {
          if (transition === _this3._currentTransition) {
            transition.callHook(hook, null, next, {
              expectBoolean: true
            });
          }
        }, startTransition);
      } else {
        startTransition();
      }

      if (!this._rendered && this._startCb) {
        this._startCb.call(null);
      }

      // HACK:
      // set rendered to true after the transition start, so
      // that components that are acitvated synchronously know
      // whether it is the initial render.
      this._rendered = true;
    };

    /**
     * Set current to the new transition.
     * This is called by the transition object when the
     * validation of a route has succeeded.
     *
     * @param {Transition} transition
     */

    Router.prototype._onTransitionValidated = function _onTransitionValidated(transition) {
      // set current route
      var route = this._currentRoute = transition.to;
      // update route context for all children
      if (this.app.$route !== route) {
        this.app.$route = route;
        this._children.forEach(function (child) {
          child.$route = route;
        });
      }
      // call global after hook
      if (this._afterEachHooks.length) {
        this._afterEachHooks.forEach(function (hook) {
          return hook.call(null, {
            to: transition.to,
            from: transition.from
          });
        });
      }
      this._currentTransition.done = true;
    };

    /**
     * Handle stuff after the transition.
     *
     * @param {Route} route
     * @param {Object} [state]
     * @param {String} [anchor]
     */

    Router.prototype._postTransition = function _postTransition(route, state, anchor) {
      // handle scroll positions
      // saved scroll positions take priority
      // then we check if the path has an anchor
      var pos = state && state.pos;
      if (pos && this._saveScrollPosition) {
        Vue.nextTick(function () {
          window.scrollTo(pos.x, pos.y);
        });
      } else if (anchor) {
        Vue.nextTick(function () {
          var el = document.getElementById(anchor.slice(1));
          if (el) {
            window.scrollTo(window.scrollX, el.offsetTop);
          }
        });
      }
    };

    return Router;
  })();

  function guardComponent(path, handler) {
    var comp = handler.component;
    if (Vue.util.isPlainObject(comp)) {
      comp = handler.component = Vue.extend(comp);
    }
    /* istanbul ignore if */
    if (typeof comp !== 'function') {
      handler.component = null;
      warn$1('invalid component for route "' + path + '".');
    }
  }

  /* Installation */

  Router.installed = false;

  /**
   * Installation interface.
   * Install the necessary directives.
   */

  Router.install = function (externalVue) {
    /* istanbul ignore if */
    if (Router.installed) {
      warn$1('already installed.');
      return;
    }
    Vue = externalVue;
    applyOverride(Vue);
    View(Vue);
    Link(Vue);
    exports$1.Vue = Vue;
    Router.installed = true;
  };

  // auto install
  /* istanbul ignore if */
  if (typeof window !== 'undefined' && window.Vue) {
    window.Vue.use(Router);
  }

  return Router;

}));