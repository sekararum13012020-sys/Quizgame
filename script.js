/* ============================================================
   QuizRush — Trivia Challenge Game
   APIs:
     - https://api-faa.my.id/faa/asahotak       (soal, jawaban)
     - https://api-faa.my.id/faa/lengkapikalimat (pertanyaan, jawaban)
   ============================================================ */

const MODES = [
    {
        key: 'asahotak',
        label: 'Asah Otak',
        sub: 'Trivia umum',
        tier: 2,
        url: 'https://api-faa.my.id/faa/asahotak',
        getQuestion: (data) => data.soal,
        getAnswer: (data) => data.jawaban,
    },
    {
        key: 'lengkapikalimat',
        label: 'Lengkapi Kalimat',
        sub: 'Peribahasa & pantun',
        tier: 3,
        url: 'https://api-faa.my.id/faa/lengkapikalimat',
        getQuestion: (data) => data.pertanyaan,
        getAnswer: (data) => data.jawaban,
    },
];

const QUESTION_TIME_MS = 20000; // 20 detik per soal
const BASE_BONUS = 100;
const STREAK_BONUS_STEP = 10; // tiap streak naik, bonus nambah dikit

const STORAGE_SCORE = 'quizrush_score';
const STORAGE_STREAK = 'quizrush_best_streak';

// ============================================================
// DOM REFS
// ============================================================
const scoreValue = document.getElementById('scoreValue');
const levelGrid = document.getElementById('levelGrid');
const streakCard = document.getElementById('streakCard');
const streakValue = document.getElementById('streakValue');

const viewSelect = document.getElementById('viewSelect');
const viewPlay = document.getElementById('viewPlay');
const btnQuit = document.getElementById('btnQuit');
const levelBadge = document.getElementById('levelBadge');

const timerFill = document.getElementById('timerFill');
const timerLabel = document.getElementById('timerLabel');
const questionCard = document.getElementById('questionCard');
const questionExpr = document.getElementById('questionExpr');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const feedbackBanner = document.getElementById('feedbackBanner');
const loadingState = document.getElementById('loadingState');

// ============================================================
// STATE
// ============================================================
let score = parseInt(localStorage.getItem(STORAGE_SCORE), 10) || 0;
let bestStreak = parseInt(localStorage.getItem(STORAGE_STREAK), 10) || 0;
let currentStreak = 0;
let currentMode = null;
let currentAnswer = null;
let timerInterval = null;
let timerStart = 0;
let answered = false;

function updateScoreUI() { scoreValue.textContent = score.toLocaleString('id-ID'); }
function saveScore() { localStorage.setItem(STORAGE_SCORE, String(score)); }
function saveBestStreak() { localStorage.setItem(STORAGE_STREAK, String(bestStreak)); }

// ============================================================
// MODE SELECT VIEW
// ============================================================
function renderLevelGrid() {
    levelGrid.innerHTML = '';
    MODES.forEach(mode => {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.dataset.tier = mode.tier;
        btn.innerHTML = `<span class="level-name">${mode.label}</span><span class="level-sub">${mode.sub}</span>`;
        btn.addEventListener('click', () => startMode(mode));
        levelGrid.appendChild(btn);
    });

    if (bestStreak > 0) {
        streakCard.style.display = 'flex';
        streakValue.textContent = bestStreak;
    }
}

// ============================================================
// GAMEPLAY
// ============================================================
function startMode(mode) {
    currentMode = mode;
    currentStreak = 0;
    viewSelect.style.display = 'none';
    viewPlay.style.display = 'flex';
    levelBadge.textContent = mode.label;
    loadQuestion();
}

function quitToSelect() {
    clearInterval(timerInterval);
    viewPlay.style.display = 'none';
    viewSelect.style.display = 'flex';
    renderLevelGrid();
}
btnQuit.addEventListener('click', quitToSelect);

