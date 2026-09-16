package com.raisetech.raisetimeline.logging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ログレベル・構造化ログの設定がプロファイルごとに正しく切り替わることを確認する。
 *
 * <p>ローカル開発（プロファイル指定なし相当の {@code test}）は人間が読みやすいDEBUGレベルの
 * コンソール出力、本番（{@code prod}）はINFOレベル・JSON形式（Logstash構造化ログ）という
 * 前提を、実際に {@code application.yml} / {@code application-prod.yml} を読み込んで検証する。
 *
 * <p><strong>{@code requiresIsolatedJvm} タグを付けて他のテストと別JVMで実行する。</strong>
 * ロギングの実体（Logback の {@code LoggerContext}）はJVM内で1つの共有状態であり、
 * 他のテストクラスが先に {@code test} プロファイルでログシステムを初期化した後だと、
 * このクラスが {@code test,prod} で起動してもJSON構造化の設定が再適用されない
 * （同一JVM内で全テストと一緒に実行すると失敗することを実機で確認済み）。
 * {@code build.gradle} の {@code structuredLoggingTest} タスクが専用JVMで実行する。
 */
@Tag("requiresIsolatedJvm")
@ExtendWith(OutputCaptureExtension.class)
class StructuredLoggingConfigTest {

    private static final Logger log =
            LoggerFactory.getLogger("com.raisetech.raisetimeline.logging.StructuredLoggingConfigTest");

    @Nested
    @SpringBootTest
    @ActiveProfiles("test")
    class ローカル開発時 {

        @Test
        void DEBUGログが出力される(CapturedOutput output) {
            log.debug("デバッグメッセージ-ローカル確認用");

            assertThat(output).contains("デバッグメッセージ-ローカル確認用");
        }
    }

    @Nested
    @SpringBootTest
    @ActiveProfiles({"test", "prod"})
    class 本番プロファイル時 {

        @Test
        void DEBUGログは出力されない(CapturedOutput output) {
            log.debug("デバッグメッセージ-本番確認用");

            assertThat(output).doesNotContain("デバッグメッセージ-本番確認用");
        }

        @Test
        void INFOログがJSON形式で構造化されて出力される(CapturedOutput output) throws Exception {
            log.info("JSON構造化確認用メッセージ");

            String line = output.getOut().lines()
                    .filter(l -> l.contains("JSON構造化確認用メッセージ"))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("対象のログ行が出力されていない"));

            JsonNode json = new ObjectMapper().readTree(line);
            assertThat(json.has("level")).isTrue();
            assertThat(json.has("message")).isTrue();
            assertThat(json.has("logger_name")).isTrue();
        }
    }
}
