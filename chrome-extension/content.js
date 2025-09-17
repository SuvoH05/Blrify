function scanAndProcess() {
  const tweets = document.querySelectorAll("article div[data-testid='tweetText']");
  
  tweets.forEach(tweetNode => {
    if (tweetNode.dataset.processed) return; // prevent reprocessing
    tweetNode.dataset.processed = "true";

    const text = tweetNode.innerText;
    if (!text || text.trim().length < 3) return;

    // Send text to background for classification
    chrome.runtime.sendMessage({ type: "CLASSIFY_TEXT", text }, response => {
      if (!response || !response.labels) return;

      const flagged = response.labels.find(l => l.score >= 0.75); // adjust threshold

      if (flagged) {
        blurElement(tweetNode.closest("article"), flagged.label, flagged.score);
      }
    });
  });
}

// Run once and observe for new tweets
scanAndProcess();
const observer = new MutationObserver(scanAndProcess);
observer.observe(document.body, { childList: true, subtree: true });
