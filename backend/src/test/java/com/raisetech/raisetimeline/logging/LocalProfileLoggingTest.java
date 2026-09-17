package com.raisetech.raisetimeline.logging;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ローカル開発（プロファイル指定なし相当の {@code test}）のログ出力を確認する。
 * 人間が読みやすいDEBUGレベルのコンソール出力で、MDCの相関ID（requestId）もパターンに
 * 組み込まれて表示されることを検証する。
 *
 * <p><strong>{@link ProdProfileLoggingTest} とは別のトップレベルクラスに分けている。</strong>
 * ロギングの実体（Logback の {@code LoggerContext}）はJVM内で1つの共有状態のため、
 * 同一クラスの {@code @Nested} で「ローカル用」「本番用」を分けても、同じJVM内で
 * 2つの {@code @SpringBootTest} が起動する以上、実行順序によっては本番プロファイル側の
 * JSON化がこちらに引き継がれてしまう（テスト実行順序に依存する形でRedにもGreenにも
 * なりうる不安定な状態を実機で確認済み）。別クラスに分け、{@code build.gradle} の
 * {@code structuredLoggingTest} タスクで {@code forkEvery = 1} を指定し、
 * クラスごとに新しいJVMで実行することで確実に分離する。
 */
@Tag("requiresIsolatedJvm")
@ExtendWith(OutputCaptureExtension.class)
@SpringBootTest
@ActiveProfiles("test")
class LocalProfileLoggingTest {

    private static final Logger log = LoggerFactory.getLogger(LocalProfileLoggingTest.class);

    @Test
    void DEBUGログが出力される(CapturedOutput output) {
        log.debug("デバッグメッセージ-ローカル確認用");

        assertThat(output).contains("デバッグメッセージ-ローカル確認用");
    }

    @Test
    void MDCに積んだrequestIdがコンソール出力に含まれる(CapturedOutput output) {
        // MDCに値を積むだけでは人間可読なコンソール出力には表示されない。
        // application.yml の logging.pattern.level で明示的に組み込む必要があり、
        // その設定が効いていることをここで確認する（RequestIdFilterが実際に積む値と
        // 同じキー "requestId" を使う）
        MDC.put("requestId", "test-request-id-12345");
        try {
            log.info("MDC確認用メッセージ");
        } finally {
            MDC.remove("requestId");
        }

        assertThat(output).contains("test-request-id-12345");
    }

    @Test
    void MDCに積んだuserIdがコンソール出力に含まれる(CapturedOutput output) {
        // requestId と同じ理由でパターンへの明示的な組み込みが必要。
        // JwtAuthenticationFilter が積むキー "userId" と一致させる
        MDC.put("userId", "777");
        try {
            log.info("MDC-userId確認用メッセージ");
        } finally {
            MDC.remove("userId");
        }

        assertThat(output).contains("[userId:777]");
    }
}
