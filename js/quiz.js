// js/quiz.js
import { QuestionResponse } from '../model/QuestionResponse.js';

const BACKEND_ORIGIN = 'https://localhost:7108';

export class QuizModule {

    constructor(config = {}) {
        this.apiUrl = config.apiUrl;
        this.containerId = config.containerId ?? "main-container";

        this.questions = [];
        this.state = {
            currentIndex: 0,
            answer: [], 
            marked: new Set(),
            submited: false
        };
    }

    // ================= Helpers =================
    getElement(selector) {
        return document.querySelector(selector);
    }

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

    // ================= Render Grid =================
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

            return `<div class="${cls}" data-idx="${idx}" tabindex="0">${this.escapeHtml(q.questionId)}</div>`;
        }).join('');
    }

    // ================= Render Question =================
    renderQuestion() {
        const q = this.questions[this.state.currentIndex];
        if (!q) return;

        const title = this.getElement('#questionTitle');
        const text = this.getElement('#questionText');
        const imgContainer = this.getElement('#questionImg');
        const form = this.getElement('#optionsForm');
        const explanation = this.getElement('#questionExplanation');

        if (title) title.textContent = `Câu hỏi ${q.questionId}`;
        if (text) text.textContent = q.content ?? '';
        if (imgContainer) {
            imgContainer.style.cssText = 'width:100%;height:240px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8f8f8;';
            if (q.imageUrl) {
                imgContainer.innerHTML = `<img src="${this.escapeHtml(q.imageUrl)}" alt="Hình câu ${this.escapeHtml(String(q.questionId))}" loading="lazy" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">`;
            } else {
                imgContainer.textContent = '[ Hình (blank) ]';
            }
        }

        if (form) {
            form.innerHTML = q.options.map(opt => `
                <label class="option">
                    <input type="radio" name="opt" value="${opt.choice}">
                    <span>${opt.content}</span>
                </label>
            `).join('');

            const savedOption = this.state.answer.find(a => a.questionId === q.questionId)?.selectedOption;
            if (savedOption && savedOption !== "None") {
                const input = form.querySelector(`input[value="${CSS.escape(savedOption)}"]`);
                if (input) input.checked = true;
            }
        }

        if (this.state.submited === true) {
            explanation.innerHTML = `<div class="question-explanation" id="questionExplanation">Giải Thích ${this.escapeHtml(q.explanation)}</div>`;
        }
       
    }


    // ================= Navigation =================
    goTo(idx) {
        if (idx < 0 || idx >= this.questions.length) return;
        this.state.currentIndex = idx;
        this.renderQuestion();
        this.renderGrid();
        console.log("State after navigating:", JSON.stringify(this.state, null, 2));
    }

    // ================= Show Result =================
    showResults() {
        let correctCount = 0;
        const answersArr = this.state?.answer ?? this.answer ?? [];

        // chuẩn hóa: lọc null/undefined và build map questionId -> answer
        const answerMap = new Map();
        answersArr.filter(Boolean).forEach((a, i) => {
            // lấy ưu tiên id từ nhiều tên có thể dùng
            const qid = String(a.questionId ?? a.qId ?? a.id ?? '').trim();
            if (qid) answerMap.set(qid, a);
            else {
                // nếu không có questionId, lưu theo index (chỉ dùng nếu không có id)
                answerMap.set(`__idx_${i}`, a);
            }
        });

        // reset results object
        this.state.results = {};

        this.questions.forEach((q, idx) => {
            const qid = String(q.questionId ?? q.id ?? q.qId ?? '').trim();

            let userAns = null;
            if (qid && answerMap.has(qid)) {
                userAns = answerMap.get(qid);
            } else if (answerMap.has(`__idx_${idx}`)) {
                userAns = answerMap.get(`__idx_${idx}`);
            } else {
                userAns = null;
            }

            const selected = userAns?.selectedOption ?? userAns?.selected ?? userAns?.choice ?? null;
            const correct = userAns?.choice ?? q.choice ?? q.correctChoice ?? q.correct ?? null;

            const isCorrect = (selected !== null && selected !== undefined) &&
                (correct !== null && correct !== undefined) &&
                String(selected) === String(correct);

            if (isCorrect) correctCount++;

            this.state.results[idx] = { selected, correct, isCorrect };

            const gridCell = document.querySelector(`#qGrid [data-idx="${idx}"]`);
            if (gridCell) {
                gridCell.classList.remove('correct', 'wrong');
                if (selected !== null && selected !== undefined) {
                    gridCell.classList.add(isCorrect ? 'correct' : 'wrong');
                }
            }

            if (this.state.currentIndex === idx) {
                const form = this.getElement('#optionsForm');
                if (form) {
                    const labels = Array.from(form.querySelectorAll('label.option, label.option-row'));
                    labels.forEach(lbl => {
                        lbl.classList.remove('correct', 'wrong');
                        const input = lbl.querySelector('input[name="opt"], input[name="option"]');
                        const choice = input ? input.value : lbl.dataset.choice;
                        if (choice != null && correct != null && String(choice) === String(correct)) {
                            lbl.classList.add('correct');
                        }
                        if (selected != null && choice != null && String(choice) === String(selected) && String(selected) !== String(correct)) {
                            lbl.classList.add('wrong');
                        }
                    });
                }
            }
        });

        const box = this.getElement('#resultBox');
        if (box) {
            box.style.display = 'block';
            box.textContent = `Số câu đúng: ${correctCount} / ${this.questions.length}`;
        }

        this.state.submited = true;
    }

    // ================= Event Handlers =================
    attachHandlers() {
        const grid = this.getElement('#qGrid');
        const form = this.getElement('#optionsForm');
        const nextBtn = this.getElement('#nextBtn');
        const prevBtn = this.getElement('#prevBtn');
        const markBtn = this.getElement('#markBtn');
        const resetBtn = this.getElement('#resetBtn');
        const submitBtn = this.getElement('#submitBtn');

        // click grid
        if (grid) {
            grid.addEventListener('click', e => {
                if (!e.target.classList.contains('q-num')) return;
                this.goTo(Number(e.target.dataset.idx));
            });
        }

        // radio select
        if (form) {
            form.addEventListener('change', e => {
                if (e.target.name !== 'opt') return;
                const question = this.questions[this.state.currentIndex];
                const qId = question.questionId;
                const idx = this.state.answer.findIndex(a => a.questionId === qId);
                if (idx >= 0) {
                    this.state.answer[idx].selectedOption = e.target.value;
                } else {
                    this.state.answer.push({
                        questionId: qId,
                        selectedOption: e.target.value,
                        correctAnswer: question.choice
                    });
                }
                this.renderGrid();
                console.log("State after selecting answer:", JSON.stringify(this.state, null, 2));
            });
        }

        // navigation buttons
        if (nextBtn) nextBtn.addEventListener('click', () => this.goTo(this.state.currentIndex + 1));
        if (prevBtn) prevBtn.addEventListener('click', () => this.goTo(this.state.currentIndex - 1));

        if (markBtn) markBtn.addEventListener('click', () => {
            const i = this.state.currentIndex;
            this.state.marked.has(i) ? this.state.marked.delete(i) : this.state.marked.add(i);
            this.renderGrid();
        });

        if (resetBtn) resetBtn.addEventListener('click', () => {
            if (!confirm("Làm lại?")) return;
            this.state = { currentIndex: 0, answer: [], marked: new Set() };
            this.renderQuestion();
            this.renderGrid();
        });


        if (submitBtn) submitBtn.addEventListener('click', () => {
            if (!confirm('Nộp bài?')) return;
            const box = this.getElement('#resultBox');
            // Result
            this.showResults();
            this.renderQuestion();
        });

        // keyboard
        document.addEventListener('keydown', (e) => {
            const activeTag = document.activeElement.tagName;
            if (['INPUT', 'TEXTAREA'].includes(activeTag)) return;
            if (e.key === 'ArrowRight') this.goTo(this.state.currentIndex + 1);
            if (e.key === 'ArrowLeft') this.goTo(this.state.currentIndex - 1);
        });
    }

    // ================= Load Quiz =================
    async loadQuiz() {
        try {
            const res = await fetch(this.apiUrl, { headers: { 'Accept': 'application/json' } });
            const payload = await res.json();
            const data = Array.isArray(payload) ? payload : (payload.data ?? payload.Data ?? []);
            this.questions = data.map(d => this.mapRawToQuestion(d));

            if (!this.questions.length) {
                const container = this.getElement(`#${this.containerId}`);
                if (container) container.innerHTML += "<p>Không có câu hỏi.</p>";
                return;
            }

            this.renderQuestion();
            this.renderGrid();
            this.attachHandlers();

        } catch (err) {
            console.error("Lỗi tải:", err);
            const container = this.getElement(`#${this.containerId}`);
            if (container) container.innerHTML += "<p>Lỗi tải câu hỏi.</p>";
        }
    }

    // ================= Init =================
    async init() {
        await this.loadQuiz();
    }
}