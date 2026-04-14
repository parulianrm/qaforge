let isRecording = false
let steps = []

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'START_RECORDING') {
        isRecording = true
        steps = []
        captureNavigation()
        sendResponse({ status: 'started' })
    }
    if (message.action === 'STOP_RECORDING') {
        isRecording = false
        removeListeners()
        sendResponse({ status: 'stopped', steps })
    }
    if (message.action === 'GET_STEPS') {
        sendResponse({ steps })
    }
    return true
})

function handleClick(e) {
    if (!isRecording) return
    const el = e.target
    const label = getLabel(el)
    steps.push({ type: 'click', target: label, tag: el.tagName.toLowerCase(), timestamp: Date.now() })
    saveSteps()
}

function handleInput(e) {
    if (!isRecording) return
    const el = e.target
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
    const label = getLabel(el)
    const value = el.type === 'password' ? '••••••••' : el.value
    const last = steps[steps.length - 1]
    if (last && last.type === 'type' && last.target === label) {
        last.value = value
        last.timestamp = Date.now()
    } else {
        steps.push({ type: 'type', target: label, value, tag: el.tagName.toLowerCase(), timestamp: Date.now() })
    }
    saveSteps()
}

function captureNavigation() {
    steps.push({ type: 'nav', url: window.location.href, title: document.title, timestamp: Date.now() })
    saveSteps()
}

function handleScroll() {
    if (!isRecording) return
    const last = steps[steps.length - 1]
    if (last && last.type === 'scroll') {
        last.scrollY = window.scrollY
        last.timestamp = Date.now()
        return
    }
    steps.push({ type: 'scroll', scrollY: window.scrollY, timestamp: Date.now() })
    saveSteps()
}

function getLabel(el) {
    return (
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('name') ||
        el.getAttribute('id') ||
        el.innerText?.trim().slice(0, 50) ||
        el.tagName.toLowerCase()
    )
}

function saveSteps() {
    chrome.storage.local.set({ qaforge_current_steps: steps })
}

function removeListeners() {
    document.removeEventListener('click', handleClick, true)
    document.removeEventListener('input', handleInput, true)
    document.removeEventListener('scroll', handleScroll, true)
}

document.addEventListener('click', handleClick, true)
document.addEventListener('input', handleInput, true)
document.addEventListener('scroll', handleScroll, true)