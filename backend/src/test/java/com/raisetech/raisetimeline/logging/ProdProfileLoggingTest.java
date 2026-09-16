package com.raisetech.raisetimeline.logging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * 本番プロファイル（{@code prod}）のログ出力を確認する。INFOレベル・JSON形式
 * （Logstash構造化ログ）に切り替わることを検証する。
 *
 * <p>{@link LocalProfileLoggingTest} と別クラスに分けている理由はそちらのJavadoc参照。
 */
@Tag("requiresIsolatedJvm")
@ExtendWith(OutputCaptureExtension.class)
@SpringBootTest
@ActiveProfiles({"test", "prod"})
class ProdProfileLoggingTest {

    private static final Logger log = LoggerFactory.getLogger(ProdProfileLoggingTest.class);

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
