export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RADAR_HEALTH') {
      sendResponse({ ok: true, at: Date.now(), version: chrome.runtime.getManifest().version });
    }
  });
});
