const app = typeof chrome === 'undefined' ? browser : chrome

app.runtime.onInstalled.addListener(function() {
  app.contextMenus.create({
    title: "Minter shortcuts",
    type: "separator",
    id: 'sep1',
    contexts: ['all']
  });
  app.contextMenus.create({
    title: 'Search on Minter Explorer',
    id: 'explorer',
    contexts: ['all']
  });
  app.contextMenus.create({
    title: 'Search on Minterscan',
    id: 'mscan',
    contexts: ['all']
  });
  app.contextMenus.create({
    title: 'Search on Interchain.Zone',
    id: 'interchain',
    contexts: ['all']
  });
  app.contextMenus.create({
    title: 'Check address reputation',
    id: 'karma',
    contexts: ['all']
  });
});

app.contextMenus.onClicked.addListener(function(data) {
  var menuItemId = data.menuItemId;
  var text = data.linkUrl || data.selectionText
  var address = matchAddress(text);
  var validator = matchValidator(text);
  var transaction = matchTransaction(text);
  var coin = matchCoin(text);
  var url = '';
  // console.log('Input', {data, address, validator, transaction, coin});
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
    app.tabs.create({url})
  } else {
    // console.log('Invalid input!', {address, validator, transaction, coin});
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
