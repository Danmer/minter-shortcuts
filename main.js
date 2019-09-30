chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    title: "Minter shortcuts",
    type: "separator",
    id: 'sep1',
    contexts: ['all']
  });
  chrome.contextMenus.create({
    title: 'Explorer',
    id: 'explorer',
    contexts: ['all']
  });
  chrome.contextMenus.create({
    title: 'Minterscan',
    id: 'mscan',
    contexts: ['all']
  });
  chrome.contextMenus.create({
    title: 'Interchain',
    id: 'interchain',
    contexts: ['all']
  });
  chrome.contextMenus.create({
    title: 'Karma',
    id: 'karma',
    contexts: ['all']
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
  console.log('Input', {data, address, validator, transaction, coin});
  if (menuItemId === 'explorer') {
    if (transaction) {
      url = 'https://explorer.minter.network/transactions/' + transaction;
    } else if (validator) {
      url = 'https://explorer.minter.network/validator/' + validator;
    } else if (address) {
      url = 'https://explorer.minter.network/address/' + address;
    } else {
      url = 'https://explorer.minter.network'
    }
  }
  if (menuItemId === 'mscan') {
    if (transaction) {
      url = 'https://minterscan.net/tx/' + transaction;
    } else if (validator) {
      url = 'https://minterscan.net/validator/' + validator;
    } else if (address) {
      url = 'https://minterscan.net/address/' + address;
    } else {
      url = 'https://minterscan.net'
    }
  }
  if (menuItemId === 'interchain') {
    if (validator) {
      url = 'https://minter.interchain.zone/en/nodes/' + validator;
    } else if (address) {
      url = 'https://minter.interchain.zone/en/wallet/' + address;
    } else if (coin) {
      url = 'https://minter.interchain.zone/en/coin/' + coin;
    } else {
      url = 'https://minter.interchain.zone'
    }
  }
  if (menuItemId === 'karma') {
    if (address) {
      url = 'https://karma.mn/#' + address;
    } else {
      url = 'https://karma.mn'
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
