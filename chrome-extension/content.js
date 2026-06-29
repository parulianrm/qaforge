if (!window.__havoxInjected) {
    window.__havoxInjected = true;

    var qaIsRecording = false;
    var qaSteps = [];
    var qaNotifObserver = null;

    chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
        if (message.action === 'START_RECORDING') {
            qaIsRecording = true;
            qaSteps = [];
            qaCaptureNavigation();
            qaStartNotifObserver();
            sendResponse({ status: 'started' });
        }
        if (message.action === 'STOP_RECORDING') {
            qaIsRecording = false;
            qaStopNotifObserver();
            sendResponse({ status: 'stopped', steps: qaSteps });
        }
        if (message.action === 'GET_STEPS') {
            sendResponse({ steps: qaSteps });
        }
        return true;
    });

    // ── Click handler ──────────────────────────────────────────────────────────
    function qaHandleClick(e) {
        if (!qaIsRecording) return;
        var el = e.target;

        // Naik ke parent untuk cari elemen yang lebih bermakna (button, a, input)
        var meaningful = el;
        var depth = 0;
        while (meaningful && depth < 5) {
            if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'].includes(meaningful.tagName)) break;
            if (meaningful.getAttribute('role') === 'button') break;
            if (meaningful.id) break;
            meaningful = meaningful.parentElement;
            depth++;
        }
        if (!meaningful) meaningful = el;

        var label = qaGetLabel(meaningful);
        if (!label || label === 'body' || label === 'html') return;

        // Kumpulkan semua identifier
        var idValue = qaFindId(meaningful);
        var nameValue = meaningful.getAttribute('name') || null;
        var classValue = qaGetMeaningfulClass(meaningful);
        var xpathValue = idValue ? null : qaGetShortXPath(meaningful);
        var cssValue = idValue ? null : qaGetCssSelector(meaningful);

        qaSteps.push({
            type: 'click',
            target: label,
            tag: meaningful.tagName.toLowerCase(),
            id: idValue,
            name: nameValue,
            className: classValue,
            xpath: xpathValue,
            cssSelector: cssValue,
            timestamp: Date.now()
        });
        qaSaveSteps();
    }

    // ── Input handler ──────────────────────────────────────────────────────────
    function qaHandleInput(e) {
        if (!qaIsRecording) return;
        var el = e.target;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;

        var label = qaGetLabel(el);
        var value = el.type === 'password' ? '••••••••' : el.value;

        var idValue = qaFindId(el);
        var nameValue = el.getAttribute('name') || null;
        var classValue = qaGetMeaningfulClass(el);
        var xpathValue = idValue ? null : qaGetShortXPath(el);
        var cssValue = idValue ? null : qaGetCssSelector(el);

        var stepData = {
            type: 'type',
            target: label,
            value: value,
            tag: el.tagName.toLowerCase(),
            inputType: el.type || 'text',
            id: idValue,
            name: nameValue,
            className: classValue,
            xpath: xpathValue,
            cssSelector: cssValue,
            timestamp: Date.now()
        };

        // Update step terakhir jika field sama
        var last = qaSteps[qaSteps.length - 1];
        if (last && last.type === 'type' && last.target === label) {
            Object.assign(last, stepData);
        } else {
            qaSteps.push(stepData);
        }
        qaSaveSteps();
    }

    // ── Scroll handler ─────────────────────────────────────────────────────────
    function qaHandleScroll() {
        if (!qaIsRecording) return;
        var last = qaSteps[qaSteps.length - 1];
        if (last && last.type === 'scroll') {
            last.scrollY = window.scrollY;
            last.timestamp = Date.now();
            return;
        }
        qaSteps.push({ type: 'scroll', scrollY: window.scrollY, timestamp: Date.now() });
        qaSaveSteps();
    }

    // ── Navigation ─────────────────────────────────────────────────────────────
    function qaCaptureNavigation() {
        qaSteps.push({
            type: 'nav',
            url: window.location.href,
            title: document.title,
            timestamp: Date.now()
        });
        qaSaveSteps();
    }

    // ── Notifikasi observer ────────────────────────────────────────────────────
    function qaStartNotifObserver() {
        qaNotifObserver = new MutationObserver(function (mutations) {
            if (!qaIsRecording) return;

            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;

                    // Deteksi elemen notifikasi berdasarkan id, role, atau class umum
                    var notifEl = qaFindNotifElement(node);
                    if (!notifEl) return;

                    // Tunggu sebentar agar teks sudah terisi
                    setTimeout(function () {
                        var text = (notifEl.innerText || notifEl.textContent || '').trim().slice(0, 200);
                        if (!text) return;

                        var idValue = qaFindId(notifEl);
                        var classValue = qaGetMeaningfulClass(notifEl);
                        var cssValue = idValue ? null : qaGetCssSelector(notifEl);

                        // Hindari duplikat notif yang sama
                        var last = qaSteps[qaSteps.length - 1];
                        if (last && last.type === 'notification' && last.message === text) return;

                        qaSteps.push({
                            type: 'notification',
                            message: text,
                            id: idValue,
                            className: classValue,
                            cssSelector: cssValue,
                            timestamp: Date.now()
                        });
                        qaSaveSteps();
                    }, 300);
                });
            });
        });

        qaNotifObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function qaStopNotifObserver() {
        if (qaNotifObserver) {
            qaNotifObserver.disconnect();
            qaNotifObserver = null;
        }
    }

    // Cari elemen notifikasi dari node yang baru muncul
    function qaFindNotifElement(node) {
        // Cek node itu sendiri dulu
        if (qaIsNotifElement(node)) return node;

        // Cek children
        var children = node.querySelectorAll ? node.querySelectorAll('*') : [];
        for (var i = 0; i < children.length; i++) {
            if (qaIsNotifElement(children[i])) return children[i];
        }
        return null;
    }

    function qaIsNotifElement(el) {
        if (!el || !el.getAttribute) return false;

        var role = el.getAttribute('role') || '';
        var id = (el.id || '').toLowerCase();
        var cls = (el.className && typeof el.className === 'string' ? el.className : '').toLowerCase();
        var ariaLive = el.getAttribute('aria-live') || '';

        // Deteksi berdasarkan role, id, class, atau aria-live
        var notifKeywords = ['alert', 'notification', 'toast', 'snackbar', 'message',
            'notif', 'popup', 'banner', 'error', 'success', 'warning', 'info'];

        if (role === 'alert' || role === 'status' || ariaLive) return true;

        for (var i = 0; i < notifKeywords.length; i++) {
            if (id.includes(notifKeywords[i])) return true;
            if (cls.includes(notifKeywords[i])) return true;
        }

        return false;
    }

    // ── Helper: cari id dari elemen + parent terdekat ──────────────────────────
    function qaFindId(el) {
        // Cek elemen itu sendiri dulu
        if (el.id && el.id.trim()) return el.id.trim();

        // Cek parent langsung (1 level)
        if (el.parentElement && el.parentElement.id && el.parentElement.id.trim()) {
            return el.parentElement.id.trim();
        }

        // Cek children langsung yang punya id (untuk wrapper div)
        var children = el.children;
        for (var i = 0; i < children.length; i++) {
            if (children[i].id && children[i].id.trim()) return children[i].id.trim();
        }

        return null;
    }

    // ── Helper: class yang bermakna (bukan utility class Tailwind) ─────────────
    function qaGetMeaningfulClass(el) {
        if (!el.className || typeof el.className !== 'string') return null;
        var classes = el.className.trim().split(/\s+/).filter(function (c) {
            // Filter utility class Tailwind / Bootstrap
            return c.length > 2 &&
                !c.match(/^(flex|grid|w-|h-|p-|m-|text-|bg-|border|rounded|items|justify|gap|col|row|sm:|md:|lg:|xl:|hover:|focus:|active:|block|inline|hidden|relative|absolute|fixed|z-|overflow|cursor|font|leading|tracking|shadow|opacity|transition|duration|ease|transform|scale|rotate|translate|skew)/);
        });
        return classes.length > 0 ? classes[0] : null;
    }

    // ── Helper: XPath pendek dari parent ber-id terdekat ──────────────────────
    function qaGetShortXPath(el) {
        var current = el;
        var depth = 0;
        while (current && current.nodeType === 1 && depth < 8) {
            if (current.id) {
                if (current === el) return '//*[@id="' + current.id + '"]';
                var parts = [];
                var node = el;
                while (node !== current) {
                    var idx = 1, sib = node.previousSibling;
                    while (sib) {
                        if (sib.nodeType === 1 && sib.tagName === node.tagName) idx++;
                        sib = sib.previousSibling;
                    }
                    parts.unshift(node.tagName.toLowerCase() + (idx > 1 ? '[' + idx + ']' : ''));
                    node = node.parentNode;
                }
                return '//*[@id="' + current.id + '"]/' + parts.join('/');
            }
            current = current.parentElement;
            depth++;
        }

        // Fallback: xpath pendek max 3 level
        var parts = [];
        var node = el;
        var d = 0;
        while (node && node.nodeType === 1 && d < 3) {
            var idx = 1, sib = node.previousSibling;
            while (sib) {
                if (sib.nodeType === 1 && sib.tagName === node.tagName) idx++;
                sib = sib.previousSibling;
            }
            parts.unshift(node.tagName.toLowerCase() + (idx > 1 ? '[' + idx + ']' : ''));
            node = node.parentNode;
            d++;
        }
        return '//' + parts.join('/');
    }

    // ── Helper: CSS selector spesifik ─────────────────────────────────────────
    function qaGetCssSelector(el) {
        if (el.id) return '#' + el.id;
        if (el.getAttribute('name')) return el.tagName.toLowerCase() + '[name="' + el.getAttribute('name') + '"]';
        if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
        if (el.getAttribute('type') && el.tagName === 'INPUT') return 'input[type="' + el.getAttribute('type') + '"]';
        var meaningful = qaGetMeaningfulClass(el);
        if (meaningful) return el.tagName.toLowerCase() + '.' + meaningful;
        return el.tagName.toLowerCase();
    }

    // ── Helper: label readable ────────────────────────────────────────────────
    function qaGetLabel(el) {
        var labelText = qaFindAssociatedLabel(el);
        if (labelText) return labelText;

        return (
            el.getAttribute('aria-label') ||
            el.getAttribute('placeholder') ||
            el.getAttribute('name') ||
            el.id ||
            el.getAttribute('data-testid') ||
            (el.innerText && el.innerText.trim().slice(0, 60)) ||
            el.tagName.toLowerCase()
        );
    }

    function qaCleanLabelText(text) {
        return (text || '')
            .replace(/\*/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 60);
    }

    function qaFindAssociatedLabel(el) {
        if (!el) return null;

        var id = el.id || el.getAttribute('id');
        if (id) {
            var explicitLabel = document.querySelector('label[for="' + CSS.escape(id) + '"]');
            var explicitText = qaCleanLabelText(explicitLabel && explicitLabel.innerText);
            if (explicitText) return explicitText;
        }

        var parentLabel = el.closest && el.closest('label');
        var parentLabelText = qaCleanLabelText(parentLabel && parentLabel.innerText);
        if (parentLabelText) return parentLabelText;

        var container = el.parentElement;
        var depth = 0;
        while (container && depth < 4) {
            var directLabels = Array.prototype.filter.call(container.children || [], function (child) {
                return child.tagName === 'LABEL';
            });

            for (var i = directLabels.length - 1; i >= 0; i--) {
                var text = qaCleanLabelText(directLabels[i].innerText);
                if (text) return text;
            }

            var previous = el.previousElementSibling;
            while (previous) {
                if (previous.tagName === 'LABEL') {
                    var prevText = qaCleanLabelText(previous.innerText);
                    if (prevText) return prevText;
                }
                previous = previous.previousElementSibling;
            }

            el = container;
            container = container.parentElement;
            depth++;
        }

        return null;
    }

    function qaSaveSteps() {
        chrome.storage.local.set({ havox_current_steps: qaSteps });
    }

    document.addEventListener('click', qaHandleClick, true);
    document.addEventListener('input', qaHandleInput, true);
    document.addEventListener('change', qaHandleInput, true);
    document.addEventListener('scroll', qaHandleScroll, true);
}
