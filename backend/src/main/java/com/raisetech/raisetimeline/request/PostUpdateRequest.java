package com.raisetech.raisetimeline.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PostUpdateRequest(
        @NotBlank(message = "本文を入力してください")
        @Size(max = 280, message = "本文は280文字以内で入力してください")
        String content
) {
}
