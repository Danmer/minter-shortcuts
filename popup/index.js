const app = typeof chrome === 'undefined' ? browser : chrome

let $input = document.querySelector('.input')
let $status = document.querySelector('.status')
let $errors = document.querySelector('.errors')
let $validators = document.querySelector('.validators')
let $profiles = document.querySelector('.profiles')
let $update = document.querySelector('.update')

let items = []
let $items = []
let $avatars = []
let profiles = []
let validators = []
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

function fetchItems() {
  app.storage.local.set({minterProfilesUpdated: 0, minterValidatorsUpdated: 0}, () => {
    updateItems()
  })
}

function updateItems() {
  $errors.innerHTML = ''
  items = []
  profiles = []
  validators = []
  Promise.all([
    getValidators().then(data => {
      validators = data
      items = validators.concat(items)
      matchItems()
      drawValidators()
    }),
    getProfiles().then(data => {
      profiles = data
      items = items.concat(profiles)
      matchItems()
      drawProfiles()
    }),
  ])
}

function search() {
  input = $input.value.toLowerCase().replace(/^[@#]/, '')
  app.storage.local.set({minterSearch: input})
  matchItems()
  items.forEach(($item, index) => {
    $items[index].classList[items[index].matched ? 'add' : 'remove']('matched')
  })
  window.scroll(0, 0)
  throttledLazyLoad()
}

function drawStatus() {
  const matchedProfiles = profiles.filter(profile => profile.matched)
  const matchedValidators = validators.filter(validator => validator.matched)
  const profilesCount = fetchingProfiles ? '<img class="spinner" src="../img/loading_16.gif" alt="" /> loading' : (input ? `${matchedProfiles.length}/${profiles.length}` : profiles.length)
  const validatorsCount = fetchingValidators ? '<img class="spinner" src="../img/loading_16.gif" alt="" /> loading' : (input ? `${matchedValidators.length}/${validators.length}` : validators.length)
  $status.innerHTML = `${profilesCount} profiles, ${validatorsCount} validators`
}

function drawValidators() {
  $validators.innerHTML = validators.map(getItemHTML).join('')
  $items = document.querySelectorAll('.item')
  $avatars = document.querySelectorAll('.avatar')
  $validators.querySelectorAll('.copy').forEach($copy => $copy.onclick = copy)
  $validators.querySelectorAll('.avatar').forEach($avatar => $avatar.onerror = repairAvatar)
  $validators.querySelectorAll('.avatar').forEach($avatar => $avatar.onclick = reloadAvatar)
  throttledLazyLoad()
}

function drawProfiles() {
  $profiles.innerHTML = profiles.map(getItemHTML).join('')
  $items = document.querySelectorAll('.item')
  $avatars = document.querySelectorAll('.avatar')
  $profiles.querySelectorAll('.copy').forEach($copy => $copy.onclick = copy)
  $profiles.querySelectorAll('.avatar').forEach($avatar => $avatar.onerror = repairAvatar)
  $profiles.querySelectorAll('.avatar').forEach($avatar => $avatar.onclick = reloadAvatar)
  throttledLazyLoad()
}

function lazyLoad() {
  items.forEach((item, index) => {
    if (item.matched && !$avatars[index].dataset.loaded && $items[index].offsetTop < window.innerHeight + window.pageYOffset + 300 && $items[index].offsetTop > window.pageYOffset - 300) {
      $avatars[index].src = $avatars[index].dataset.src
      $avatars[index].dataset.loaded = true
    }
  })
}

function repairAvatar() {
  this.src = '../img/error_32.png'
}
function reloadAvatar() {
  this.src = '../img/loading_32.gif'
  setTimeout(() => {
    this.src = this.dataset.src + '?' + Date.now()
  }, 500)
}

function copy(event) {
  const $copyFrom = document.createElement('textarea')
  $copyFrom.textContent = event.target.dataset.hash
  document.body.appendChild($copyFrom)
  $copyFrom.select()
  document.execCommand('copy')
  $copyFrom.blur()
  document.body.removeChild($copyFrom)
  event.target.innerText = 'copied!'
  setTimeout(() => {
    event.target.innerText = 'copy'
  }, 1000)
}

async function getInput() {
  return new Promise(resolve => {
    app.storage.local.get(['minterSearch'], data => {
      resolve(data.minterSearch || '')
    })
  })
}

async function getProfiles() {
  return new Promise(resolve => {
    app.storage.local.get(['minterProfiles', 'minterProfilesUpdated'], async data => {
      const updated = data.minterProfilesUpdated || 0
      const cached = data.minterProfiles || []
      const isUptodate = updated + 24 * 60 * 60 * 1000 > Date.now()
      const profiles = isUptodate && cached.length ? cached : await fetchProfiles()
      resolve(profiles)
    })
  })
}

async function getValidators() {
  return new Promise(resolve => {
    app.storage.local.get(['minterValidators', 'minterValidatorsUpdated'], async data => {
      const updated = data.minterValidatorsUpdated || 0
      const cached = data.minterValidators || []
      const isUptodate = updated + 24 * 60 * 60 * 1000 > Date.now()
      const validators = isUptodate && cached.length ? cached : await fetchValidators()
      resolve(validators)
    })
  })
}

async function fetchProfiles() {
  try {
    fetchingProfiles = true
    drawStatus()
    const profiles = await fetch(`https://minterscan.pro/profiles`).then(res => res.json()).then(items => {
      return items.map(item => {
        return {
          isProfile: true,
          isValidator: false,
          hash: item.address,
          icon: item.icon ? item.icons.webp : null,
          title: item.title,
          titleHTML: item.title ? sanitize(item.title) : null,
          description: item.description,
          descriptionHTML: item.description ? sanitize(item.description) : null,
          www: item.www,
          isVerified: item.isVerified,
        }
      })
    })
    app.storage.local.set({minterProfiles: profiles, minterProfilesUpdated: Date.now()})
    return profiles
  } catch (error) {
    console.warn(error)
    $errors.innerHTML += `<div class="error"><b>Error while fetching profiles</b><br>${error}</div>`
    return []
  } finally {
    fetchingProfiles = false
    drawStatus()
  }
}

async function fetchValidators() {
  try {
    fetchingValidators = true
    drawStatus()
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
          icon: item.meta.icon ? item.meta.icon : null,
          title: item.meta.title,
          titleHTML: item.meta.title ? sanitize(item.meta.title) : null,
          description: item.meta.description,
          descriptionHTML: item.meta.description ? sanitize(item.meta.description) : null,
          www: item.meta.www,
          owner: item.owner_address,
          rating: item.rating,
        }
      })
    })
    app.storage.local.set({minterValidators: validators, minterValidatorsUpdated: Date.now()})
    return validators
  } catch (error) {
    console.warn(error)
    $errors.innerHTML += `<div class="error"><b>Error while fetching validators</b><br>${error}</div>`
    return []
  } finally {
    fetchingValidators = false
    drawStatus()
  }
}

