package com.raisetech.raisetimeline.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CommentCreateRequest(
        @NotBlank(message = "コメントを入力してください")
        @Size(max = 280, message = "コメントは280文字以内で入力してください")
        String content
) {
}
