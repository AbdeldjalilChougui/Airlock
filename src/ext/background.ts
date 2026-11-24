// MV3 service worker: context menu "Scrub selection with Airlock" -> side panel.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'airlock-scrub', title: 'Scrub selection with Airlock', contexts: ['selection'] });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.contextMenus.onClicked.addListener(async (info: any, tab: any) => {
  if (info.menuItemId !== 'airlock-scrub' || !tab?.id) return;
  // Open first: sidePanel.open must run inside the user gesture.
  chrome.sidePanel.open({ tabId: tab.id });
  let text: string = info.selectionText ?? '';
  try {
    // selectionText flattens newlines; read the real selection to keep log lines intact.
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
      func: () => String(getSelection() ?? ''),
    });
    if (res?.result) text = res.result;
  } catch {
    /* restricted page: fall back to selectionText */
  }
  await chrome.storage.session.set({ pending: { text, at: Date.now() } });
});
