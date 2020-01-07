const app = typeof chrome === 'undefined' ? browser : chrome
const version = '0.3.6.2'
const cacheTime = 24 * 60 * 60 * 1000

const $input = document.querySelector('.input')
const $status = document.querySelector('.status')
const $errors = document.querySelector('.errors')
const $validators = document.querySelector('.validators')
const $profiles = document.querySelector('.profiles')
const $update = document.querySelector('.update')

let items = []
let $items = []
let fetchingProfiles = false
let fetchingValidators = false
let input = ''

const throttledLazyLoad = throttle(lazyLoad, 100)
const debouncedSearch = debounce(search, 300)

init()

async function init() {
  window.addEventListener('scroll', throttledLazyLoad)
  $input.addEventListener('input', debouncedSearch)
  $input.addEventListener('focus', $input.select)
  $update.addEventListener('click', fetchItems)

  input = await getInput()
  $input.value = input
  $input.readOnly = false
  $input.placeholder = 'Search'
  $input.select()

  updateItems()
}

function getFromStorage(fields = []) {
  return new Promise(resolve => app.storage.local.get(fields, resolve))
}

function saveToStorage(object = {}) {
  return new Promise(resolve => app.storage.local.set(object, resolve))
}

async function fetchItems() {
  await saveToStorage({minterProfilesUpdated: 0, minterValidatorsUpdated: 0})
  removeEventListeners()
  $errors.innerHTML = ''
  $validators.innerHTML = ''
  $profiles.innerHTML = ''
  items = []
  updateItems()
}

function updateItems() {
  Promise.all([
    getValidators().then(validators => {
      $validators.innerHTML = getItemsHTML(validators)
      $items = document.querySelectorAll('.item')
      items = validators.concat(items)
      drawStatus()
      throttledLazyLoad()
    }),
    getProfiles().then(profiles => {
      $profiles.innerHTML = getItemsHTML(profiles)
      $items = document.querySelectorAll('.item')
      items = items.concat(profiles)
      drawStatus()
      throttledLazyLoad()
    })
  ])
}

