var isRecording = false;
var currentSteps = [];
var allSessions = [];
var currentTabId = null;
var sessionName = '';

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

    chrome.storage.local.get(['qaforge_sessions', 'qaforge_recording', 'qaforge_current_steps'], function (data) {
        if (data.qaforge_sessions && data.qaforge_sessions.length) {
            allSessions = data.qaforge_sessions;
            renderSessions();
        }
        if (data.qaforge_recording) {
            isRecording = true;
            currentSteps = data.qaforge_current_steps || [];
            setRecordingUI(true);
        }
    });
});

function startRecording() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (!tabs[0]) return;
        currentTabId = tabs[0].id;
        chrome.scripting.executeScript(
            { target: { tabId: currentTabId }, files: ['content.js'] },
            function () {
                if (chrome.runtime.lastError) { console.error(chrome.runtime.lastError); return; }
                setTimeout(function () {
                    chrome.tabs.sendMessage(currentTabId, { action: 'START_RECORDING' }, function (response) {
                        if (chrome.runtime.lastError) { console.error(chrome.runtime.lastError); return; }
                        isRecording = true;
                        currentSteps = [];
                        chrome.storage.local.set({ qaforge_recording: true, qaforge_current_steps: [] });
                        setRecordingUI(true);
                        updateCurrentCount(0);
                    });
                }, 150);
            }
        );
    });
}

function stopRecording() {
    if (!currentTabId) return;
    chrome.tabs.sendMessage(currentTabId, { action: 'STOP_RECORDING' }, function (response) {
        isRecording = false;
        if (response && response.steps) currentSteps = response.steps;

        if (currentSteps.length > 0) {
            // Simpan sebagai 1 session
            var session = {
                id: Date.now(),
                steps: currentSteps,
                stepCount: currentSteps.length,
                url: currentSteps[0] ? currentSteps[0].url || '—' : '—',
                timestamp: new Date().toLocaleTimeString('id-ID')
            };
            allSessions.push(session);
            chrome.storage.local.set({
                qaforge_recording: false,
                qaforge_current_steps: [],
                qaforge_sessions: allSessions
            });
        } else {
            chrome.storage.local.set({ qaforge_recording: false });
        }

        setRecordingUI(false);
        updateCurrentCount(0);
        renderSessions();
    });
}

function clearAll() {
    allSessions = [];
    currentSteps = [];
    isRecording = false;
    chrome.storage.local.set({ qaforge_sessions: [], qaforge_recording: false, qaforge_current_steps: [] });
    setRecordingUI(false);
    renderSessions();
    updateCurrentCount(0);
}

function deleteSession(id) {
    allSessions = allSessions.filter(function (s) { return s.id !== id; });
    chrome.storage.local.set({ qaforge_sessions: allSessions });
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
        list.innerHTML = '<div class="empty">Belum ada test case. Start - Stop untuk merekam 1 test case.</div>';
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
            + '<div class="session-steps">' + s.stepCount + ' langkah</div>'
            + '</div>';
    }
    list.innerHTML = html;

    // Pasang event listener tombol hapus
    var delBtns = list.querySelectorAll('.session-del');
    for (var j = 0; j < delBtns.length; j++) {
        delBtns[j].addEventListener('click', function () {
            deleteSession(parseInt(this.getAttribute('data-id')));
        });
    }
}

// Update step count saat recording berlangsung
setInterval(function () {
    if (!isRecording || !currentTabId) return;
    chrome.storage.local.get(['qaforge_current_steps'], function (data) {
        if (data.qaforge_current_steps) {
            updateCurrentCount(data.qaforge_current_steps.length);
        }
    });
}, 1000);

function sendToApp() {
    var data = encodeURIComponent(JSON.stringify(allSessions));
    var projectId = '';
    chrome.storage.local.get(['qaforge_project_id'], function (stored) {
        if (stored.qaforge_project_id) projectId = stored.qaforge_project_id;
        var url = 'http://localhost:5173/recorder?sessions=' + data + (projectId ? '&projectId=' + projectId : '');
        chrome.tabs.create({ url: url });
    });
}