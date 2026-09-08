package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.RefreshToken;
import com.raisetech.raisetimeline.support.MapperTestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * {@link RefreshTokenMapper} のテスト。
 *
 * <p><strong>有効期限の判定はこの Mapper では行っていない。</strong>
 * {@code findByToken} の SQL に期限の条件は無く、期限切れでもそのまま返る。
 * 期限を見て弾くのは Service 層の役目であり、その責任分担が変わっていないことを
 * テストとして残しておく（SQL に条件を足したつもりで Service 側の判定を消す、という取り違えを防ぐため）。</p>
 */
class RefreshTokenMapperTest extends MapperTestSupport {

    @Autowired
    private RefreshTokenMapper refreshTokenMapper;

    private RefreshToken newToken(long userId, String token, LocalDateTime expiresAt) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUserId(userId);
        refreshToken.setToken(token);
        refreshToken.setExpiresAt(expiresAt);
        return refreshToken;
    }

    @Test
    @DisplayName("insert: 登録するとDBが採番したIDがオブジェクトに書き戻される（useGeneratedKeys）")
    void insertWritesGeneratedIdBackToObject() {
        long userId = insertUser("rt1");
        RefreshToken token = newToken(userId, "token-1", LocalDateTime.now().plusDays(14));
        assertThat(token.getId()).isNull();

        refreshTokenMapper.insert(token);

        assertThat(token.getId()).isNotNull();
    }

    @Test
    @DisplayName("findByToken: 登録した内容がそのまま取得できる（有効期限も秒まで保持される）")
    void findByTokenReturnsStoredValues() {
        long userId = insertUser("rt2");
        // ナノ秒まで入れると DB の TIMESTAMP の精度で丸められ、比較が不安定になるため秒単位で作る
        LocalDateTime expiresAt = LocalDateTime.of(2026, 9, 20, 12, 34, 56);
        refreshTokenMapper.insert(newToken(userId, "token-2", expiresAt));

        RefreshToken found = refreshTokenMapper.findByToken("token-2").orElseThrow();

        assertThat(found.getUserId()).isEqualTo(userId);
        assertThat(found.getToken()).isEqualTo("token-2");
        assertThat(found.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    @DisplayName("findByToken: 存在しないトークンなら空を返す（例外は投げない）")
    void findByTokenReturnsEmptyForUnknownToken() {
        assertThat(refreshTokenMapper.findByToken("存在しないトークン")).isEmpty();
    }

    @Test
    @DisplayName("findByToken: 有効期限が切れていてもレコードは返る（期限の判定はService層の責務）")
    void findByTokenReturnsExpiredTokenAsWell() {
        long userId = insertUser("rt3");
        LocalDateTime alreadyExpired = LocalDateTime.of(2020, 1, 1, 0, 0, 0);
        refreshTokenMapper.insert(newToken(userId, "expired-token", alreadyExpired));

        // SQL に期限の条件が無いことを、あえて明示的に確認する。
        // ここが空になるようなら、SQL に条件が足された＝責任分担が変わったということ
        assertThat(refreshTokenMapper.findByToken("expired-token")).isPresent();
    }

    @Test
    @DisplayName("deleteByToken: 削除するとfindByTokenが空を返す（ログアウト時に使う）")
    void deleteByTokenRemovesToken() {
        long userId = insertUser("rt4");
        refreshTokenMapper.insert(newToken(userId, "token-4", LocalDateTime.now().plusDays(14)));

        refreshTokenMapper.deleteByToken("token-4");

        assertThat(refreshTokenMapper.findByToken("token-4")).isEmpty();
    }

    @Test
    @DisplayName("deleteByToken: 存在しないトークンを削除しても例外にならない（冪等）")
    void deleteByTokenIsIdempotent() {
        assertThatCode(() -> refreshTokenMapper.deleteByToken("存在しないトークン"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("deleteByToken: 他のトークンは消さない（同じユーザーの別デバイス分を巻き込まない）")
    void deleteByTokenRemovesOnlyTargetToken() {
        long userId = insertUser("rt5");
        refreshTokenMapper.insert(newToken(userId, "device-a", LocalDateTime.now().plusDays(14)));
        refreshTokenMapper.insert(newToken(userId, "device-b", LocalDateTime.now().plusDays(14)));

        refreshTokenMapper.deleteByToken("device-a");

        assertThat(refreshTokenMapper.findByToken("device-a")).isEmpty();
        assertThat(refreshTokenMapper.findByToken("device-b")).isPresent();
    }

    @Test
    @DisplayName("同じトークン文字列は二重に登録できない（uk_refresh_tokens_token）")
    void tokenMustBeUnique() {
        long userId = insertUser("rt6");
        refreshTokenMapper.insert(newToken(userId, "duplicated", LocalDateTime.now().plusDays(14)));

        assertThatThrownBy(() ->
                refreshTokenMapper.insert(newToken(userId, "duplicated", LocalDateTime.now().plusDays(14))))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("ユーザーを削除すると、そのユーザーのトークンも一緒に消える（ON DELETE CASCADE）")
    void tokensAreDeletedWithUser() {
        long userId = insertUser("rt7");
        refreshTokenMapper.insert(newToken(userId, "token-7", LocalDateTime.now().plusDays(14)));

        jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);

        assertThat(refreshTokenMapper.findByToken("token-7")).isEmpty();
    }
}
