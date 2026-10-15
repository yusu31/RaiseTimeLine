package com.raisetech.raisetimeline.config;

import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        // HS256の署名鍵は256bit（32文字）以上が必要。
        // 環境変数が渡されず "${JWT_SECRET}" という文字列のまま読み込まれた場合（13文字）も、ここで起動を止める
        @Size(min = 32, message = "JWT署名鍵は32文字以上が必要です。環境変数 JWT_SECRET が渡されているか確認してください")
        String secret,
        Duration accessTokenValidity,
        Duration refreshTokenValidity
) {
}