function matchItems() {
  const words = input.split(/\s+/)
  items.forEach(item => {
    item.matched = true
    words.forEach(word => {
      item.matched = item.matched && hasWordVariations(item, word)
    })
  })
  drawStatus()
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

function getItemHTML(item) {
  const {hash, icon, titleHTML, descriptionHTML, matched, www, isVerified, isProfile, isValidator} = item
  const verifiedHTML = isVerified ? '<img class="verified" src="../img/verified_32.png" alt="" title="Verified by Minterscan" />' : ''
  const shortHash = hash.slice(0, 7) + '...' + hash.slice(-5)
  const title = titleHTML || `Unnamed ${isProfile ? 'profile' : 'validator'}`
  const description = descriptionHTML ? `<small class="description">${descriptionHTML}</small>` : ''
  return `
    <div class="item ${isValidator ? 'validator' : 'profile'}${matched ? ' matched' : ''}">
      <div class="info">
        <img class="avatar" width="32" height="32" src="../img/loading_32.gif" data-src="${icon || '../img/empty_32.png'}" alt="" />
        ${verifiedHTML}
        <div class="header">
          <span class="type"></span>
          <span class="links">
            ${getWebLink(www)}
            ${getExplorerLink(hash)}
            ${getMinterscanLink(hash)}
            ${getInterchainLink(hash)}
            ${getKarmaLink(hash)}
          </span>
          <div class="title">${title}</div>
          <code class="hash">
            ${shortHash}&nbsp;
            <span class="copy" data-hash="${hash}">copy</span>
          </code>
        </div>
      </div>
      ${description}
    </div>
  `
}

function getWebLink(url) {
  if (!url) {
    return ''
  }
  const telegram = matchTelegram(url)
  const vkontakte = matchVkontakte(url)
  const facebook = matchFacebook(url)
  const twitter = matchTwitter(url)
  if (telegram) {
    return `<a class="link telegram" href="https://t.me/${telegram}" target="_blank" title="https://t.me/${telegram}"></a>`
  } else if (vkontakte) {
    return `<a class="link vkontakte" href="https://vk.com/${vkontakte}" target="_blank" title="https://vk.com/${vkontakte}"></a>`
  } else if (facebook) {
    return `<a class="link facebook" href="https://facebook.com/${facebook}" target="_blank" title="https://facebook.com/${facebook}"></a>`
  } else if (twitter) {
    return `<a class="link twitter" href="https://twitter.com/${twitter}" target="_blank" title="https://twitter.com/${twitter}"></a>`
  }
  return `<a class="link www" href="${url}" target="_blank" title="${url}"></a>`
}

function getExplorerLink(hash) {
  const path = matchValidator(hash) ? 'validator' : 'address'
  const link = `https://explorer.minter.network/${path}/${hash}`
  return `<a class="link explorer" href="${link}" target="_blank" title="${link}"></a>`
}
function getMinterscanLink(hash) {
  const path = matchValidator(hash) ? 'validator' : 'address'
  const link = `https://minterscan.net/${path}/${hash}`
  return `<a class="link minterscan" href="${link}" target="_blank" title="${link}"></a>`
}
function getInterchainLink(hash) {
  const path = matchValidator(hash) ? 'nodes' : 'wallet'
  const link = `https://minter.interchain.zone/en/${path}/${hash}`
  return `<a class="link interchain" href="${link}" target="_blank" title="${link}"></a>`
}
function getKarmaLink(hash) {
  const link = `https://karma.mn/#${hash}`
  return matchAddress(hash) ? `<a class="link karma" href="link" target="_blank" title="${link}"></a>` : ''
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

function sanitize(html) {
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
