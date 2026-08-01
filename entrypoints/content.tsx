import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PageCompanion } from '../src/PageCompanion';
import { startSearchEnhancer } from '../src/searchEnhancer';
import styles from '../src/styles.css?inline';

export default defineContentScript({
  matches: ['https://www.goofish.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    if (location.pathname === '/search') startSearchEnhancer(ctx.signal);
    let root: Root | undefined;
    const ui = await createShadowRootUi(ctx, {
      name: 'xianyu-opportunity-radar',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const style = document.createElement('style');
        style.textContent = styles;
        container.append(style);
        const mount = document.createElement('div');
        mount.className = 'radar-page-root';
        container.append(mount);
        root = createRoot(mount);
        root.render(<PageCompanion />);
        return root;
      },
      onRemove() { root?.unmount(); }
    });
    ui.mount();
  }
});
