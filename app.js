let currentIndex = 0;
let codesQueue = [];
let isPlaying = false;
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let cpmTimes = [];
let history = [];
let audioCtx = null;
let silentAudioElement = null;

function bufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);

    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);

    setUint32(0x61746164);
    setUint32(length - pos - 4);

    for (i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([view], { type: 'audio/wav' });
}

function setupSilentAudio() {
    if (silentAudioElement) return;
    
    const sampleRate = 8000;
    const duration = 60;
    const numSamples = sampleRate * duration;
    
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
    const blob = bufferToWav(buffer);
    const url = URL.createObjectURL(blob);
    
    silentAudioElement = new Audio(url);
    silentAudioElement.loop = true;
    silentAudioElement.volume = 1.0;
}

const elCurrentCode = document.getElementById('currentCode');
const elNextCode = document.getElementById('nextCode');
const elTimerValue = document.getElementById('timerValue');
const elProgressText = document.getElementById('progressText');
const elProgressPercent = document.getElementById('progressPercent');
const elProgressBarFill = document.getElementById('progressBarFill');
const elCpmValue = document.getElementById('cpmValue');
const elEtaValue = document.getElementById('etaValue');
const elHistoryList = document.getElementById('historyList');
const elStatusBadge = document.getElementById('statusBadge');
const elCurrentPresetName = document.getElementById('currentPresetName');
const elBtnToggle = document.getElementById('btnToggle');
const elBtnToggleText = document.getElementById('btnToggleText');
const elBtnPrev = document.getElementById('btnPrev');
const elBtnNext = document.getElementById('btnNext');
const elBtnReset = document.getElementById('btnReset');
const elQueuePreset = document.getElementById('queuePreset');
const elCustomInputGroup = document.getElementById('customInputGroup');
const elCustomCodesList = document.getElementById('customCodesList');
const elToggleSound = document.getElementById('toggleSound');
const elCodeDisplayPanel = document.querySelector('.code-display-panel');

function generateQueue() {
    const preset = elQueuePreset.value;
    if (preset === 'common') {
        codesQueue = COMMON_CODES.slice(0, 1000);
        elCurrentPresetName.textContent = `COMMON CODES (1000)`;
    } else if (preset === 'common_all') {
        codesQueue = [...COMMON_CODES];
        elCurrentPresetName.textContent = `COMMON CODES (${codesQueue.length})`;
    } else if (preset === 'sequential') {
        codesQueue = [];
        for (let i = 0; i < 10000; i++) {
            codesQueue.push(String(i).padStart(4, '0'));
        }
        elCurrentPresetName.textContent = `SEQUENTIAL (${codesQueue.length})`;
    } else if (preset === 'custom') {
        const text = elCustomCodesList.value;
        codesQueue = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && /^\d+$/.test(line))
            .map(line => line.padStart(4, '0'));
        
        if (codesQueue.length === 0) {
            codesQueue = ['0000'];
        }
        elCurrentPresetName.textContent = `CUSTOM (${codesQueue.length})`;
    }
}

function playClick() {
    if (!elToggleSound.checked) return;
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.07);
        
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.07);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.07);
    } catch (e) {}
}

function updateDisplay() {
    if (codesQueue.length === 0) return;
    
    const current = codesQueue[currentIndex];
    elCurrentCode.textContent = current;
    
    if (currentIndex + 1 < codesQueue.length) {
        elNextCode.textContent = codesQueue[currentIndex + 1];
    } else {
        elNextCode.textContent = 'END';
    }

    elProgressText.textContent = `${currentIndex} / ${codesQueue.length}`;
    const pct = codesQueue.length > 0 ? Math.round((currentIndex / codesQueue.length) * 100) : 0;
    elProgressPercent.textContent = `${pct}%`;
    elProgressBarFill.style.width = `${pct}%`;

    updateMediaSession();
}

function updateMediaSession() {
    if ('mediaSession' in navigator && codesQueue.length > 0) {
        const current = codesQueue[currentIndex];
        const next = currentIndex + 1 < codesQueue.length ? codesQueue[currentIndex + 1] : 'END';
        
        navigator.mediaSession.metadata = new MediaMetadata({
            title: `CURRENT: ${current}`,
            artist: `NEXT: ${next}`,
            album: `Code Raider Progress: ${currentIndex}/${codesQueue.length}`
        });
    }
}

