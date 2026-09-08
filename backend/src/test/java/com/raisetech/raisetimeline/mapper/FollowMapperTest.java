package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.FollowUserDetail;
import com.raisetech.raisetimeline.support.MapperTestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * {@link FollowMapper} のテスト。
 *
 * <p>フォローは「誰が誰を」の向きを間違えやすい。
 * {@code selectFollowing}（自分がフォローしている人）と {@code selectFollowers}（自分をフォローしている人）は
 * JOIN する列と WHERE 句が逆になっており、取り違えても<strong>件数だけ見ていると気づけない</strong>。
 * そのため、向きが分かる非対称なデータ（片思いの関係）を作って確認する。</p>
 */
class FollowMapperTest extends MapperTestSupport {

    @Autowired
    private FollowMapper followMapper;

    @Test
    @DisplayName("insertIgnoreDuplicate: フォローすると exists が true になりフォロワー数が1増える")
    void insertRegistersFollow() {
        long followerId = insertUser("fol1a");
        long followingId = insertUser("fol1b");

        followMapper.insertIgnoreDuplicate(followerId, followingId);

        assertThat(followMapper.exists(followerId, followingId)).isTrue();
        assertThat(followMapper.countFollowers(followingId)).isEqualTo(1);
    }

    @Test
    @DisplayName("insertIgnoreDuplicate: 同じ相手を2回フォローしても例外にならずフォロワー数は1のまま（ON CONFLICT DO NOTHING）")
    void insertIsIdempotent() {
        long followerId = insertUser("fol2a");
        long followingId = insertUser("fol2b");
        followMapper.insertIgnoreDuplicate(followerId, followingId);

        // ユニーク制約 uk_follows に違反する2回目。ON CONFLICT DO NOTHING が無ければ例外が飛ぶ
        assertThatCode(() -> followMapper.insertIgnoreDuplicate(followerId, followingId))
                .doesNotThrowAnyException();

        assertThat(followMapper.countFollowers(followingId)).isEqualTo(1);
    }

    @Test
    @DisplayName("insertIgnoreDuplicate: 自分自身をフォローしようとするとDBのCHECK制約で拒否される（最後の砦）")
    void selfFollowIsRejectedByCheckConstraint() {
        long userId = insertUser("fol3");

        // ck_follows_not_self に違反する。ON CONFLICT DO NOTHING は一意制約違反しか無害化しないため、
        // CHECK 制約違反はここで例外になる。
        // 一次防衛は Service 層で、これはそこをすり抜けた場合に備えた最後の砦
        assertThatThrownBy(() -> followMapper.insertIgnoreDuplicate(userId, userId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("delete: フォローを解除すると exists が false になりフォロワー数が0になる")
    void deleteRemovesFollow() {
        long followerId = insertUser("fol4a");
        long followingId = insertUser("fol4b");
        insertFollow(followerId, followingId);

        followMapper.delete(followerId, followingId);

        assertThat(followMapper.exists(followerId, followingId)).isFalse();
        assertThat(followMapper.countFollowers(followingId)).isZero();
    }

    @Test
    @DisplayName("delete: フォローしていない相手を解除しても例外にならない（冪等）")
    void deleteIsIdempotentWhenNotFollowing() {
        long followerId = insertUser("fol5a");
        long followingId = insertUser("fol5b");

        assertThatCode(() -> followMapper.delete(followerId, followingId)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("exists: フォローの向きを区別する（AがBをフォローしていても、BはAをフォローしていない）")
    void existsIsDirectional() {
        long followerId = insertUser("fol6a");
        long followingId = insertUser("fol6b");
        insertFollow(followerId, followingId);

        assertThat(followMapper.exists(followerId, followingId)).isTrue();
        assertThat(followMapper.exists(followingId, followerId)).isFalse();
    }

    @Test
    @DisplayName("countFollowers: 誰にもフォローされていないユーザーは0を返す")
    void countFollowersReturnsZero() {
        long userId = insertUser("fol7");

        assertThat(followMapper.countFollowers(userId)).isZero();
    }

    @Test
    @DisplayName("selectFollowing: 自分がフォローしている人だけを返す（フォローされている人は含めない）")
    void selectFollowingReturnsOnlyFollowedUsers() {
        long meId = insertUser("fol8me");
        long followedId = insertUser("fol8out");
        long followerId = insertUser("fol8in");
        insertFollow(meId, followedId);   // 自分 → 相手
        insertFollow(followerId, meId);   // 相手 → 自分（向きが逆。含まれてはいけない）

        List<FollowUserDetail> following = followMapper.selectFollowing(meId, meId);

        assertThat(following).extracting(FollowUserDetail::getUsername)
                .containsExactly("fol8out");
    }

    @Test
    @DisplayName("selectFollowers: 自分をフォローしている人だけを返す（自分がフォローしている人は含めない）")
    void selectFollowersReturnsOnlyFollowingUsers() {
        long meId = insertUser("fol9me");
        long followedId = insertUser("fol9out");
        long followerId = insertUser("fol9in");
        insertFollow(meId, followedId);
        insertFollow(followerId, meId);

        List<FollowUserDetail> followers = followMapper.selectFollowers(meId, meId);

        assertThat(followers).extracting(FollowUserDetail::getUsername)
                .containsExactly("fol9in");
    }

    @Test
    @DisplayName("selectFollowers: followedByMe は閲覧者から見た関係を表す（相互フォローなら true、片思いされているだけなら false）")
    void followedByMeReflectsViewerRelation() {
        long meId = insertUser("fol10me");
        long mutualId = insertUser("fol10mut");
        long oneWayId = insertUser("fol10one");
        // 相互フォロー
        insertFollow(mutualId, meId);
        insertFollow(meId, mutualId);
        // 片思い（相手→自分のみ）
        insertFollow(oneWayId, meId);

        List<FollowUserDetail> followers = followMapper.selectFollowers(meId, meId);

        assertThat(followers)
                .filteredOn(user -> user.getUsername().equals("fol10mut"))
                .singleElement()
                .extracting(FollowUserDetail::isFollowedByMe)
                .isEqualTo(true);
        assertThat(followers)
                .filteredOn(user -> user.getUsername().equals("fol10one"))
                .singleElement()
                .extracting(FollowUserDetail::isFollowedByMe)
                .isEqualTo(false);
    }

    @Test
    @DisplayName("selectFollowing: 誰もフォローしていなければ空のリストを返す（nullではない）")
    void selectFollowingReturnsEmptyList() {
        long userId = insertUser("fol11");

        assertThat(followMapper.selectFollowing(userId, userId)).isEmpty();
    }

    @Test
    @DisplayName("ユーザーを削除すると、そのユーザーのフォロー関係も一緒に消える（ON DELETE CASCADE）")
    void followsAreDeletedWithUser() {
        long followerId = insertUser("fol12a");
        long followingId = insertUser("fol12b");
        insertFollow(followerId, followingId);

        jdbcTemplate.update("DELETE FROM users WHERE id = ?", followerId);

        assertThat(followMapper.countFollowers(followingId)).isZero();
    }
}
