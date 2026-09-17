package com.raisetech.raisetimeline.security;

import com.raisetech.raisetimeline.config.JwtProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    private static final String SECRET = "test-only-secret-key-for-jwt-signing-32chars";

    private final JwtProperties properties = new JwtProperties(SECRET, Duration.ofMinutes(30), Duration.ofDays(14));
    private final JwtTokenProvider provider = new JwtTokenProvider(properties);

    @Test
    void 生成したトークンを検証するとユーザー情報が復元できる() {
        AuthenticatedUser user = new AuthenticatedUser(1L, "suzuki@example.com", "鈴木");

        String token = provider.generateAccessToken(user);
        Optional<AuthenticatedUser> result = provider.validateAndGetUser(token);

        assertThat(result).isPresent();
        assertThat(result.get().id()).isEqualTo(1L);
        assertThat(result.get().email()).isEqualTo("suzuki@example.com");
        assertThat(result.get().displayName()).isEqualTo("鈴木");
    }

    @Test
    void 期限切れトークンは拒否される() {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Date past = new Date(System.currentTimeMillis() - 60_000);
        String expiredToken = Jwts.builder()
                .subject("1")
                .issuedAt(new Date(past.getTime() - 1000))
                .expiration(past)
                .signWith(key)
                .compact();

        Optional<AuthenticatedUser> result = provider.validateAndGetUser(expiredToken);

        assertThat(result).isEmpty();
    }

    @Test
    void 改ざんされたトークンは拒否される() {
        AuthenticatedUser user = new AuthenticatedUser(1L, "suzuki@example.com", "鈴木");
        String token = provider.generateAccessToken(user);
        // 署名部分（最後の "." 以降）の【先頭】1文字を書き換える。
        // 以前は末尾1文字を書き換えていたが、Base64url の末尾文字は下位2ビットが意味を持たない詰め物のため、
        // 末尾が a/b/c/d 等のときは書き換え前と同じ署名にデコードされて検証が通ってしまい、
        // 発行時刻次第で約6%の確率で落ちるフレーキーテストになっていた（Issue #99）。
        // 先頭文字は上位6ビットをそのまま担うので、書き換えれば必ず署名が変わる
        int signatureStart = token.lastIndexOf('.') + 1;
        char first = token.charAt(signatureStart);
        String tampered = token.substring(0, signatureStart)
                + (first == 'a' ? 'b' : 'a')
                + token.substring(signatureStart + 1);

        Optional<AuthenticatedUser> result = provider.validateAndGetUser(tampered);

        assertThat(result).isEmpty();
    }
}
