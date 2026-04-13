chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== "openFullReport") {
    return;
  }

  const reportUrl = chrome.runtime.getURL("popup.html");

  chrome.tabs.create({ url: reportUrl }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error("[FloodScore][background] Failed to open full report tab", {
        error: chrome.runtime.lastError.message,
        sender
      });
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }

    sendResponse({ ok: true, tabId: tab?.id ?? null });
  });

  return true;
});
