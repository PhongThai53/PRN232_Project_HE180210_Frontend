const BACKEND_ORIGIN = 'https://localhost:7108';

export class AdminQuestionsModule {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl;
        this.containerId = config.containerId ?? "main-container";
        this.questions = [];
        this.editingQuestionId = null;
        this.optionCount = 2; // Bắt đầu với 2 đáp án
    }

    getElement(selector) {
        return document.querySelector(selector);
    }

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
        );
    }

    choiceToLetter(num) {
        return ['A', 'B', 'C', 'D'][num] || 'A';
    }

    letterToChoice(letter) {
        return ['A', 'B', 'C', 'D'].indexOf(letter.toUpperCase());
    }

    async loadQuestions() {
        try {
            const token = sessionStorage.getItem('authToken');
            if (!token) throw new Error('Chưa đăng nhập!');

            const res = await fetch(this.apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const payload = await res.json();
            if (payload.succeeded) {
                this.questions = payload.data || [];
                this.renderTable();
            }
        } catch (err) {
            console.error('Load error:', err);
            alert('Không thể tải danh sách câu hỏi');
        }
    }

    renderTable() {
        const tbody = this.getElement('#questionsTableBody');
        if (!tbody) return;

        if (this.questions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">Chưa có câu hỏi</td></tr>';
            return;
        }

        tbody.innerHTML = this.questions.map(q => {
            const choiceLetter = typeof q.choice === 'number'
                ? this.choiceToLetter(q.choice)
                : q.choice;

            return `
            <tr>
                <td>${q.questionId}</td>
                <td>
                    ${this.escapeHtml(q.content).substring(0, 80)}${q.content.length > 80 ? '...' : ''}
                    ${q.imageUrl ? '<br><small>📷 Có ảnh</small>' : ''}
                </td>
                <td>
                    <span class="badge ${q.isCritical ? 'critical' : ''}">${q.isCritical ? 'Liệt' : 'Thường'}</span>
                </td>
                <td style="text-align:center; font-weight:bold;">${choiceLetter}</td>
                <td>
                    <button class="btn ghost" onclick="adminModule.editQuestion(${q.questionId})" 
                            style="padding:4px 8px; font-size:0.85rem;">✏️</button>
                    <button class="btn ghost" onclick="adminModule.deleteQuestion(${q.questionId})" 
                            style="padding:4px 8px; font-size:0.85rem; color:#dc3545;">🗑️</button>
                </td>
            </tr>
        `;
        }).join('');
    }

    showModal(questionId = null) {
        const modal = this.getElement('#questionModal');
        const title = this.getElement('#modalTitle');
        const form = this.getElement('#questionForm');

        this.editingQuestionId = questionId;

        if (questionId) {
            title.textContent = 'Sửa câu hỏi';
            const q = this.questions.find(x => x.questionId === questionId);
            if (q) {
                this.getElement('#questionContent').value = q.content;
                this.getElement('#questionExplanation').value = q.explanation || '';
                this.getElement('#isCritical').checked = q.isCritical;

                const choiceLetter = typeof q.choice === 'number'
                    ? this.choiceToLetter(q.choice)
                    : q.choice;
                this.getElement('#correctAnswer').value = choiceLetter;

                if (q.imageUrl) {
                    this.getElement('#imagePreview').innerHTML =
                        `<img src="${BACKEND_ORIGIN}${q.imageUrl}" style="max-width:200px; border:1px solid #ddd; border-radius:4px;">`;
                }

                this.optionCount = q.options.length;
                this.renderOptions(q.options);
                this.updateCorrectAnswerOptions();
            }
        } else {
            title.textContent = 'Thêm câu hỏi';
            form.reset();
            this.getElement('#imagePreview').innerHTML = '';
            this.optionCount = 2;
            this.renderOptions([
                { choice: 'A', content: '' },
                { choice: 'B', content: '' }
            ]);
            this.updateCorrectAnswerOptions();
        }

        modal.style.display = 'flex';
    }

    closeModal() {
        this.getElement('#questionModal').style.display = 'none';
        this.editingQuestionId = null;
        this.optionCount = 2;
    }

    renderOptions(options = []) {
        const container = this.getElement('#optionsContainer');
        container.innerHTML = options.map((opt, idx) => {
            const letter = ['A', 'B', 'C', 'D', 'E', 'F'][idx]; // Hỗ trợ tối đa 6 đáp án
            const choiceLetter = typeof opt.choice === 'number'
                ? this.choiceToLetter(opt.choice)
                : (opt.choice || letter);

            // Chỉ cho phép xóa nếu có > 2 đáp án
            const showDeleteBtn = options.length > 2;

            return `
            <div class="option-item" data-index="${idx}">
                <span style="width:30px; padding:8px; font-weight:600;">${letter}</span>
                <input type="text" data-choice="${letter}" value="${this.escapeHtml(opt.content)}" 
                       placeholder="Nội dung đáp án ${letter}" required>
                ${opt.optionId ? `<input type="hidden" data-option-id="${opt.optionId}">` : ''}
                ${showDeleteBtn ? `<button type="button" class="btn-remove-option" data-index="${idx}" 
                    style="padding:4px 8px; color:#dc3545; border:1px solid #dc3545; border-radius:4px; background:white; cursor:pointer;">✕</button>` : ''}
            </div>
        `;
        }).join('');

        // Attach remove handlers
        const removeButtons = container.querySelectorAll('.btn-remove-option');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeOption(index);
            });
        });
    }

    addOption() {
        if (this.optionCount >= 6) {
            alert('Tối đa 6 đáp án!');
            return;
        }

        const container = this.getElement('#optionsContainer');
        const currentOptions = this.getCurrentOptions();

        const letter = ['A', 'B', 'C', 'D', 'E', 'F'][this.optionCount];
        currentOptions.push({ choice: letter, content: '' });

        this.optionCount++;
        this.renderOptions(currentOptions);
        this.updateCorrectAnswerOptions();
    }

    removeOption(index) {
        if (this.optionCount <= 2) {
            alert('Phải có ít nhất 2 đáp án!');
            return;
        }

        const currentOptions = this.getCurrentOptions();
        currentOptions.splice(index, 1);

        this.optionCount--;
        this.renderOptions(currentOptions);
        this.updateCorrectAnswerOptions();
    }

    getCurrentOptions() {
        const optionInputs = document.querySelectorAll('.option-item input[type="text"]');
        return Array.from(optionInputs).map((input, idx) => {
            const letter = ['A', 'B', 'C', 'D', 'E', 'F'][idx];
            const optionIdInput = input.parentElement.querySelector('input[type="hidden"]');
            return {
                optionId: optionIdInput ? parseInt(optionIdInput.dataset.optionId) : null,
                choice: letter,
                content: input.value
            };
        });
    }

    updateCorrectAnswerOptions() {
        const select = this.getElement('#correctAnswer');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">Chọn đáp án</option>';

        for (let i = 0; i < this.optionCount; i++) {
            const letter = ['A', 'B', 'C', 'D', 'E', 'F'][i];
            const option = document.createElement('option');
            option.value = letter;
            option.textContent = letter;
            if (letter === currentValue) option.selected = true;
            select.appendChild(option);
        }
    }

    async saveQuestion(formData) {
        try {
            const token = sessionStorage.getItem('authToken');
            const method = this.editingQuestionId ? 'PUT' : 'POST';
            const url = this.editingQuestionId ? `${this.apiUrl}/${this.editingQuestionId}` : this.apiUrl;

            const res = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include',
                body: formData
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const result = await res.json();
            if (result.succeeded) {
                alert(this.editingQuestionId ? 'Cập nhật thành công!' : 'Thêm thành công!');
                this.closeModal();
                await this.loadQuestions();
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            console.error('Save error:', err);
            alert('Lỗi: ' + err.message);
        }
    }

    async deleteQuestion(questionId) {
        if (!confirm('Bạn có chắc muốn xóa?')) return;

        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${this.apiUrl}/${questionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            alert('Xóa thành công!');
            await this.loadQuestions();
        } catch (err) {
            console.error('Delete error:', err);
            alert('Lỗi khi xóa: ' + err.message);
        }
    }

    editQuestion(questionId) {
        this.showModal(questionId);
    }

    attachHandlers() {
        // Add button
        this.getElement('#addQuestionBtn')?.addEventListener('click', () => this.showModal());

        // Refresh
        this.getElement('#refreshBtn')?.addEventListener('click', () => this.loadQuestions());

        // Close modal
        this.getElement('#closeModal')?.addEventListener('click', () => this.closeModal());
        this.getElement('#cancelBtn')?.addEventListener('click', () => this.closeModal());

        // Add option button
        this.getElement('#addOptionBtn')?.addEventListener('click', () => this.addOption());

        // Search
        this.getElement('#searchInput')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = this.questions.filter(q => q.content.toLowerCase().includes(term));
            const tbody = this.getElement('#questionsTableBody');
            tbody.innerHTML = filtered.map(q => {
                const choiceLetter = typeof q.choice === 'number'
                    ? this.choiceToLetter(q.choice)
                    : q.choice;

                return `
                <tr>
                    <td>${q.questionId}</td>
                    <td>${this.escapeHtml(q.content).substring(0, 80)}</td>
                    <td><span class="badge ${q.isCritical ? 'critical' : ''}">${q.isCritical ? 'Liệt' : 'Thường'}</span></td>
                    <td style="text-align:center;">${choiceLetter}</td>
                    <td>
                        <button class="btn ghost" onclick="adminModule.editQuestion(${q.questionId})">✏️</button>
                        <button class="btn ghost" onclick="adminModule.deleteQuestion(${q.questionId})">🗑️</button>
                    </td>
                </tr>
            `;
            }).join('');
        });

        // Form submit
        this.getElement('#questionForm')?.addEventListener('submit', (e) => {
            e.preventDefault();

            const optionInputs = document.querySelectorAll('.option-item input[type="text"]');
            const correctAnswerLetter = this.getElement('#correctAnswer').value;

            if (!correctAnswerLetter) {
                alert('Vui lòng chọn đáp án đúng!');
                return;
            }

            const options = Array.from(optionInputs).map((input, idx) => {
                const letter = ['A', 'B', 'C', 'D', 'E', 'F'][idx];
                const optionIdInput = input.parentElement.querySelector('input[type="hidden"]');

                return {
                    optionId: optionIdInput ? parseInt(optionIdInput.dataset.optionId) : null,
                    choice: letter,
                    content: input.value,
                    isCorrect: letter === correctAnswerLetter,
                    displayOrder: idx + 1
                };
            });

            const data = {
                content: this.getElement('#questionContent').value,
                explanation: this.getElement('#questionExplanation').value,
                isCritical: this.getElement('#isCritical').checked,
                choice: correctAnswerLetter,
                options: options
            };

            const formData = new FormData();
            formData.append('data', JSON.stringify(data));

            const imageFile = this.getElement('#questionImage').files[0];
            if (imageFile) {
                formData.append('image', imageFile);
            }

            this.saveQuestion(formData);
        });

        // Image preview
        this.getElement('#questionImage')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.getElement('#imagePreview').innerHTML =
                        `<img src="${ev.target.result}" style="max-width:200px; border:1px solid #ddd; border-radius:4px;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    async init() {
        window.adminModule = this;
        this.attachHandlers();
        await this.loadQuestions();
    }
}