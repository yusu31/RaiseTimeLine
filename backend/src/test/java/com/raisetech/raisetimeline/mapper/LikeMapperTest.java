package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.support.MapperTestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * {@link LikeMapper} のテスト。<strong>実際の PostgreSQL に本物のSQLを発行する。</strong>
 *
 * <p>モックで「INSERT したことにする」テストでは、SQL が正しいことの証明にならない。
 * 特に {@code ON CONFLICT (post_id, user_id) DO NOTHING} は PostgreSQL 固有の構文で、
 * 効いているかどうかは実際に2回 INSERT してみないと分からない。</p>
 */
class LikeMapperTest extends MapperTestSupport {

    @Autowired
    private LikeMapper likeMapper;

    @Test
    @DisplayName("insertIgnoreDuplicate: いいねを登録すると件数が1になり exists が true になる")
    void insertRegistersLike() {
        long userId = insertUser("like1");
        long postId = insertPost(userId, "投稿本文");

        likeMapper.insertIgnoreDuplicate(postId, userId);

        assertThat(likeMapper.countByPostId(postId)).isEqualTo(1);
        assertThat(likeMapper.exists(postId, userId)).isTrue();
    }

    @Test
    @DisplayName("insertIgnoreDuplicate: 同じ組み合わせを2回登録しても例外にならず件数は1のまま（ON CONFLICT DO NOTHING）")
    void insertIsIdempotentForSameUserAndPost() {
        long userId = insertUser("like2");
        long postId = insertPost(userId, "投稿本文");
        likeMapper.insertIgnoreDuplicate(postId, userId);

        // ユニーク制約 uk_likes_post_id_user_id に違反する2回目。
        // ON CONFLICT DO NOTHING が無ければ、ここで一意制約違反の例外が飛ぶ
        assertThatCode(() -> likeMapper.insertIgnoreDuplicate(postId, userId))
                .doesNotThrowAnyException();

        assertThat(likeMapper.countByPostId(postId)).isEqualTo(1);
    }

    @Test
    @DisplayName("insertIgnoreDuplicate: 別のユーザーがいいねすると件数は2になる（無視されるのは同一ユーザーの重複だけ）")
    void insertCountsSeparatelyForDifferentUsers() {
        long ownerId = insertUser("like3a");
        long otherId = insertUser("like3b");
        long postId = insertPost(ownerId, "投稿本文");

        likeMapper.insertIgnoreDuplicate(postId, ownerId);
        likeMapper.insertIgnoreDuplicate(postId, otherId);

        assertThat(likeMapper.countByPostId(postId)).isEqualTo(2);
        assertThat(likeMapper.exists(postId, ownerId)).isTrue();
        assertThat(likeMapper.exists(postId, otherId)).isTrue();
    }

    @Test
    @DisplayName("delete: いいねを取り消すと件数が0になり exists が false になる")
    void deleteRemovesLike() {
        long userId = insertUser("like4");
        long postId = insertPost(userId, "投稿本文");
        likeMapper.insertIgnoreDuplicate(postId, userId);

        likeMapper.delete(postId, userId);

        assertThat(likeMapper.countByPostId(postId)).isZero();
        assertThat(likeMapper.exists(postId, userId)).isFalse();
    }

    @Test
    @DisplayName("delete: いいねしていない状態で取り消しても例外にならない（冪等）")
    void deleteIsIdempotentWhenNotLiked() {
        long userId = insertUser("like5");
        long postId = insertPost(userId, "投稿本文");

        assertThatCode(() -> likeMapper.delete(postId, userId)).doesNotThrowAnyException();

        assertThat(likeMapper.countByPostId(postId)).isZero();
    }

    @Test
    @DisplayName("delete: 他人のいいねは消さない（自分の分だけを消す）")
    void deleteOnlyRemovesOwnLike() {
        long ownerId = insertUser("like6a");
        long otherId = insertUser("like6b");
        long postId = insertPost(ownerId, "投稿本文");
        insertLike(postId, ownerId);
        insertLike(postId, otherId);

        likeMapper.delete(postId, ownerId);

        assertThat(likeMapper.countByPostId(postId)).isEqualTo(1);
        assertThat(likeMapper.exists(postId, otherId)).isTrue();
    }

    @Test
    @DisplayName("countByPostId: 誰もいいねしていない投稿は0を返す")
    void countReturnsZeroForPostWithoutLikes() {
        long userId = insertUser("like7");
        long postId = insertPost(userId, "投稿本文");

        assertThat(likeMapper.countByPostId(postId)).isZero();
    }

    @Test
    @DisplayName("countByPostId: 別の投稿へのいいねは数に含めない")
    void countIsScopedToOnePost() {
        long userId = insertUser("like8");
        long targetPostId = insertPost(userId, "対象の投稿");
        long otherPostId = insertPost(userId, "別の投稿");
        insertLike(otherPostId, userId);

        assertThat(likeMapper.countByPostId(targetPostId)).isZero();
        assertThat(likeMapper.countByPostId(otherPostId)).isEqualTo(1);
    }

    @Test
    @DisplayName("exists: 他人のいいねは自分のいいねとして扱わない")
    void existsDistinguishesUsers() {
        long ownerId = insertUser("like9a");
        long otherId = insertUser("like9b");
        long postId = insertPost(ownerId, "投稿本文");
        insertLike(postId, otherId);

        assertThat(likeMapper.exists(postId, otherId)).isTrue();
        assertThat(likeMapper.exists(postId, ownerId)).isFalse();
    }

    @Test
    @DisplayName("投稿を削除すると、紐づくいいねも一緒に消える（外部キーの ON DELETE CASCADE）")
    void likesAreDeletedWithPost() {
        long userId = insertUser("like10");
        long postId = insertPost(userId, "投稿本文");
        insertLike(postId, userId);

        jdbcTemplate.update("DELETE FROM posts WHERE id = ?", postId);

        assertThat(likeMapper.countByPostId(postId)).isZero();
    }
}
