package com.raisetech.raisetimeline.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link SearchKeyword} のテスト。DBもSpringも使わない、入力と戻り値だけの検証。
 *
 * <p>ここで防いでいるのは SQLインジェクションではない（MyBatis の {@code #{}} を使う限り起きない）。
 * 防いでいるのは「SQLは壊れないが検索の意味が壊れる」問題で、
 * エスケープしないと {@code %} 1文字の検索が全件に一致してしまう。</p>
 */
class SearchKeywordTest {

    private final SearchKeyword searchKeyword = new SearchKeyword();

    @ParameterizedTest(name = "[{index}] 入力 \"{0}\" は空文字を返す")
    @NullSource
    @ValueSource(strings = {"", " ", "   \t  "})
    @DisplayName("検索すべきでない入力（null・空文字・半角スペースのみ）は空文字を返す")
    void returnsEmptyForBlankInput(String input) {
        // 呼び出し側は「空文字かどうか」だけを見て、DBに問い合わせないと判断できる
        assertThat(searchKeyword.normalize(input)).isEmpty();
    }

    @Test
    @DisplayName("【現状の挙動】全角スペースだけの入力は空にならず、検索語として扱われる")
    void fullWidthSpaceIsNotTreatedAsBlank() {
        // 実装が使っている String#trim() は U+0020 以下の文字しか取り除かないため、
        // 全角スペース（U+3000）は残る。結果として ILIKE '%　%' で検索が実行される。
        // 半角スペースは空扱いなのに全角は違う、という不揃いな状態。
        // 直すなら trim() を strip()（Unicode対応版）に替えるだけだが、
        // 本番の振る舞いが変わる修正なので、テスト追加とは別に対応する。
        // このテストは「今どうなっているか」を記録したもので、望ましい仕様を表したものではない
        assertThat(searchKeyword.normalize("　")).isEqualTo("　");
    }

    @Test
    @DisplayName("前後の空白は取り除く（「 鈴木 」で検索しても見つかるようにするため）")
    void trimsSurroundingWhitespace() {
        assertThat(searchKeyword.normalize("  鈴木  ")).isEqualTo("鈴木");
    }

    @Test
    @DisplayName("エスケープが必要な文字を含まなければ、そのまま返す")
    void returnsInputAsIsWhenNothingToEscape() {
        assertThat(searchKeyword.normalize("鈴木")).isEqualTo("鈴木");
    }

    @Test
    @DisplayName("% は \\% にする（エスケープしないと全件に一致してしまうため）")
    void escapesPercent() {
        assertThat(searchKeyword.normalize("%")).isEqualTo("\\%");
        assertThat(searchKeyword.normalize("50%off")).isEqualTo("50\\%off");
    }

    @Test
    @DisplayName("_ は \\_ にする（LIKE では任意の1文字を表す記号のため）")
    void escapesUnderscore() {
        assertThat(searchKeyword.normalize("_")).isEqualTo("\\_");
        assertThat(searchKeyword.normalize("user_name")).isEqualTo("user\\_name");
    }

    @Test
    @DisplayName("バックスラッシュは \\\\ にする（エスケープ文字そのものを打ち消すため）")
    void escapesBackslash() {
        assertThat(searchKeyword.normalize("\\")).isEqualTo("\\\\");
    }

    @Test
    @DisplayName("バックスラッシュと % が混ざっていても、二重にエスケープされない（置換の順序の検証）")
    void escapesBackslashBeforeWildcards() {
        // 入力: \%（2文字）
        // 正しい順序（\ を先に処理）: \% → \\% → \\\%
        // 誤った順序（% を先に処理）だと、% を \% にした直後にその \ まで置換され意味が壊れる
        assertThat(searchKeyword.normalize("\\%")).isEqualTo("\\\\\\%");
    }

    @Test
    @DisplayName("エスケープ対象の文字だけの入力でも、空文字にはならない（% は有効な検索語）")
    void wildcardOnlyInputIsNotTreatedAsBlank() {
        assertThat(searchKeyword.normalize("%")).isNotEmpty();
    }
}