function startTimer() {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(() => {
        elapsedTime = Date.now() - startTime;
        const totalSecs = Math.floor(elapsedTime / 1000);
        const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
        const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
        const secs = String(totalSecs % 60).padStart(2, '0');
        elTimerValue.textContent = `${hrs}:${mins}:${secs}`;
        updateETA();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateETA() {
    if (cpmTimes.length > 1) {
        const first = cpmTimes[0];
        const last = cpmTimes[cpmTimes.length - 1];
        const durationMinutes = (last - first) / 60000;
        
        if (durationMinutes > 0) {
            const cpm = Math.round((cpmTimes.length - 1) / durationMinutes);
            elCpmValue.innerHTML = `${cpm} <span class="unit">CPM</span>`;
            
            const remaining = codesQueue.length - currentIndex;
            if (cpm > 0 && remaining > 0) {
                const remSecs = Math.round((remaining / cpm) * 60);
                const rHrs = String(Math.floor(remSecs / 3600)).padStart(2, '0');
                const rMins = String(Math.floor((remSecs % 3600) / 60)).padStart(2, '0');
                const rSecs = String(remSecs % 60).padStart(2, '0');
                elEtaValue.textContent = `${rHrs}:${rMins}:${rSecs}`;
            } else {
                elEtaValue.textContent = '00:00:00';
            }
        }
    } else {
        elCpmValue.innerHTML = `0 <span class="unit">CPM</span>`;
        elEtaValue.textContent = '--:--:--';
    }
}

function startSession() {
    if (isPlaying) return;
    
    isPlaying = true;
    elStatusBadge.textContent = 'ACTIVE';
    elStatusBadge.className = 'status-badge active';
    elCodeDisplayPanel.classList.add('active');
    elBtnToggleText.textContent = 'PAUSE SESSION';
    elBtnToggle.style.background = '#ffffff';
    elBtnToggle.style.color = '#0a0a0c';
    
    setupSilentAudio();
    if (silentAudioElement) {
        silentAudioElement.play().catch(() => {});
    }
    startTimer();
    setupMediaSessionHandlers();
    playClick();
}

function pauseSession() {
    if (!isPlaying) return;
    
    isPlaying = false;
    elStatusBadge.textContent = 'PAUSED';
    elStatusBadge.className = 'status-badge paused';
    elCodeDisplayPanel.classList.remove('active');
    elBtnToggleText.textContent = 'RESUME SESSION';
    elBtnToggle.style.background = 'transparent';
    elBtnToggle.style.color = '#ffffff';
    
    if (silentAudioElement) {
        silentAudioElement.pause();
    }
    stopTimer();
}

function toggleSession() {
    if (isPlaying) {
        pauseSession();
    } else {
        startSession();
    }
}

function prevCode() {
    if (currentIndex > 0) {
        currentIndex--;
        updateDisplay();
        playClick();
    }
}

function nextCode() {
    if (codesQueue.length === 0) return;
    
    const now = Date.now();
    
    if (currentIndex < codesQueue.length - 1) {
        const triedCode = codesQueue[currentIndex];
        
        cpmTimes.push(now);
        if (cpmTimes.length > 15) {
            cpmTimes.shift();
        }
        
        addHistoryItem(triedCode, currentIndex);
        
        currentIndex++;
        updateDisplay();
        playClick();
        updateETA();
    } else {
        const triedCode = codesQueue[currentIndex];
        addHistoryItem(triedCode, currentIndex);
        currentIndex++;
        elProgressText.textContent = `${currentIndex} / ${codesQueue.length}`;
        elProgressBarFill.style.width = '100%';
        elProgressPercent.textContent = '100%';
        elCurrentCode.textContent = 'DONE';
        elNextCode.textContent = '----';
        pauseSession();
        playClick();
    }
}

function addHistoryItem(code, index) {
    history.unshift({ code, index, time: new Date().toLocaleTimeString() });
    if (history.length > 30) {
        history.pop();
    }
    renderHistory();
}

function renderHistory() {
    if (history.length === 0) {
        elHistoryList.innerHTML = '<div class="history-empty">No codes tried yet. Start session to log history.</div>';
        return;
    }
    
    elHistoryList.innerHTML = history.map(item => `
        <div class="history-item">
            <span class="history-code">${item.code}</span>
            <div class="history-meta">
                <span class="history-idx">#${item.index + 1}</span>
                <span class="history-time">${item.time}</span>
            </div>
        </div>
    `).join('');
}

function resetRaid() {
    const confirmReset = confirm('Are you sure you want to reset the current raid session and progress?');
    if (!confirmReset) return;
    
    pauseSession();
    currentIndex = 0;
    elapsedTime = 0;
    cpmTimes = [];
    history = [];
    
    elTimerValue.textContent = '00:00:00';
    elCpmValue.innerHTML = `0 <span class="unit">CPM</span>`;
    elEtaValue.textContent = '--:--:--';
    
    elStatusBadge.textContent = 'READY';
    elStatusBadge.className = 'status-badge ready';
    elBtnToggleText.textContent = 'START SESSION';
    
    generateQueue();
    updateDisplay();
    renderHistory();
}

function setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', startSession);
        navigator.mediaSession.setActionHandler('pause', pauseSession);
        navigator.mediaSession.setActionHandler('nexttrack', nextCode);
        navigator.mediaSession.setActionHandler('previoustrack', prevCode);
        navigator.mediaSession.setActionHandler('seekbackward', prevCode);
        navigator.mediaSession.setActionHandler('seekforward', nextCode);
    }
}

elQueuePreset.addEventListener('change', () => {
    if (elQueuePreset.value === 'custom') {
        elCustomInputGroup.classList.remove('hidden');
    } else {
        elCustomInputGroup.classList.add('hidden');
    }
    currentIndex = 0;
    generateQueue();
    updateDisplay();
});

elCustomCodesList.addEventListener('input', () => {
    if (elQueuePreset.value === 'custom') {
        currentIndex = 0;
        generateQueue();
        updateDisplay();
    }
});

elBtnToggle.addEventListener('click', toggleSession);
elBtnPrev.addEventListener('click', prevCode);
elBtnNext.addEventListener('click', nextCode);
elBtnReset.addEventListener('click', resetRaid);

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        return;
    }
    if (e.code === 'Space') {
        e.preventDefault();
        toggleSession();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        nextCode();
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        prevCode();
    }
});

generateQueue();
updateDisplay();
