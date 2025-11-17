// js/trialQuiz.js
import { QuestionResponse } from '../model/QuestionResponse.js';

const BACKEND_ORIGIN = 'https://localhost:7108';

export class TrialModule {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl;
        this.containerId = config.containerId ?? "main-container";
        this.examId = null;
        this.questions = [];
        this.state = {
            currentIndex: 0,
            answer: [],
            marked: new Set(),
            submitted: false,
            timeRemaining: 0,
            timerInterval: null
        };
    }

    getElement(selector) { return document.querySelector(selector); }

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
        );
    }

    mapRawToQuestion(raw) {
        const rel = raw?.imageUrl ?? raw?.ImageUrl ?? null;
        const imgUrl = rel ? `${BACKEND_ORIGIN}/${String(rel).replace(/^\/+/, '')}` : null;
        return new QuestionResponse(
            raw?.questionId ?? 0,
            raw?.content ?? '',
            raw?.explanation ?? '',
            imgUrl,
            raw?.isCritical ?? false,
            raw?.choice ?? '',
            raw?.type ?? null,
            raw?.options ?? []
        );
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    updateTimerDisplay() {
        const display = this.getElement('#timerDisplay');
        if (!display) return;
        display.textContent = this.formatTime(this.state.timeRemaining);
        if (this.state.timeRemaining === 300) alert('Còn 5 phút!');
        display.style.color = this.state.timeRemaining <= 120 ? '#dc3545' : '#000';
    }

    startTimer() {
        if (this.state.timeRemaining <= 0) return;
        this.updateTimerDisplay();
        this.state.timerInterval = setInterval(() => {
            if (this.state.submitted) { this.stopTimer(); return; }
            this.state.timeRemaining--;
            this.updateTimerDisplay();
            if (this.state.timeRemaining <= 0) {
                this.stopTimer();
                alert('Hết giờ!');
                this.autoSubmit();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
    }

    async saveAnswer(questionId, selectedOption) {
        if (!this.examId) return;
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${BACKEND_ORIGIN}/api/Exam/${this.examId}/answers`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ questionId, selectedOption: selectedOption || "None" })
            });
            if (res.ok) return await res.json();
        } catch (err) {
            console.error('Save answer error:', err);
        }
    }

    async submitExam() {
        if (!this.examId) return null;
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${BACKEND_ORIGIN}/api/Exam/${this.examId}/submit`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });
            if (res.ok) return await res.json();
        } catch (err) {
            console.error('Submit error:', err);
        }
        return null;
    }

    async initializeAnswers() {
        for (const q of this.questions) {
            await this.saveAnswer(q.questionId, "None");
            this.state.answer.push({ questionId: q.questionId, selectedOption: "None", correctAnswer: q.choice });
        }
    }

    renderGrid() {
        const grid = this.getElement('#qGrid');
        if (!grid) return;
        grid.innerHTML = this.questions.map((q, idx) => {
            const answered = this.state.answer.find(a => a.questionId === q.questionId)?.selectedOption;
            const cls = [
                'q-num',
                idx === this.state.currentIndex ? 'current' : '',
                this.state.marked.has(idx) ? 'marked' : '',
                answered && answered !== "None" ? 'done' : ''
            ].filter(Boolean).join(' ');
            return `<div class="${cls}" data-idx="${idx}" tabindex="0">${idx + 1}</div>`;
        }).join('');
    }

    renderQuestion() {
        const q = this.questions[this.state.currentIndex];
        if (!q) return;

        const title = this.getElement('#questionTitle');
        const text = this.getElement('#questionText');
        const imgContainer = this.getElement('#questionImg');
        const form = this.getElement('#optionsForm');
        const explanation = this.getElement('#questionExplanation');

        if (title) title.textContent = `Câu hỏi: ${this.state.currentIndex + 1}`;
        if (text) text.textContent = q.content ?? '';

        // Render ảnh
        if (imgContainer) {
            if (q.imageUrl) {
                imgContainer.style.cssText = 'width:100%;height:240px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8f8f8;';
                imgContainer.innerHTML = `<img src="${this.escapeHtml(q.imageUrl)}" alt="Hình câu ${q.questionId}" loading="lazy" style="max-width:100%;max-height:300px;object-fit:contain;">`;
            } else {
                imgContainer.innerHTML = '';
                imgContainer.style.display = 'none';
            }
        }

        // Render options
        if (form) {
            form.innerHTML = q.options.map(opt => `
                <label class="option">
                    <input type="radio" name="opt" value="${this.escapeHtml(opt.choice)}" ${this.state.submitted ? 'disabled' : ''}>
                    <span>${opt.choice}. ${this.escapeHtml(opt.content)}</span>
                </label>
            `).join('');

            const savedOption = this.state.answer.find(a => a.questionId === q.questionId)?.selectedOption;
            if (savedOption && savedOption !== "None") {
                const input = form.querySelector(`input[value="${CSS.escape(savedOption)}"]`);
                if (input) input.checked = true;
            }
        }

        // Explanation
        if (explanation) {
            if (this.state.submitted && q.explanation) {
                explanation.hidden = false;
                explanation.innerHTML = `<strong>Giải thích:</strong> ${this.escapeHtml(q.explanation)}`;
            } else {
                explanation.hidden = true;
            }
        }

        this.updateButtonsVisibility();
    }

    updateButtonsVisibility() {
        const prevBtn = this.getElement('#prevBtn');
        const nextBtn = this.getElement('#nextBtn');
        const submitBtn = this.getElement('#submitBtn');
        const resetBtn = this.getElement('#resetBtn');
        const markBtn = this.getElement('#markBtn');

        if (prevBtn) prevBtn.disabled = this.state.currentIndex === 0 || this.state.submitted;
        if (nextBtn) nextBtn.disabled = this.state.currentIndex >= this.questions.length - 1 || this.state.submitted;
        if (submitBtn) submitBtn.style.display = this.state.submitted ? 'none' : 'inline-block';
        if (resetBtn) resetBtn.disabled = this.state.submitted;
        if (markBtn) markBtn.disabled = this.state.submitted;

        if (this.state.submitted === true) {
            nextBtn.style.display = 'none';
        }
    }

    goTo(idx) {
        if (idx < 0 || idx >= this.questions.length) return;
        this.state.currentIndex = idx;
        this.renderQuestion();
        this.renderGrid();
    }

    showResults(submitResult) {
        let correctCount = 0;
        const answerMap = new Map();
        this.state.answer.forEach(a => {
            const qid = String(a.questionId ?? '').trim();
            if (qid) answerMap.set(qid, a);
        });

        this.questions.forEach((q, idx) => {
            const userAns = answerMap.get(String(q.questionId));
            const selected = userAns?.selectedOption ?? null;
            const correct = q.choice ?? null;
            const isCorrect = selected && selected !== "None" && correct && String(selected) === String(correct);
            if (isCorrect) correctCount++;

            const gridCell = document.querySelector(`#qGrid [data-idx="${idx}"]`);
            if (gridCell && selected && selected !== "None") {
                gridCell.classList.add(isCorrect ? 'correct' : 'wrong');
            }

            if (this.state.currentIndex === idx) {
                const form = this.getElement('#optionsForm');
                if (form) {
                    form.querySelectorAll('label.option').forEach(lbl => {
                        const input = lbl.querySelector('input[name="opt"]');
                        const choice = input?.value;
                        if (choice && correct && String(choice) === String(correct)) lbl.classList.add('correct');
                        if (selected && choice && String(choice) === String(selected) && String(selected) !== String(correct)) lbl.classList.add('wrong');
                    });
                }
            }
        });

        if (submitResult?.data?.score !== undefined) correctCount = submitResult.data.score;
        const percentage = ((correctCount / this.questions.length) * 100).toFixed(2);

        const box = this.getElement('#resultBox');
        if (box) {
            box.style.display = 'block';
            box.innerHTML = `
                <div style="padding:16px;background:#f8f9fa;border-radius:8px;border-left:4px solid ${percentage >= 80 ? '#28a745' : '#dc3545'};">
                    <h3 style="margin-top:0;">Kết quả</h3>
                    <p><strong>Điểm:</strong> ${correctCount}/${this.questions.length} (${percentage}%)</p>
                    <p><strong>Trạng thái:</strong> ${percentage >= 80 ? '<span style="color:#28a745;font-weight:bold;">ĐẠT ✓</span>' : '<span style="color:#dc3545;font-weight:bold;">CHƯA ĐẠT ✗</span>'}</p>
                </div>
            `;
        }
        this.state.submitted = true;
    }

    async autoSubmit() {
        const result = await this.submitExam();
        if (result) {
            this.showResults(result);
            this.renderQuestion();
            this.renderGrid();
        }
    }

    async handleSubmitQuiz() {
        if (!confirm('Nộp bài?')) return;
        this.stopTimer();
        await this.autoSubmit();
    }

    attachHandlers() {
        const grid = this.getElement('#qGrid');
        const form = this.getElement('#optionsForm');

        if (grid) {
            grid.addEventListener('click', e => {
                if (e.target.classList.contains('q-num') && !this.state.submitted) {
                    this.goTo(Number(e.target.dataset.idx));
                }
            });
        }

        if (form) {
            form.addEventListener('change', async (e) => {
                if (e.target.name === 'opt' && !this.state.submitted) {
                    const q = this.questions[this.state.currentIndex];
                    const idx = this.state.answer.findIndex(a => a.questionId === q.questionId);
                    if (idx >= 0) this.state.answer[idx].selectedOption = e.target.value;
                    else this.state.answer.push({ questionId: q.questionId, selectedOption: e.target.value, correctAnswer: q.choice });
                    await this.saveAnswer(q.questionId, e.target.value);
                    this.renderGrid();
                }
            });
        }

        this.getElement('#nextBtn')?.addEventListener('click', () => this.goTo(this.state.currentIndex + 1));
        this.getElement('#prevBtn')?.addEventListener('click', () => this.goTo(this.state.currentIndex - 1));
        this.getElement('#markBtn')?.addEventListener('click', () => {
            if (!this.state.submitted) {
                const i = this.state.currentIndex;
                this.state.marked.has(i) ? this.state.marked.delete(i) : this.state.marked.add(i);
                this.renderGrid();
            }
        });
        this.getElement('#resetBtn')?.addEventListener('click', () => {
            if (this.state.submitted) alert('Đã nộp!');
            else if (confirm('Làm lại?')) window.location.reload();
        });
        this.getElement('#submitBtn')?.addEventListener('click', () => this.handleSubmitQuiz());
    }

    async loadQuiz() {
        try {
            const token = sessionStorage.getItem('authToken');
            if (!token) throw new Error('Chưa đăng nhập!');

            const urlParams = new URLSearchParams(window.location.search);
            const criticalCount = urlParams.get('criticalCount') || 4;
            const nonCriticalCount = urlParams.get('nonCriticalCount') || 21;

            const apiUrlWithParams = `${this.apiUrl}?criticalCount=${criticalCount}&nonCriticalCount=${nonCriticalCount}`;

            const res = await fetch(apiUrlWithParams, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({})
            });

            if (!res.ok) {
                if (res.status === 401) throw new Error('Hết phiên! Đăng nhập lại.');
                throw new Error(`HTTP ${res.status}`);
            }

            const payload = await res.json();
            if (!payload.succeeded) throw new Error(payload.message);

            const data = payload.data;
            this.examId = data.exam.examId;
            this.state.timeRemaining = data.exam.timeLimitMinutes * 60;
            this.questions = data.questions.map(d => this.mapRawToQuestion(d));

            if (!this.questions.length) throw new Error('Không có câu hỏi');

            await this.initializeAnswers();
            this.renderQuestion();
            this.renderGrid();
            this.attachHandlers();
            this.startTimer();

        } catch (err) {
            const container = this.getElement(`#${this.containerId}`);
            if (container) {
                container.innerHTML += `<p style='color:red;'>${err.message} ${err.message.includes('đăng nhập') ? '<br><a href="index.html">Đăng nhập</a>' : ''}</p>`;
            }
        }
    }

    async init() { await this.loadQuiz(); }
}