package com.raisetech.raisetimeline.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 本番プロファイル（{@code prod}）でJWT署名鍵が必ず外部から渡されることを確認する。
 *
 * <p>{@code application.yml} の既定値は公開リポジトリ上の値なので、本番で環境変数 JWT_SECRET を
 * 渡し忘れたときに、その値のまま黙って起動してはいけない。起動を止めて気づけるようにする。
 *
 * <p>アプリ全体（DB接続など）を起動すると「鍵以外の理由で失敗した」ケースと区別できないため、
 * {@link JwtProperties} の読み込みだけを取り出して検証する。
 * なお、実行するPCに環境変数 JWT_SECRET が設定されていると「渡し忘れ」を再現できない。
 */
class JwtSecretProdProfileTest {

    @Configuration
    @EnableConfigurationProperties(JwtProperties.class)
    static class JwtPropertiesOnly {
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withUserConfiguration(JwtPropertiesOnly.class)
            .withPropertyValues("spring.profiles.active=prod");

    @Test
    void 環境変数JWT_SECRETが無いと起動に失敗する() {
        runner.run(context -> assertThat(context).hasFailed());
    }

    @Test
    void 環境変数JWT_SECRETが渡されればその値で起動する() {
        String secret = "prod-secret-from-secrets-manager-32chars!";

        runner.withPropertyValues("JWT_SECRET=" + secret).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(JwtProperties.class).secret()).isEqualTo(secret);
        });
    }
}
