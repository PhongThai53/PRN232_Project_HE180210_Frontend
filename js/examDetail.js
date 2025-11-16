// js/examDetail.js
const BACKEND_ORIGIN = 'https://localhost:7108';

export class ExamDetailModule {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl;
        this.examId = config.examId;
        this.containerId = config.containerId ?? "main-container";
        this.examData = null;
        this.answers = [];
        this.currentIndex = 0;
    }

    getElement(selector) {
        return document.querySelector(selector);
    }

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
        );
    }

    formatDateTime(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleString('vi-VN');
    }

    formatDuration(minutes) {
        if (!minutes || minutes === 0) return 'N/A';
        const mins = Math.floor(minutes);
        const secs = Math.floor((minutes - mins) * 60);
        return `${mins}p ${secs}s`;
    }

    async loadExamDetail() {
        try {
            const token = sessionStorage.getItem('authToken');
            if (!token) {
                throw new Error('Chưa đăng nhập!');
            }

            const res = await fetch(`${this.apiUrl}/${this.examId}/result`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!res.ok) {
                if (res.status === 401) {
                    sessionStorage.removeItem('authToken');
                    throw new Error('Hết phiên đăng nhập!');
                }
                throw new Error(`HTTP ${res.status}`);
            }

            const payload = await res.json();
            console.log('Exam detail:', payload);

            if (payload.succeeded) {
                this.examData = payload.data;
                this.answers = payload.data.answers || [];
                this.renderExamInfo();
                this.renderGrid();
                this.renderQuestion();
            } else {
                throw new Error(payload.message || 'Không thể tải chi tiết bài thi');
            }

        } catch (err) {
            console.error('Load exam detail error:', err);
            const container = this.getElement(`#${this.containerId}`);
            if (container) {
                container.innerHTML = `
                    <p style="color:red; text-align:center;">
                        ${err.message}
                        ${err.message.includes('đăng nhập') ? '<br><a href="index.html">Đăng nhập ngay</a>' : ''}
                    </p>
                `;
            }
        }
    }

    renderExamInfo() {
        const info = this.getElement('#examInfo');
        if (!info || !this.examData) return;

        const exam = this.examData;
        const totalQuestions = this.answers.length;
        const correctCount = this.answers.filter(a => a.isCorrect).length;
        const percentage = totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(2) : 0;
        const isPassed = percentage >= 80;

        info.innerHTML = `
            <h2>Bài thi #${exam.examId} - ${exam.mode === 'Trial' ? 'Bài thi thử' : 'Bài thi chính thức'}</h2>
            
            <div class="exam-info-grid">
                <div class="exam-info-item">
                    <strong>Điểm số</strong>
                    <span>${exam.score !== null ? exam.score : correctCount}/${totalQuestions}</span>
                </div>
                
                <div class="exam-info-item">
                    <strong>Tỷ lệ đúng</strong>
                    <span>${percentage}%</span>
                </div>
                
                <div class="exam-info-item">
                    <strong>Kết quả</strong>
                    <span>${isPassed ? '✓ ĐẠT' : '✗ CHƯA ĐẠT'}</span>
                </div>
                
                <div class="exam-info-item">
                    <strong>Thời gian làm bài</strong>
                    <span>${this.formatDuration(exam.durationMinutes)}</span>
                </div>
                
                <div class="exam-info-item">
                    <strong>Bắt đầu</strong>
                    <span style="font-size:0.9rem;">${this.formatDateTime(exam.startedAt)}</span>
                </div>
                
                <div class="exam-info-item">
                    <strong>Kết thúc</strong>
                    <span style="font-size:0.9rem;">${this.formatDateTime(exam.completedAt)}</span>
                </div>
            </div>
        `;
    }

    renderGrid() {
        const grid = this.getElement('#qGrid');
        if (!grid) return;

        grid.innerHTML = this.answers.map((ans, idx) => {
            const cls = [
                'q-num',
                idx === this.currentIndex ? 'current' : '',
                ans.isCorrect ? 'correct' : 'wrong'
            ].filter(Boolean).join(' ');

            return `<div class="${cls}" data-idx="${idx}" tabindex="0">${idx + 1}</div>`;
        }).join('');
    }

    renderQuestion() {
        const ans = this.answers[this.currentIndex];
        if (!ans) return;

        const title = this.getElement('#questionTitle');
        const text = this.getElement('#questionText');
        const imgContainer = this.getElement('#questionImg');
        const form = this.getElement('#optionsForm');
        const explanation = this.getElement('#questionExplanation');

        if (title) title.textContent = `Câu ${this.currentIndex + 1}:`;
        if (text) text.textContent = ans.questionContent ?? '';

        // Render image (nếu có)
        if (imgContainer) {
            const hasImage = ans.options && ans.options.some(opt => opt.imageUrl);
            if (hasImage) {
                imgContainer.style.display = 'flex';
                const imgOption = ans.options.find(opt => opt.imageUrl);
                imgContainer.innerHTML = `<img src="${BACKEND_ORIGIN}/${imgOption.imageUrl.replace(/^\/+/, '')}" alt="Hình câu ${this.currentIndex + 1}">`;
            } else {
                imgContainer.style.display = 'none';
                imgContainer.innerHTML = '';
            }
        }

        // Render options
        if (form) {
            // Tìm đáp án đã chọn
            const selectedOption = ans.options.find(opt =>
                opt.displayOrder === ans.options.findIndex(o => !o.isCorrect) + 1 &&
                !ans.isCorrect
            );

            form.innerHTML = ans.options.map((opt, idx) => {
                const choiceLetter = String.fromCharCode(65 + idx); // A, B, C, D...
                const isCorrectOption = opt.isCorrect;
                const isSelectedWrong = !ans.isCorrect && !isCorrectOption && opt.displayOrder === 1; // Logic để xác định đáp án sai đã chọn

                let optClass = 'option';
                if (isCorrectOption) optClass += ' correct';
                else if (isSelectedWrong && choiceLetter !== ans.correctOptionChoice) optClass += ' wrong';

                return `
                    <label class="${optClass}">
                        <input type="radio" name="opt" value="${choiceLetter}" 
                               ${isCorrectOption || isSelectedWrong ? 'checked' : ''} disabled>
                        <span><strong>${choiceLetter}.</strong> ${this.escapeHtml(opt.content)}</span>
                    </label>
                `;
            }).join('');
        }

        // Render explanation
        if (explanation) {
            explanation.innerHTML = `<strong>💡 Giải thích:</strong> ${this.escapeHtml(ans.explanation)}`;
        }

        this.updateButtonsVisibility();
    }

    updateButtonsVisibility() {
        const prevBtn = this.getElement('#prevBtn');
        const nextBtn = this.getElement('#nextBtn');

        if (prevBtn) prevBtn.disabled = this.currentIndex === 0;
        if (nextBtn) nextBtn.disabled = this.currentIndex >= this.answers.length - 1;
    }

    goTo(idx) {
        if (idx < 0 || idx >= this.answers.length) return;
        this.currentIndex = idx;
        this.renderQuestion();
        this.renderGrid();
    }

    attachHandlers() {
        const grid = this.getElement('#qGrid');
        if (grid) {
            grid.addEventListener('click', e => {
                if (e.target.classList.contains('q-num')) {
                    this.goTo(Number(e.target.dataset.idx));
                }
            });
        }

        const nextBtn = this.getElement('#nextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.goTo(this.currentIndex + 1));
        }

        const prevBtn = this.getElement('#prevBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goTo(this.currentIndex - 1));
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') this.goTo(this.currentIndex + 1);
            if (e.key === 'ArrowLeft') this.goTo(this.currentIndex - 1);
        });
    }

    async init() {
        this.attachHandlers();
        await this.loadExamDetail();
    }
}