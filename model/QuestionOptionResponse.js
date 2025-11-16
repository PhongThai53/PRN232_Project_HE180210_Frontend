export class QuestionOptionResponse {
    constructor(optionId, content, choice) {
        this.optionId = optionId;
        this.content = content ?? '';
        this.choice = choice ?? '';
    }
}