async function loadQuestion() {
    answered = false;
    feedbackBanner.style.display = 'none';
    questionCard.style.display = 'none';
    answerForm.style.display = 'none';
    loadingState.style.display = 'flex';
    answerInput.value = '';
    clearInterval(timerInterval);
    document.querySelectorAll('.btn-next').forEach(b => b.remove());

    try {
        const res = await fetch(currentMode.url);
        if (!res.ok) throw new Error(`Server balas HTTP ${res.status}`);
        const json = await res.json();
        if (!json.status || !json.result) throw new Error(json.message || 'Response API gak sesuai format yang diharapkan');

        const data = json.result;
        questionExpr.textContent = currentMode.getQuestion(data);
        currentAnswer = currentMode.getAnswer(data);

        loadingState.style.display = 'none';
        questionCard.style.display = 'flex';
        answerForm.style.display = 'flex';
        answerInput.focus();

        startTimer(QUESTION_TIME_MS);
    } catch (err) {
        console.error('[QuizRush] Gagal ambil soal:', err);
        loadingState.style.display = 'none';

        const isCorsLike = err instanceof TypeError;
        const detail = isCorsLike
            ? 'Kemungkinan diblokir CORS oleh server API — cek tab Console DevTools buat mastiin.'
            : `Detail: ${err.message}`;

        feedbackBanner.className = 'feedback-banner wrong';
        feedbackBanner.innerHTML = `<div>Gagal ambil soal dari server.</div><div style="font-size:10.5px;opacity:.8;margin-top:6px;font-weight:500;">${detail}</div>`;
        feedbackBanner.style.display = 'block';

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn-next';
        retryBtn.textContent = 'Coba Lagi';
        retryBtn.addEventListener('click', () => { retryBtn.remove(); loadQuestion(); }, { once: true });
        feedbackBanner.after(retryBtn);
    }
}

function formatTimeLabel(ms) {
    const totalSec = Math.ceil(ms / 1000);
    return `${totalSec}s`;
}

function startTimer(durationMs) {
    timerStart = Date.now();
    timerFill.classList.remove('warn', 'danger');
    timerFill.style.width = '100%';
    timerLabel.textContent = formatTimeLabel(durationMs);

    timerInterval = setInterval(() => {
        const elapsed = Date.now() - timerStart;
        const remaining = Math.max(0, durationMs - elapsed);
        const pct = (remaining / durationMs) * 100;
        timerFill.style.width = pct + '%';
        timerLabel.textContent = formatTimeLabel(remaining);

        timerFill.classList.toggle('warn', pct <= 40 && pct > 15);
        timerFill.classList.toggle('danger', pct <= 15);

        if (remaining <= 0) {
            clearInterval(timerInterval);
            if (!answered) handleTimeout();
        }
    }, 100);
}

function handleTimeout() {
    answered = true;
    currentStreak = 0;
    showFeedback(false, `Waktu habis! Jawabannya "${currentAnswer}"`);
}

answerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (answered) return;
    checkAnswer();
});

function normalizeText(str) {
    return String(str)
        .toLowerCase()
        .trim()
        .replace(/[.,!?'"()-]/g, '')
        .replace(/\s+/g, ' ');
}

function checkAnswer() {
    const userVal = answerInput.value.trim();
    if (!userVal) return;

    answered = true;
    clearInterval(timerInterval);

    const isCorrect = normalizeText(userVal) === normalizeText(currentAnswer);

    if (isCorrect) {
        currentStreak++;
        const bonus = BASE_BONUS + (currentStreak - 1) * STREAK_BONUS_STEP;
        score += bonus;
        if (currentStreak > bestStreak) { bestStreak = currentStreak; saveBestStreak(); }
        saveScore();
        updateScoreUI();
        showFeedback(true, `Benar! +${bonus.toLocaleString('id-ID')} poin · Streak ${currentStreak}🔥`);
    } else {
        currentStreak = 0;
        showFeedback(false, `Kurang tepat. Jawabannya "${currentAnswer}"`);
    }
}

function showFeedback(isCorrect, message) {
    feedbackBanner.className = `feedback-banner ${isCorrect ? 'correct' : 'wrong'}`;
    feedbackBanner.textContent = message;
    feedbackBanner.style.display = 'block';
    answerForm.style.display = 'none';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-next';
    nextBtn.textContent = 'Soal Berikutnya →';
    nextBtn.addEventListener('click', () => {
        nextBtn.remove();
        loadQuestion();
    }, { once: true });
    feedbackBanner.after(nextBtn);
}

// ============================================================
// INIT
// ============================================================
updateScoreUI();
renderLevelGrid();
