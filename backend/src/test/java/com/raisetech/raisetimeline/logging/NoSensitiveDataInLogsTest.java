package com.raisetech.raisetimeline.logging;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ログ出力の引数に機密情報（パスワード・トークン・シークレット）を渡していないかを
 * 静的にチェックする。
 *
 * <p>実装漏れは動かしてみても気付けない（本番で実際に該当パスを踏むまで発覚しない）ため、
 * ソースコードを直接走査する。ArchUnit等のライブラリは使わず、標準の {@link Files#walk}
 * と正規表現だけで実装する（このチェックのためだけに新しい依存を増やす必要はないため）。
 *
 * <p>1行のログ呼び出しのみを検出対象とする（現時点の実装はすべて1行で書かれている）。
 * 将来ログ呼び出しが複数行にわたる場合はこの検出をすり抜けるため、その限界を認識しておく。
 */
class NoSensitiveDataInLogsTest {

    private static final Pattern LOG_CALL = Pattern.compile("log\\.(info|warn|error|debug)\\s*\\(");
    private static final Pattern SENSITIVE_IDENTIFIER = Pattern.compile("(?i)password|token|secret");

    @Test
    void ログ呼び出しの引数に機密情報を示す識別子が含まれていない() throws IOException {
        Path mainJavaDir = Paths.get("src/main/java");
        List<String> violations;

        try (Stream<Path> paths = Files.walk(mainJavaDir)) {
            violations = paths
                    .filter(path -> path.toString().endsWith(".java"))
                    .flatMap(this::findViolations)
                    .toList();
        }

        assertThat(violations).isEmpty();
    }

    private Stream<String> findViolations(Path javaFile) {
        List<String> lines;
        try {
            lines = Files.readAllLines(javaFile);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        return java.util.stream.IntStream.range(0, lines.size())
                .filter(i -> LOG_CALL.matcher(lines.get(i)).find())
                .filter(i -> SENSITIVE_IDENTIFIER.matcher(lines.get(i)).find())
                .mapToObj(i -> javaFile + ":" + (i + 1) + " " + lines.get(i).trim());
    }
}
