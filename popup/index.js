let $input = document.querySelector('.input')
let $status = document.querySelector('.status')
let $results = document.querySelector('.results')
let items = []
let profiles = []
let validators = []
let filteredProfiles = []
let filteredValidators = []
let input = ''
let $items = []

init()

async function init() {
  $input.addEventListener('focus', $input.select)
  $input.addEventListener('input', search)
  updateStatus('Loading...')
  Promise.all([
    getProfiles().then(data => {
      profiles = data
      update()
    }),
    getValidators().then(data => {
      validators = data
      update()
    }),
    getInput().then(data => {
      $input.value = data
    })
  ]).then(search)
}

async function updateStatus(text) {
  const profilesCount = input ? `${filteredProfiles.length}/${profiles.length}` : (profiles.length || 'loading')
  const validatorsCount = input ? `${filteredValidators.length}/${validators.length}` : (validators.length || 'loading')
  $status.innerText = `${profilesCount} profiles, ${validatorsCount} validators`
}

function search() {
  input = $input.value.toLowerCase().replace(/^[@#]/, '')
  chrome.storage.local.set({minterSearch: input})
  const words = input.split(/\s+/)
  items.forEach(item => {
    item.matched = true
    words.forEach(word => {
      item.matched = item.matched && hasWordVariations(item, word)
    })
  })
  filteredProfiles = profiles.filter(profile => profile.matched && profile.hash[1] === 'x')
  filteredValidators = validators.filter(validator => validator.matched && validator.hash[1] === 'p')
  for (const i in items) {
    $items[i].className = `item ${items[i].matched ? 'matched' : 0}`
  }
  updateStatus()
  window.scroll(0, 0)
}

function update() {
  items = validators.concat(profiles)
  $results.innerHTML = items.map(result => {
    // const icon = result.icon.replace(/\/imgur\.com\/(.+)/i, "/i.imgur.com/$1.jpg")
    const title = result.title || 'Unnamed'
    const descriptionHTML = result.description ? `<div class="description"><small>${result.description}</small></div>` : ''
    const userLink = getLinkHTML(result.www)
    let serviceLinks = ''
    if (matchAddress(result.hash)) {
      serviceLinks = `
        <a href="https://explorer.minter.network/address/${result.hash}" target="_blank" title="https://explorer.minter.network/address/${result.hash}"><img class="link-img" src="/img/explorer_32.png" alt="explorer" /></a>
        <a href="https://minterscan.net/address/${result.hash}" target="_blank" title="https://minterscan.net/address/${result.hash}"><img class="link-img" src="/img/minterscan_32.png" alt="minterscan" /></a>
        <a href="https://minter.interchain.zone/en/wallet/${result.hash}" target="_blank" title="https://minter.interchain.zone/en/wallet/${result.hash}"><img class="link-img" src="/img/interchain_32.png" alt="interchain" /></a>
        <a href="https://karma.mn/#${result.hash}" target="_blank" title="https://karma.mn/#${result.hash}"><img class="link-img" src="/img/angel_32.png" alt="karma" /></a>
      `
    }
    if (matchValidator(result.hash)) {
      serviceLinks = `
        <a href="https://explorer.minter.network/validator/${result.hash}" target="_blank" title="https://explorer.minter.network/validator/${result.hash}"><img class="link-img" src="/img/explorer_32.png" alt="explorer" /></a>
        <a href="https://minterscan.net/validator/${result.hash}" target="_blank" title="https://minterscan.net/validator/${result.hash}"><img class="link-img" src="/img/minterscan_32.png" alt="minterscan" /></a>
        <a href="https://minter.interchain.zone/en/nodes/${result.hash}" target="_blank" title="https://minter.interchain.zone/en/nodes/${result.hash}"><img class="link-img" src="/img/interchain_32.png" alt="interchain" /></a>
      `
    }
    return `
      <div class="item matched">
        <div class="info">
          <div class="avatar" style="background-image: url('${result.icon}')"></div>
          <div class="header">
            <img class="type" src="../img/${result.isProfile ? 'profile' : 'server'}_32.png">
            <span class="links">
              ${userLink}
              ${serviceLinks}
            </span>
            <b class="title">${title}&nbsp;</b>
            <code class="hash">
              ${getShortHash(result.hash)}&nbsp;<span class="copy" data-hash="${result.hash}">copy</span>
            </code>
          </div>
        </div>
        ${descriptionHTML}
      </div>
    `
  }).join('')
  $items = document.querySelectorAll('.item')
  $items.forEach($item => {
    $item.querySelector('.copy').addEventListener('click', event => {
      copyTextToClipboard(event.target.dataset.hash)
      event.target.innerText = 'copied!'
      setTimeout(() => {
        event.target.innerText = 'copy'
      }, 1000)
    })
  })
  updateStatus()
}

async function getInput() {
  return new Promise(resolve => {
    chrome.storage.local.get(['minterSearch'], async data => {
      resolve(data.minterSearch || '')
    })
  })
}

async function getProfiles() {
  return new Promise(resolve => {
    chrome.storage.local.get(['minterProfiles', 'minterProfilesUpdated'], async data => {
      const updated = data.minterProfilesUpdated || 0
      const cached = data.minterProfiles || []
      const isUptodate = updated + 24 * 60 * 60 * 1000 > Date.now()
      const profiles = isUptodate ? cached : await fetchProfiles()
      resolve(profiles)
    })
  })
}

async function getValidators() {
  return new Promise(resolve => {
    chrome.storage.local.get(['minterValidators', 'minterValidatorsUpdated'], async data => {
      const updated = data.minterValidatorsUpdated || 0
      const cached = data.minterValidators || []
      const isUptodate = updated + 24 * 60 * 60 * 1000 > Date.now()
      const validators = isUptodate ? cached : await fetchValidators()
      resolve(validators)
    })
  })
}

async function fetchProfiles() {
  try {
    const profiles = await fetch(`https://minterscan.pro/profiles`).then(res => res.json()).then(items => {
      return items.map(item => {
        return {
          isProfile: true,
          isValidator: false,
          hash: item.address,
          icon: item.icons.webp,
          title: item.title,
          description: item.description,
          www: item.www,
          isVerified: item.isVerified,
        }
      })
    })
    chrome.storage.local.set({minterProfiles: profiles, minterProfilesUpdated: Date.now()})
    return profiles
  } catch (error) {
    console.warn(error)
    return []
  }
}

async function fetchValidators() {
  try {
    const validators = await fetch(`https://minterscan.pro/validators`).then(res => res.json()).then(items => {
      return items.filter(item => {
        return item.status === 2
      }).sort((item1, item2) => {
        return item2.rating - item1.rating
      }).map(item => {
        return {
          isProfile: false,
          isValidator: true,
          hash: item.pub_key,
          icon: item.meta.icon,
          title: item.meta.title,
          description: item.meta.description,
          www: item.meta.www,
          owner: item.owner_address,
          rating: item.rating,
        }
      })
    })
    chrome.storage.local.set({minterValidators: validators, minterValidatorsUpdated: Date.now()})
    return validators
  } catch (error) {
    console.warn(error)
    return []
  }
}

function hasWordVariations(item, word) {
  if (!item) {
    return false
  }
  const raw = hasWord(item, word)
  const ruLayout = hasWord(item, convertRuLayout(word))
  const enLayout = hasWord(item, convertEnLayout(word))
  const transliteratedRu = hasWord(item, transliterateRu(word))
  const transliteratedEn = hasWord(item, transliterateEn(word))
  return raw || ruLayout || enLayout || transliteratedRu || transliteratedEn
}

function hasWord(item, word) {
  if (!item) {
    return false
  }
  const address = item.hash.toLowerCase().includes(word)
  const description = item.description.toLowerCase().includes(word)
  const title = item.title.toLowerCase().includes(word)
  const www = item.www.toLowerCase().includes(word)
  return address || description || title || www
}

function getLinkHTML(url) {
  if (!url) {
    return ''
  }
  const telegram = matchTelegram(url)
  const vkontakte = matchVkontakte(url)
  const facebook = matchFacebook(url)
  const twitter = matchTwitter(url)
  if (telegram) {
    return `<a href="https://t.me/${telegram}" target="_blank" title="https://t.me/${telegram}"><img class="link-img" src="../img/telegram_32.png"></a>`
  } else if (vkontakte) {
    return `<a href="https://vk.com/${vkontakte}" target="_blank" title="https://vk.com/${vkontakte}"><img class="link-img" src="../img/vkontakte_32.png"></a>`
  } else if (facebook) {
    return `<a href="https://facebook.com/${facebook}" target="_blank" title="https://facebook.com/${facebook}"><img class="link-img" src="../img/facebook_32.png"></a>`
  } else if (twitter) {
    return `<a href="https://twitter.com/${twitter}" target="_blank" title="https://twitter.com/${twitter}"><img class="link-img" src="../img/twitter_32.png"></a>`
  }
  return `<a href="${url}" target="_blank" title="${url}"><img class="link-img" src="../img/www_32.png"></a>`
}

function getShortHash(hash) {
  return hash.slice(0, 7) + '...' + hash.slice(-5)
}

function matchTwitter(value) {
  return value && (value.match(/twitter\.com\/([^/\s]+)/i) || [])[1];
}
function matchFacebook(value) {
  return value && (value.match(/twitter\.com\/([^/\s]+)/i) || [])[1];
}
function matchVkontakte(value) {
  return value && (value.match(/vk\.com\/([^/\s]+)/i) || [])[1];
}
function matchTelegram(value) {
  return value && (value.match(/(?:(?:t(?:elegram)?\.me\/)|@)([a-z0-9_]{5,32})/i) || [])[1];
}
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

function transliterateRu(text) {
  return text
    .replace(/\u0430/ig, 'a') // а
    .replace(/\u0431/ig, 'b') // б
    .replace(/\u0432/ig, 'v') // в
    .replace(/\u0433/ig, 'g') // г
    .replace(/\u0434/ig, 'd') // д
    .replace(/\u0435/ig, 'e') // е
    .replace(/\u0436/ig, 'zh') // ж
    .replace(/\u0437/ig, 'z') // з
    .replace(/\u0438/ig, 'i') // и
    .replace(/\u0439/ig, 'i') // й
    .replace(/\u043A/ig, 'k') // к
    .replace(/\u043B/ig, 'l') // л
    .replace(/\u043C/ig, 'm') // м
    .replace(/\u043D/ig, 'n') // н
    .replace(/\u043E/ig, 'o') // о
    .replace(/\u043F/ig, 'p') // п
    .replace(/\u0440/ig, 'r') // р
    .replace(/\u0441/ig, 's') // с
    .replace(/\u0442/ig, 't') // т
    .replace(/\u0443/ig, 'u') // у
    .replace(/\u0444/ig, 'f') // ф
    .replace(/\u0445/ig, 'h') // х
    .replace(/\u0446/ig, 'ts') // ц
    .replace(/\u0447/ig, 'ch') // ч
    .replace(/\u0448/ig, 'sh') // ш
    .replace(/\u0449/ig, 'sch') // щ
    .replace(/\u044A/ig, "'") // ъ
    .replace(/\u044B/ig, 'i') // ы
    .replace(/\u044C/ig, "'") // ь
    .replace(/\u044D/ig, 'e') // э
    .replace(/\u044E/ig, 'yu') // ю
    .replace(/\u044F/ig, 'ya') // я
    .replace(/\u0451/ig, 'yo') // ё
}

function transliterateEn(text) {
  return text
    .replace(/sch/ig, '\u0449') // щ
    .replace(/sh/ig, '\u0448') // ш
    .replace(/ts/ig, '\u0446') // ц
    .replace(/yo/ig, '\u0451') // ё
    .replace(/zh/ig, '\u0436') // ж
    .replace(/yu/ig, '\u044E') // ю
    .replace(/ya/ig, '\u044F') // я
    .replace(/ch/ig, '\u0447') // ч
    .replace(/a/ig, '\u0430') // а
    .replace(/b/ig, '\u0431') // б
    .replace(/d/ig, '\u0434') // д
    .replace(/e/ig, '\u0435') // е
    .replace(/e/ig, '\u044D') // э
    .replace(/f/ig, '\u0444') // ф
    .replace(/g/ig, '\u0433') // г
    .replace(/h/ig, '\u0445') // х
    .replace(/i/ig, '\u0438') // и
    .replace(/i/ig, '\u0439') // й
    .replace(/i/ig, '\u044B') // ы
    .replace(/k/ig, '\u043A') // к
    .replace(/l/ig, '\u043B') // л
    .replace(/m/ig, '\u043C') // м
    .replace(/n/ig, '\u043D') // н
    .replace(/o/ig, '\u043E') // о
    .replace(/p/ig, '\u043F') // п
    .replace(/r/ig, '\u0440') // р
    .replace(/s/ig, '\u0441') // с
    .replace(/t/ig, '\u0442') // т
    .replace(/u/ig, '\u0443') // у
    .replace(/v/ig, '\u0432') // в
    .replace(/z/ig, '\u0437') // з
    .replace(/\'/ig, '\u044C') // ь
}

function convertRuLayout(text) {
  return text
    .replace(/\u0451/ig, '~') // ё
    .replace(/\u0439/ig, 'q') // й
    .replace(/\u0446/ig, 'w') // ц
    .replace(/\u0443/ig, 'e') // у
    .replace(/\u043A/ig, 'r') // к
    .replace(/\u0435/ig, 't') // е
    .replace(/\u043D/ig, 'y') // н
    .replace(/\u0433/ig, 'u') // г
    .replace(/\u0448/ig, 'i') // ш
    .replace(/\u0449/ig, 'o') // щ
    .replace(/\u0437/ig, 'p') // з
    .replace(/\u0445/ig, '[') // х
    .replace(/\u044A/ig, "]") // ъ
    .replace(/\u0444/ig, 'a') // ф
    .replace(/\u044B/ig, 's') // ы
    .replace(/\u0432/ig, 'd') // в
    .replace(/\u0430/ig, 'f') // а
    .replace(/\u043F/ig, 'g') // п
    .replace(/\u0440/ig, 'h') // р
    .replace(/\u043E/ig, 'j') // о
    .replace(/\u043B/ig, 'k') // л
    .replace(/\u0434/ig, 'l') // д
    .replace(/\u0436/ig, ';') // ж
    .replace(/\u044D/ig, '\'') // э
    .replace(/\u044F/ig, 'z') // я
    .replace(/\u0447/ig, 'x') // ч
    .replace(/\u0441/ig, 'c') // с
    .replace(/\u043C/ig, 'v') // м
    .replace(/\u0438/ig, 'b') // и
    .replace(/\u0442/ig, 'n') // т
    .replace(/\u044C/ig, "m") // ь
    .replace(/\u0431/ig, ',') // б
    .replace(/\u044E/ig, '.') // ю
    .replace(/\./g, '/') // ю
}

function convertEnLayout(text) {
  return text
    .replace(/~/ig, '\u0451') // ё
    .replace(/q/ig, '\u0439') // й
    .replace(/w/ig, '\u0446') // ц
    .replace(/e/ig, '\u0443') // у
    .replace(/r/ig, '\u043A') // к
    .replace(/t/ig, '\u0435') // е
    .replace(/y/ig, '\u043D') // н
    .replace(/u/ig, '\u0433') // г
    .replace(/i/ig, '\u0448') // ш
    .replace(/o/ig, '\u0449') // щ
    .replace(/p/ig, '\u0437') // з
    .replace(/\[/ig, '\u0445') // х
    .replace(/\]/ig, '\u044A') // ъ
    .replace(/a/ig, '\u0444') // ф
    .replace(/s/ig, '\u044B') // ы
    .replace(/d/ig, '\u0432') // в
    .replace(/f/ig, '\u0430') // а
    .replace(/g/ig, '\u043F') // п
    .replace(/h/ig, '\u0440') // р
    .replace(/j/ig, '\u043E') // о
    .replace(/k/ig, '\u043B') // л
    .replace(/l/ig, '\u0434') // д
    .replace(/\;/ig, '\u0436') // ж
    .replace(/\'/ig, '\u044D') // э
    .replace(/z/ig, '\u044F') // я
    .replace(/x/ig, '\u0447') // ч
    .replace(/c/ig, '\u0441') // с
    .replace(/v/ig, '\u043C') // м
    .replace(/b/ig, '\u0438') // и
    .replace(/n/ig, '\u0442') // т
    .replace(/m/ig, '\u044C') // ь
    .replace(/\,/ig, '\u0431') // б
    .replace(/\./ig, '\u044E') // ю
}

function copyTextToClipboard(text) {
  const $copyFrom = document.createElement('textarea')
  $copyFrom.textContent = text
  document.body.appendChild($copyFrom)
  $copyFrom.select()
  document.execCommand('copy')
  $copyFrom.blur()
  document.body.removeChild($copyFrom)
}
