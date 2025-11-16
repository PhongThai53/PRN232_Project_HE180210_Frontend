// js/examHistory.js
const BACKEND_ORIGIN = 'https://localhost:7108';

export class ExamHistoryModule {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl;
        this.containerId = config.containerId ?? "main-container";
        this.exams = [];
        this.filteredExams = [];
    }

    getElement(selector) {
        return document.querySelector(selector);
    }

    formatDateTime(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDuration(seconds) {
        if (!seconds || seconds === 0) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}p ${secs}s`;
    }

    calculateStats() {
        const total = this.exams.length;
        const completed = this.exams.filter(e => e.score !== null).length;
        const passed = this.exams.filter(e => e.result && e.result.includes('Passed')).length;
        const failed = this.exams.filter(e => e.result && e.result.includes('Failed')).length;
        const incomplete = this.exams.filter(e => e.score === null).length;

        return { total, completed, passed, failed, incomplete };
    }

    renderStats() {
        const stats = this.calculateStats();
        const container = this.getElement('#statsSummary');
        if (!container) return;

        container.innerHTML = `
            <div class="stat-card">
                <h3>${stats.total}</h3>
                <p>Tổng số bài thi</p>
            </div>
            <div class="stat-card completed">
                <h3>${stats.completed}</h3>
                <p>Đã hoàn thành</p>
            </div>
            <div class="stat-card success">
                <h3>${stats.passed}</h3>
                <p>Đạt yêu cầu</p>
            </div>
            <div class="stat-card failed">
                <h3>${stats.failed}</h3>
                <p>Chưa đạt</p>
            </div>
        `;
    }

    async loadExams() {
        try {
            const token = sessionStorage.getItem('authToken');
            if (!token) {
                throw new Error('Chưa đăng nhập!');
            }

            const res = await fetch(this.apiUrl, {
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
            console.log('Exam history:', payload);

            if (payload.succeeded) {
                this.exams = payload.data || [];
                this.filteredExams = [...this.exams];
                this.renderStats();
                this.sortExams('newest');
            } else {
                throw new Error(payload.message || 'Không thể tải lịch sử');
            }

        } catch (err) {
            console.error('Load exams error:', err);
            const container = this.getElement('#examListContainer');
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

    filterExams(status) {
        if (status === 'all') {
            this.filteredExams = [...this.exams];
        } else if (status === 'completed') {
            this.filteredExams = this.exams.filter(e => e.score !== null);
        } else if (status === 'incomplete') {
            this.filteredExams = this.exams.filter(e => e.score === null);
        }
        this.renderExamList();
    }

    sortExams(sortType) {
        switch (sortType) {
            case 'newest':
                this.filteredExams.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
                break;
            case 'oldest':
                this.filteredExams.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
                break;
            case 'highest':
                this.filteredExams.sort((a, b) => (b.score || 0) - (a.score || 0));
                break;
            case 'lowest':
                this.filteredExams.sort((a, b) => (a.score || 0) - (b.score || 0));
                break;
        }
        this.renderExamList();
    }

    renderExamList() {
        const container = this.getElement('#examListContainer');
        if (!container) return;

        if (this.filteredExams.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#999;">Không có bài thi nào</p>';
            return;
        }

        container.innerHTML = this.filteredExams.map(exam => {
            const isCompleted = exam.score !== null;
            const isPassed = exam.result && exam.result.toLowerCase().includes('passed');
            const isFailed = exam.result && exam.result.toLowerCase().includes('failed');

            let cardClass = 'exam-card';
            if (isCompleted) {
                cardClass += isPassed ? ' completed' : ' failed';
            } else {
                cardClass += ' incomplete';
            }

            let scoreClass = 'pending';
            let scoreText = 'Chưa nộp';
            if (isCompleted) {
                scoreClass = isPassed ? 'pass' : 'fail';
                scoreText = `${exam.score}/25`;
            }

            return `
            <div class="${cardClass}">
                <div class="exam-id">#${exam.examId}</div>
                
                <div class="exam-details">
                    <h3>
                        <span class="badge ${exam.mode.toLowerCase()}">${exam.mode === 'Trial' ? 'Bài thi thử' : 'Bài chính thức'}</span>
                        ${isCompleted
                    ? `<span class="badge ${isCompleted ? 'completed' : 'incomplete'}">${isCompleted ? 'Hoàn thành' : 'Chưa nộp'}</span>`
                    : '<span class="badge incomplete">Chưa nộp</span>'
                }
                    </h3>
                    
                    <div class="meta">
                        <span>
                            📅 ${this.formatDateTime(exam.startedAt)}
                        </span>
                        ${exam.duration > 0 ? `
                            <span>
                                ⏱️ ${this.formatDuration(exam.duration)}
                            </span>
                        ` : ''}
                        <span>
                            ⏰ Giới hạn: ${exam.timeLimitMinutes} phút
                        </span>
                    </div>

                    ${exam.result ? `
                        <div style="margin-top:8px; font-size:0.9rem;">
                            <strong>Kết quả:</strong> ${exam.result}
                        </div>
                    ` : ''}
                </div>
                
                <div class="exam-score">
                    <p class="score-number ${scoreClass}">${scoreText}</p>
                    <p class="score-label">
                        ${isCompleted
                    ? (isPassed ? '✓ ĐẠT' : '✗ CHƯA ĐẠT')
                    : '⏳ Chưa nộp'
                }
                    </p>
                    
                    <div class="exam-actions" style="margin-top:12px;">
                        <a href="ExamDetail.html?examId=${exam.examId}" class="btn primary" style="font-size:0.85rem; padding:6px 12px; text-decoration:none; display:inline-block;">
                            Xem chi tiết
                        </a>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    attachHandlers() {
        // Status filter
        const statusRadios = document.querySelectorAll('input[name="statusFilter"]');
        statusRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.filterExams(e.target.value);
            });
        });

        // Sort
        const sortSelect = this.getElement('#sortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortExams(e.target.value);
            });
        }
    }

    async init() {
        this.attachHandlers();
        await this.loadExams();
    }
}