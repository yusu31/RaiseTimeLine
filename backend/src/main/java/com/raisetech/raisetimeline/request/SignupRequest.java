package com.raisetech.raisetimeline.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank(message = "ユーザー名を入力してください")
        @Size(min = 4, max = 15, message = "ユーザー名は4〜15文字で入力してください")
        @Pattern(regexp = "^[A-Za-z0-9_]+$", message = "ユーザー名は英数字とアンダースコアのみ使用できます")
        String username,
        @NotBlank @Size(max = 50) String displayName,
        @NotBlank @Size(min = 8, max = 72) String password
) {
}
