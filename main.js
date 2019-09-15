chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    title: 'Check it on karma.mn',
    id: 'check reputation',
    contexts: ['link'],
    targetUrlPatterns: ["*://*/*Mx*"]
  });
});

chrome.contextMenus.onClicked.addListener(function(event) {
  var match = event.linkUrl.match(/(Mx[a-z0-9]{40})/)
  if (match) {
    chrome.tabs.create({url: 'https://karma.mn/#' + match[1]});
  }
});