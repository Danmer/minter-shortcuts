chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    title: "Minter tools",
    type: "separator",
    id: 'sep1',
    contexts: ['all']
  });
  chrome.contextMenus.create({
    title: 'Open on Explorer',
    id: 'explorer',
    contexts: ['link', 'selection'],
    targetUrlPatterns: ["*://*/*Mx*", "*://*/*Mp*", "*://*/*Mt*"]
  });
  chrome.contextMenus.create({
    title: 'Open on Minterscan',
    id: 'mscan',
    contexts: ['link', 'selection'],
    targetUrlPatterns: ["*://*/*Mx*", "*://*/*Mp*", "*://*/*Mt*"]
  });
  chrome.contextMenus.create({
    title: 'Open on Interchain',
    id: 'interchain',
    contexts: ['link', 'selection'],
    targetUrlPatterns: ["*://*/*Mx*", "*://*/*Mp*"]
  });
  chrome.contextMenus.create({
    title: 'Check KARMA',
    id: 'karma',
    contexts: ['link', 'selection'],
    targetUrlPatterns: ["*://*/*Mx*"]
  });
});

chrome.contextMenus.onClicked.addListener(function(data) {
  var menuItemId = data.menuItemId;
  var text = data.linkUrl || data.selectionText
  var address = matchAddress(text);
  var validator = matchValidator(text);
  var transaction = matchTransaction(text);
  var coin = matchCoin(text);
  var url = '';
  if (menuItemId === 'explorer') {
    if (transaction) {
      url = 'https://explorer.minter.network/transactions/' + transaction;
    } else if (validator) {
      url = 'https://explorer.minter.network/validator/' + validator;
    } else if (address) {
      url = 'https://explorer.minter.network/address/' + address;
    }
  }
  if (menuItemId === 'mscan') {
    if (transaction) {
      url = 'https://minterscan.net/tx/' + transaction;
    } else if (validator) {
      url = 'https://minterscan.net/validator/' + validator;
    } else if (address) {
      url = 'https://minterscan.net/address/' + address;
    }
  }
  if (menuItemId === 'interchain') {
    if (validator) {
      url = 'https://minter.interchain.zone/en/nodes/' + validator;
    } else if (address) {
      url = 'https://minter.interchain.zone/en/wallet/' + address;
    } else if (coin) {
      url = 'https://minter.interchain.zone/en/coin/' + coin;
    }
  }
  if (menuItemId === 'karma') {
    if (address) {
      url = 'https://karma.mn/#' + address;
    }
  }
  if (url) {
    chrome.tabs.create({url})
  } else {
    console.log('Invalid input!', {address, validator, transaction, coin});
  }
});

function matchAddress(value) {
  return value && (value.match(/(Mx[a-z0-9]{40})/i) || [])[1];
}
function matchValidator(value) {
  return value && (value.match(/(Mp[a-z0-9]{64})/i) || [])[1];
}
function matchTransaction(value) {
  return value && (value.match(/(Mt[a-z0-9]{64})/i) || [])[1];
}
function matchCoin(value) {
  return value && (value.match(/([A-Z0-9]{3,10})/) || [])[1];
}
