// background.js
importScripts("utils/classifier.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CLASSIFY_TEXT") {
    classifyText(message.text).then(result => {
      sendResponse(result);
    }).catch(err => {
      console.error("Classification error:", err);
      sendResponse({ labels: [] });
    });
    return true; // keeps the message channel open for async
  }
});
