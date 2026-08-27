package com.raisetech.raisetimeline.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * プロフィール（テキスト項目）の更新リクエスト。
 * アイコン画像は multipart で送る必要があるため、このリクエストには含めず
 * {@code POST /api/users/me/icon} で別途アップロードする。
 */
public record ProfileUpdateRequest(
        @NotBlank(message = "表示名を入力してください")
        @Size(max = 50, message = "表示名は50文字以内で入力してください")
        String displayName,

        @NotBlank(message = "ユーザー名を入力してください")
        @Size(min = 4, max = 15, message = "ユーザー名は4〜15文字で入力してください")
        @Pattern(regexp = "^[A-Za-z0-9_]+$", message = "ユーザー名は英数字とアンダースコアのみ使用できます")
        String username,

        // 自己紹介は未入力を許すため @NotBlank は付けない
        @Size(max = 160, message = "自己紹介は160文字以内で入力してください")
        String bio
) {
}
