/**
 * RevealPresentation — an SSR-safe Reveal.js wrapper for Docusaurus.
 *
 * Usage in a .md/.mdx page:
 *
 *   import RevealPresentation from '@site/src/components/RevealPresentation';
 *
 *   <RevealPresentation>
 *     <section>
 *       <h2>Slide 1</h2>
 *       <aside class="notes">Speaker notes here.</aside>
 *     </section>
 *     <section>…</section>
 *   </RevealPresentation>
 *
 * SSR safety:
 *   • The entire component is rendered only in the browser via <BrowserOnly>.
 *   • Reveal JS is imported dynamically inside useEffect so that
 *     `window`/`document` are never accessed during SSR (`npm run build`).
 *   • CSS imports are static (webpack extracts them to a stylesheet; no
 *     window access). They're safe at module level.
 *   • `embedded: true` keeps the deck inside the page; fullscreen is
 *     triggered via the Fullscreen API button (or the 'F' key once focused).
 *   • `keyboardCondition: 'focused'` means the deck only captures keys when
 *     the `.reveal` div is focused — click inside first, then use ← →.
 *     The div carries `tabIndex={0}` so it is programmatically focusable.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

// Static CSS imports — safe at module level; webpack extracts these to a
// stylesheet during build and does NOT access window/document during SSR.
import 'reveal.js/reveal.css';
import 'reveal.js/theme/white.css';
import 'reveal.js/plugin/highlight/monokai.css';

import styles from './styles.module.css';

// ─── Inner component (browser-only) ───────────────────────────────────────

function RevealPresentationInner({ children }) {
  const wrapperRef = useRef(null);
  const deckRef = useRef(null);

  useEffect(() => {
    if (!wrapperRef.current) return;

    const container = wrapperRef.current.querySelector('.reveal');
    if (!container) return;

    let destroyed = false;

    // Dynamic imports keep window/document access out of the SSR bundle.
    Promise.all([
      import('reveal.js'),
      import('reveal.js/plugin/notes'),
      import('reveal.js/plugin/highlight'),
    ]).then(([
      { default: Reveal },
      { default: RevealNotes },
      { default: RevealHighlight },
    ]) => {
      if (destroyed) return;

      const deck = new Reveal(container, {
        // `embedded: true` constrains the deck to our container div
        // rather than seizing document.body / the full viewport.
        embedded: true,
        // Only handle keyboard events when the presentation is focused,
        // so we don't steal keys from the rest of the page.
        keyboardCondition: 'focused',
        // Match the container dimensions (padding-bottom: 62.5% = 800/1280)
        // so Reveal's logical canvas fills the full width with no side gutters.
        // Height increased from 720→800 to give dense slides more vertical
        // space before content overflows the canvas. Default 960×700 left
        // ~23% of horizontal space unused; this canvas avoids that.
        width: 1280,
        height: 800,
        margin: 0.06,
        hash: false,
        history: false,
        controls: true,
        progress: true,
        center: true,
        transition: 'slide',
        slideNumber: 'c/t',
        plugins: [RevealNotes, RevealHighlight],
      });

      deck.initialize().then(() => {
        deck.sync();
        deckRef.current = deck;
      });
    }).catch(console.error);

    // When the browser enters or exits native fullscreen on our wrapper,
    // the container size changes but window.resize is NOT fired (the window
    // didn't change). Reveal recomputes scale on resize events, so without
    // this handler the deck stays at its embedded scale in fullscreen —
    // content appears clipped at the bottom. Calling layout() after a short
    // delay (element dimensions settle during the fullscreen transition)
    // forces Reveal to recalculate the transform and fill the screen.
    const onFullscreenChange = () => {
      requestAnimationFrame(() => {
        deckRef.current?.layout();
      });
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);

    return () => {
      destroyed = true;
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      if (deckRef.current) {
        try { deckRef.current.destroy(); } catch (_) {}
        deckRef.current = null;
      }
    };
  }, []);

  const handleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen ||
                  el.mozRequestFullScreen || el.msRequestFullscreen;
      req?.call(el);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen ||
                   document.mozCancelFullScreen || document.msExitFullscreen;
      exit?.call(document);
    }
  }, []);

  return (
    <div ref={wrapperRef} className={styles.deckWrapper}>
      {/* Toolbar — floats over the deck */}
      <div className={styles.toolbar}>
        <span className={styles.toolbarHint}>
          Click deck · ← → navigate · S speaker view
        </span>
        <button
          className={styles.toolbarBtn}
          onClick={handleFullscreen}
          title="Toggle fullscreen (F)"
        >
          ⛶ Fullscreen
        </button>
      </div>

      {/*
       * Reveal.js root — `embedded: true` confines it to this element.
       * tabIndex={0} makes the div focusable so that keyboard navigation
       * works when keyboardCondition: 'focused' is set — click the deck
       * first, then use ← → arrow keys.
       * To open speaker view: click the deck, then press S.
       */}
      <div className={`reveal ${styles.revealContainer}`} tabIndex={0}>
        <div className="slides">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Public export — wrapped in BrowserOnly for SSR safety ────────────────

export default function RevealPresentation({ children }) {
  return (
    <BrowserOnly
      fallback={
        <div style={{ padding: '2rem', textAlign: 'center', background: '#f5f5f5', borderRadius: 8 }}>
          Loading presentation…
        </div>
      }
    >
      {() => <RevealPresentationInner>{children}</RevealPresentationInner>}
    </BrowserOnly>
  );
}
