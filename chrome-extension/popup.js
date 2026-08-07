var isRecording = false;
var currentSteps = [];
var allSessions = [];
var currentTabId = null;

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('startBtn').addEventListener('click', startRecording);
    document.getElementById('stopBtn').addEventListener('click', stopRecording);
    document.getElementById('clearBtn').addEventListener('click', clearAll);
    document.getElementById('sendBtn').addEventListener('click', sendToApp);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            currentTabId = tabs[0].id;
            document.getElementById('urlDisplay').textContent = tabs[0].url || '—';
        }
    });

    chrome.storage.local.get(['havox_sessions', 'havox_recording', 'havox_current_steps', 'havox_project_id'], function (data) {
        if (data.havox_sessions && data.havox_sessions.length) {
            allSessions = data.havox_sessions;
            renderSessions();
        }
        if (data.havox_recording) {
            isRecording = true;
            currentSteps = data.havox_current_steps || [];
            setRecordingUI(true);
            updateCurrentCount(currentSteps.length);
        }
        if (data.havox_project_id) {
            document.getElementById('projectInfo').textContent = 'Terhubung ke project';
            document.getElementById('projectInfo').style.color = '#10b981';
        }
    });

    // Update count tiap detik saat recording
    setInterval(function () {
        if (!isRecording) return;
        chrome.storage.local.get(['havox_current_steps'], function (data) {
            if (data.havox_current_steps) {
                updateCurrentCount(data.havox_current_steps.length);
            }
        });
    }, 1000);
});

function startRecording() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (!tabs[0]) return;
        currentTabId = tabs[0].id;

        chrome.scripting.executeScript(
            { target: { tabId: currentTabId }, files: ['content.js'] },
            function () {
                if (chrome.runtime.lastError) {
                    console.error('Inject error:', chrome.runtime.lastError.message);
                    return;
                }
                setTimeout(function () {
                    chrome.tabs.sendMessage(currentTabId, { action: 'START_RECORDING' }, function (response) {
                        if (chrome.runtime.lastError) {
                            console.error('Message error:', chrome.runtime.lastError.message);
                            return;
                        }
                        if (response && response.status === 'started') {
                            isRecording = true;
                            currentSteps = [];
                            chrome.storage.local.set({
                                havox_recording: true,
                                havox_current_steps: [],
                                havox_tab_id: currentTabId
                            });
                            setRecordingUI(true);
                            updateCurrentCount(0);
                        }
                    });
                }, 200);
            }
        );
    });
}

function stopRecording() {
    chrome.storage.local.get(['havox_tab_id'], function (data) {
        var tabId = data.havox_tab_id || currentTabId;
        if (!tabId) return;

        chrome.tabs.sendMessage(tabId, { action: 'STOP_RECORDING' }, function (response) {
            if (chrome.runtime.lastError) {
                console.error('Stop error:', chrome.runtime.lastError.message);
                // Coba ambil dari storage sebagai fallback
                chrome.storage.local.get(['havox_current_steps'], function (stored) {
                    processStoppedSteps(stored.havox_current_steps || []);
                });
                return;
            }
            var steps = (response && response.steps) ? response.steps : [];
            processStoppedSteps(steps);
        });
    });
}

function processStoppedSteps(steps) {
    isRecording = false;
    currentSteps = steps;

    if (currentSteps.length > 0) {
        var session = {
            id: Date.now(),
            steps: currentSteps,
            stepCount: currentSteps.length,
            url: currentSteps[0] ? (currentSteps[0].url || '—') : '—',
            timestamp: new Date().toLocaleTimeString('id-ID')
        };
        allSessions.push(session);
    }

    chrome.storage.local.set({
        havox_recording: false,
        havox_current_steps: [],
        havox_sessions: allSessions
    });

    setRecordingUI(false);
    updateCurrentCount(0);
    renderSessions();
}

function clearAll() {
    allSessions = [];
    currentSteps = [];
    isRecording = false;
    chrome.storage.local.set({
        havox_sessions: [],
        havox_recording: false,
        havox_current_steps: []
    });
    setRecordingUI(false);
    renderSessions();
    updateCurrentCount(0);
}

function deleteSession(id) {
    allSessions = allSessions.filter(function (s) { return s.id !== id; });
    chrome.storage.local.set({ havox_sessions: allSessions });
    renderSessions();
}

function setRecordingUI(recording) {
    document.getElementById('startBtn').style.display = recording ? 'none' : 'block';
    document.getElementById('stopBtn').style.display = recording ? 'block' : 'none';
    document.getElementById('dot').className = recording ? 'dot recording' : 'dot';
    document.getElementById('badge').className = recording ? 'badge recording' : 'badge idle';
    document.getElementById('badge').textContent = recording ? 'Recording' : 'Idle';
    document.getElementById('statusText').textContent = recording ? 'Sedang merekam...' : 'Siap merekam';
}

function updateCurrentCount(count) {
    document.getElementById('currentCount').textContent = count > 0 ? count + ' langkah' : '';
}

function renderSessions() {
    var list = document.getElementById('sessionsList');
    var totalEl = document.getElementById('totalSessions');
    var sendBtn = document.getElementById('sendBtn');

    totalEl.textContent = allSessions.length;
    sendBtn.disabled = allSessions.length === 0;

    if (allSessions.length === 0) {
        list.innerHTML = '<div class="empty">Belum ada test case.<br>Start - Stop untuk merekam 1 test case.</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < allSessions.length; i++) {
        var s = allSessions[i];
        html += '<div class="session-item">'
            + '<div class="session-header">'
            + '<span class="session-num">TC ' + (i + 1) + '</span>'
            + '<span class="session-time">' + s.timestamp + '</span>'
            + '<button class="session-del" data-id="' + s.id + '">hapus</button>'
            + '</div>'
            + '<div class="session-steps">' + s.stepCount + ' langkah direkam</div>'
            + '</div>';
    }
    list.innerHTML = html;

    var delBtns = list.querySelectorAll('.session-del');
    for (var j = 0; j < delBtns.length; j++) {
        delBtns[j].addEventListener('click', function () {
            deleteSession(parseInt(this.getAttribute('data-id')));
        });
    }
}

function sendToApp() {
    if (allSessions.length === 0) return;
    var sessions = encodeURIComponent(JSON.stringify(allSessions));
    var finalUrl = 'http://localhost:5173/recorder?sessions=' + sessions;

    chrome.tabs.query({}, function (tabs) {
        var havoxTab = null;
        for (var i = 0; i < tabs.length; i++) {
            if (tabs[i].url && tabs[i].url.indexOf('localhost:5173') !== -1) {
                havoxTab = tabs[i];
                break;
            }
        }
        if (havoxTab) {
            chrome.tabs.update(havoxTab.id, { url: finalUrl, active: true }, function () {
                chrome.windows.update(havoxTab.windowId, { focused: true });
            });
        } else {
            chrome.tabs.create({ url: finalUrl });
        }

        allSessions = [];
        chrome.storage.local.set({ havox_sessions: [], havox_current_steps: [] });
        renderSessions();
    });
}