function search() {
  input = $input.value.toLowerCase().replace(/^[@#]/, '')
  saveToStorage({minterSearch: input})
  $items.forEach(($item, index) => {
    if (isItemMatched(items[index])) {
      $item.classList.add('matched')
    } else {
      $item.classList.remove('matched')
    }
  })
  window.scroll(0, 0)
  drawStatus()
  throttledLazyLoad()
}

function drawStatus() {
  const profilesCount = document.querySelectorAll('.profile').length
  const validatorsCount = document.querySelectorAll('.validator').length
  const matchedProfilesCount = document.querySelectorAll('.profile.matched').length
  const matchedValidatorsCount = document.querySelectorAll('.validator.matched').length
  const profilesStatus = fetchingProfiles ? '<img class="spinner" src="../img/loading_16.gif" alt="" /> loading' : (input ? `${matchedProfilesCount}/${profilesCount}` : profilesCount)
  const validatorsStatus = fetchingValidators ? '<img class="spinner" src="../img/loading_16.gif" alt="" /> loading' : (input ? `${matchedValidatorsCount}/${validatorsCount}` : validatorsCount)
  $status.innerHTML = `${profilesStatus} profiles, ${validatorsStatus} validators`
}

function removeEventListeners($parent = document) {
  $parent.querySelectorAll('.copy').forEach($copyButton => {
    $copyButton.removeEventListener('click', copy)
  })
  $parent.querySelectorAll('.avatar').forEach($avatar => {
    $avatar.removeEventListener('error', repairAvatar)
    $avatar.removeEventListener('click', loadAvatar)
  })
}

function lazyLoad() {
  items.forEach((item, index) => {
    const $item = $items[index]
    if ($item.classList.contains('matched') && !$item.dataset.loaded) {
      if ($item.offsetTop < window.innerHeight + window.pageYOffset + 300 && $item.offsetTop > window.pageYOffset - 300) {
        $item.innerHTML = getItemContentHTML(item)
        const $copyButton = $item.querySelector('.copy')
        const $avatar = $item.querySelector('.avatar')
        $copyButton.addEventListener('click', copy)
        $avatar.addEventListener('error', repairAvatar)
        $avatar.addEventListener('click', loadAvatar)
        $item.dataset.loaded = true
        setTimeout(loadAvatar.bind($avatar), 100)
      }
    }
  })
}

function repairAvatar() {
  this.src = '../img/error_32.png'
}

function loadAvatar() {
  let cache = ''
  if (this.dataset.loaded) {
    cache = `?${Date.now()}`
    this.src = '../img/loading_32.gif'
  }
  setTimeout(() => {
    this.src = this.dataset.src + cache
    this.dataset.loaded = true
  }, 100)
}

function copy() {
  const $copyFrom = document.createElement('textarea')
  $copyFrom.textContent = this.dataset.hash
  document.body.appendChild($copyFrom)
  $copyFrom.select()
  document.execCommand('copy')
  $copyFrom.blur()
  document.body.removeChild($copyFrom)
  this.innerText = 'copied!'
  setTimeout(() => {
    this.innerText = 'copy'
  }, 1000)
}

async function getInput() {
  const data = await getFromStorage(['minterSearch'])
  return data.minterSearch || ''
}

async function getProfiles() {
  const data = await getFromStorage(['minterProfiles', 'minterProfilesUpdated', 'minterVersion'])
  const updateTime = data.minterProfilesUpdated || 0
  const cacheVersion = data.minterVersion || '0'
  const cachedItems = data.minterProfiles || []
  const isExpired = updateTime + cacheTime < Date.now()
  const isUpdated = cacheVersion === version
  const hasItems = cachedItems.length
  return isUpdated && !isExpired && hasItems ? cachedItems : await fetchProfiles()
}

async function getValidators() {
  const data = await getFromStorage(['minterValidators', 'minterValidatorsUpdated', 'minterVersion'])
  const updateTime = data.minterValidatorsUpdated || 0
  const cacheVersion = data.minterVersion || '0'
  const cachedItems = data.minterValidators || []
  const isExpired = updateTime + cacheTime < Date.now()
  const isUpdated = cacheVersion === version
  const hasItems = cachedItems.length
  return isUpdated && !isExpired && hasItems ? cachedItems : await fetchValidators()
}

async function fetchProfiles() {
  fetchingProfiles = true
  drawStatus()
  let profiles = []
  try {
    const data = await fetch('https://minterscan.pro/profiles').then(response => response.json())
    try {
      profiles = data.filter(filterProfile).sort(sortProfile).map(parseProfile)
      saveToStorage({minterVersion: version, minterProfiles: profiles, minterProfilesUpdated: Date.now()})
    } catch (error) {
      console.warn(error);
      $errors.innerHTML += `<div class="error"><b>Extension error</b><br>Can't parse the list of profiles from Minterscan. Check if the extension is up to date and try to update the data again.</div>`
    }
  } catch (error) {
    console.warn(error);
    $errors.innerHTML += `<div class="error"><b>Network error</b><br>Can't download the list of profiles from Minterscan.<br>Try to update the data again.</div>`
  }
  fetchingProfiles = false
  drawStatus()
  return profiles
}

async function fetchValidators() {
  fetchingValidators = true
  drawStatus()
  let validators = []
  try {
    const data = await fetch('https://minterscan.pro/validators').then(response => response.json())
    try {
      validators = data.filter(filterValidator).sort(sortValidator).map(parseValidator)
      saveToStorage({minterVersion: version, minterValidators: validators, minterValidatorsUpdated: Date.now()})
    } catch (error) {
      console.warn(error);
      $errors.innerHTML += `<div class="error"><b>Extension error</b><br>Can't parse the list of validators from Minterscan. Check if the extension is up to date and try to update the data again.</div>`
    }
  } catch (error) {
    console.warn(error);
    $errors.innerHTML += `<div class="error"><b>Network error</b><br>Can't download the list of validators from Minterscan.<br>Try to update the data again.</div>`
  }
  fetchingValidators = false
  drawStatus()
  return validators
}

function filterValidator(item) {
  return item.status === 2 && item.meta && item.meta.title
}

function filterProfile(item) {
  return item.title
}

function sortValidator(item1, item2) {
  return item2.rating - item1.rating
}
function sortProfile(item1, item2) {
  return item1.title.localeCompare(item2.title)
}

function parseValidator(validator) {
  return {
    type: 'validator',
    hash: validator.pub_key,
    icon: validator.meta.icon ? validator.meta.icon : null,
    title: validator.meta.title,
    description: validator.meta.description,
    www: validator.meta.www,
    rating: validator.rating,
  }
}

function parseProfile(profile) {
  return {
    type: 'profile',
    hash: profile.address,
    icon: profile.icon ? profile.icon : null,
    title: profile.title,
    description: profile.description,
    www: profile.www,
    isVerified: profile.isVerified,
  }
}

function isItemMatched(item) {
  const words = input.split(/\s+/)
  let matched = true
  words.forEach(word => {
    matched = matched && hasWordVariations(item, word)
  })
  return matched
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
  const address = item.hash && item.hash.toLowerCase().includes(word)
  const description = item.description && item.description.toLowerCase().includes(word)
  const title = item.title && item.title.toLowerCase().includes(word)
  const www = item.www && item.www.toLowerCase().includes(word)
  return address || description || title || www
}

function getItemsHTML(items) {
  return items.map(item => `<div class="item ${item.type} ${isItemMatched(item) ? 'matched' : ''}"></div>`).join('')
}

function getItemContentHTML(item) {
  const {hash, icon, title, description, www, isVerified, type} = item
  const avatarHTML = `<img class="avatar" width="32" height="32" src="../img/loading_32.gif" data-src="${icon || '../img/empty_32.png'}" alt="" />`
  const verifiedHTML = isVerified ? '<img class="verified" src="../img/verified_32.png" alt="" title="Verified by Minterscan" />' : ''
  const shortHash = hash.slice(0, 7) + '...' + hash.slice(-5)
  const titleHTML = sanitizeHTML(title) || `Unnamed ${type}`
  const descriptionHTML = description ? `<small class="description">${sanitizeHTML(description)}</small>` : ''
  return `
    <div class="info">
      ${avatarHTML}
      ${verifiedHTML}
      <div class="header">
        <span class="type"></span>
        <span class="links">
          ${getWebLinkHTML(www)}
          ${getExplorerLinkHTML(item)}
          ${getMinterscanLinkHTML(item)}
          ${getInterchainLinkHTML(item)}
          ${getKarmaLinkHTML(item)}
        </span>
        <div class="title">${titleHTML}</div>
        <code class="hash" title="${hash}">
          ${shortHash}&nbsp;
          <span class="copy" data-hash="${hash}">copy</span>
        </code>
      </div>
    </div>
    ${descriptionHTML}
  `
}

function getWebLinkHTML(link) {
  const telegram = getTelegramName(link)
  const vkontakte = getVkontakteName(link)
  const facebook = getFacebookName(link)
  const twitter = getTwitterName(link)
  let type = 'web'
  if (telegram) {
    type = 'telegram'
    link = `https://t.me/${telegram}`
  } else if (vkontakte) {
    type = 'vkontakte'
    link = `https://vk.com/${vkontakte}`
  } else if (facebook) {
    type = 'facebook'
    link = `https://facebook.com/${facebook}`
  } else if (twitter) {
    type = 'twitter'
    link = `https://twitter.com/${twitter}`
  }
  return `<a class="link ${type}" href="${link}" target="_blank" title="${link}"></a>`
}

function getExplorerLinkHTML(item) {
  const path = item.type === 'validator' ? 'validator' : 'address'
  const link = `https://explorer.minter.network/${path}/${item.hash}`
  return `<a class="link explorer" href="${link}" target="_blank" title="${link}"></a>`
}
function getMinterscanLinkHTML(item) {
  const path = item.type === 'validator' ? 'validator' : 'address'
  const link = `https://minterscan.net/${path}/${item.hash}`
  return `<a class="link minterscan" href="${link}" target="_blank" title="${link}"></a>`
}
function getInterchainLinkHTML(item) {
  const path = item.type === 'validator' ? 'nodes' : 'wallet'
  const link = `https://minter.interchain.zone/en/${path}/${item.hash}`
  return `<a class="link interchain" href="${link}" target="_blank" title="${link}"></a>`
}
function getKarmaLinkHTML(item) {
  const link = `https://karma.mn/#${item.hash}`
  return item.type === 'profile' ? `<a class="link karma" href="${link}" target="_blank" title="${link}"></a>` : ''
}

function getTelegramName(value) {
  return value && (value.match(/(?:(?:t(?:elegram)?\.me\/)|@)([a-z0-9_]{5,32})/i) || [])[1];
}
function getVkontakteName(value) {
  return value && (value.match(/vk\.com\/([^/\s]+)/i) || [])[1];
}
function getFacebookName(value) {
  return value && (value.match(/twitter\.com\/([^/\s]+)/i) || [])[1];
}
function getTwitterName(value) {
  return value && (value.match(/twitter\.com\/([^/\s]+)/i) || [])[1];
}

function sanitizeHTML(html) {
	const temp = document.createElement('div')
	temp.textContent = html
	return temp.innerHTML
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

function debounce(fn, time) {
  let timeout
  return function() {
    const functionCall = () => fn.apply(this, arguments)
    clearTimeout(timeout)
    timeout = setTimeout(functionCall, time)
  }
}

function throttle(callback, wait, immediate = false) {
  let timeout = null
  let initialCall = true
  return function() {
    const callNow = immediate && initialCall
    const next = () => {
      callback.apply(this, arguments)
      timeout = null
    }
    if (callNow) {
      initialCall = false
      next()
    }
    if (!timeout) {
      timeout = setTimeout(next, wait)
    }
  }
}
