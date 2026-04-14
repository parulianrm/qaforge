// Relay pesan antara popup dan content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'GET_ACTIVE_TAB') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            sendResponse({ tabId: tabs[0]?.id, url: tabs[0]?.url })
        })
        return true
    }
})