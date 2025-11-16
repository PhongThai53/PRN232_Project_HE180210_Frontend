import { QuestionOptionResponse } from "./QuestionOptionResponse.js";
export class QuestionResponse {
    constructor(questionId, content, explanation, imageUrl, isCritical,choice, type, options) {
        this.questionId = questionId;
        this.content = content ?? '';
        this.explanation = explanation ?? '';
        this.imageUrl = imageUrl ?? '';
        this.isCritical = !!isCritical;
        this.choice = choice ?? '';
        this.type = type ?? '';
        this.options = (options || []).map(
            o => (o instanceof QuestionOptionResponse
                ? o
                : new QuestionOptionResponse(
                    o.optionId,
                    o.content ?? '',
                    o.choice ?? ''
                ))
        );
    }
}

