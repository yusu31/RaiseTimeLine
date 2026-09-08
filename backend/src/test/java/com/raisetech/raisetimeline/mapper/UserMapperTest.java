package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.User;
import com.raisetech.raisetimeline.domain.UserProfileDetail;
import com.raisetech.raisetimeline.support.MapperTestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link UserMapper} のテスト。
 *
 * <p>検索は {@code ILIKE}（PostgreSQL の「大文字小文字を区別しない LIKE」）を使っている。
 * 大文字小文字を無視することも、ワイルドカード {@code %} を文字として扱えることも、
 * <strong>実際に SQL を発行しないと確かめられない</strong>ため、ここで確認する。</p>
 */
class UserMapperTest extends MapperTestSupport {

    @Autowired
    private UserMapper userMapper;

    /** username と displayName を別々に指定してユーザーを作る（検索の検証用）。 */
    private void insertUserWithDisplayName(String username, String displayName) {
        jdbcTemplate.update("""
                INSERT INTO users (display_name, email, password_hash, username)
                VALUES (?, ?, 'dummy-hash', ?)
                """, displayName, username + "@example.com", username);
    }

    @Test
    @DisplayName("insert: 登録するとDBが採番したIDがオブジェクトに書き戻される（useGeneratedKeys）")
    void insertWritesGeneratedIdBackToObject() {
        User user = new User();
        user.setUsername("usr1");
        user.setDisplayName("鈴木");
        user.setEmail("usr1@example.com");
        user.setPasswordHash("dummy-hash");
        assertThat(user.getId()).isNull();

        userMapper.insert(user);

        assertThat(user.getId()).isNotNull();
        assertThat(userMapper.findById(user.getId())).isPresent();
    }

    @Nested
    @DisplayName("1件取得")
    class FindOne {

        @Test
        @DisplayName("findByEmail: 登録したメールアドレスで取得できる")
        void findByEmailReturnsUser() {
            insertUser("usr2");

            User found = userMapper.findByEmail("usr2@example.com").orElseThrow();

            assertThat(found.getUsername()).isEqualTo("usr2");
            assertThat(found.getPasswordHash()).isEqualTo("dummy-hash");
        }

        @Test
        @DisplayName("findByEmail: 存在しないメールアドレスなら空を返す（ログイン失敗の判定に使う）")
        void findByEmailReturnsEmptyForUnknownEmail() {
            assertThat(userMapper.findByEmail("unknown@example.com")).isEmpty();
        }

        @Test
        @DisplayName("findByUsername: @ユーザー名で取得できる")
        void findByUsernameReturnsUser() {
            insertUser("usr3");

            assertThat(userMapper.findByUsername("usr3")).isPresent();
        }

        @Test
        @DisplayName("findByUsername: 存在しない@ユーザー名なら空を返す")
        void findByUsernameReturnsEmptyForUnknownName() {
            assertThat(userMapper.findByUsername("unknown")).isEmpty();
        }

        @Test
        @DisplayName("findById: 存在しないIDなら空を返す")
        void findByIdReturnsEmptyForUnknownId() {
            assertThat(userMapper.findById(999999L)).isEmpty();
        }
    }

    @Nested
    @DisplayName("ユーザー検索（ILIKE）")
    class SearchByKeyword {

        @Test
        @DisplayName("@ユーザー名の一部で検索できる（中間一致）")
        void matchesPartOfUsername() {
            insertUserWithDisplayName("suzuki", "鈴木");
            insertUserWithDisplayName("tanaka", "田中");

            assertThat(userMapper.searchByKeyword("uzuk")).extracting(User::getUsername)
                    .containsExactly("suzuki");
        }

        @Test
        @DisplayName("表示名の一部でも検索できる（username と display_name の OR 検索）")
        void matchesPartOfDisplayName() {
            insertUserWithDisplayName("abc", "鈴木太郎");
            insertUserWithDisplayName("xyz", "田中花子");

            assertThat(userMapper.searchByKeyword("鈴木")).extracting(User::getUsername)
                    .containsExactly("abc");
        }

        @Test
        @DisplayName("大文字小文字を区別しない（ILIKE を使っているため）")
        void isCaseInsensitive() {
            insertUserWithDisplayName("suzuki", "Suzuki Taro");

            // 小文字で登録された username を大文字で検索しても見つかること
            assertThat(userMapper.searchByKeyword("SUZUKI")).extracting(User::getUsername)
                    .containsExactly("suzuki");
            // 大文字で登録された display_name を小文字で検索しても見つかること
            assertThat(userMapper.searchByKeyword("taro")).extracting(User::getUsername)
                    .containsExactly("suzuki");
        }

        @Test
        @DisplayName("エスケープ済みの % は「すべてに一致する記号」ではなく普通の文字として扱われる")
        void escapedPercentIsTreatedAsLiteral() {
            insertUserWithDisplayName("half", "10%オフ");
            insertUserWithDisplayName("plain", "10人");

            // Service 層（SearchKeyword）が % を \% に変換してから渡す想定。
            // ESCAPE '\' が効いていないと、両方（あるいは全ユーザー）が一致してしまう
            assertThat(userMapper.searchByKeyword("10\\%")).extracting(User::getUsername)
                    .containsExactly("half");
            // エスケープしない「10」なら両方に一致する
            assertThat(userMapper.searchByKeyword("10")).extracting(User::getUsername)
                    .containsExactlyInAnyOrder("half", "plain");
        }

        @Test
        @DisplayName("一致するユーザーがいなければ空のリストを返す（nullではない）")
        void returnsEmptyListWhenNoMatch() {
            insertUser("usr4");

            assertThat(userMapper.searchByKeyword("該当なし")).isEmpty();
        }

        @Test
        @DisplayName("@ユーザー名の昇順で返す")
        void ordersByUsername() {
            insertUserWithDisplayName("ccc", "共通ワード");
            insertUserWithDisplayName("aaa", "共通ワード");
            insertUserWithDisplayName("bbb", "共通ワード");

            assertThat(userMapper.searchByKeyword("共通ワード")).extracting(User::getUsername)
                    .containsExactly("aaa", "bbb", "ccc");
        }
    }

    @Nested
    @DisplayName("重複チェック")
    class ExistsChecks {

        @Test
        @DisplayName("existsByEmail: 登録済みなら true、未登録なら false")
        void existsByEmail() {
            insertUser("usr5");

            assertThat(userMapper.existsByEmail("usr5@example.com")).isTrue();
            assertThat(userMapper.existsByEmail("unknown@example.com")).isFalse();
        }

        @Test
        @DisplayName("existsByUsername: 登録済みなら true、未登録なら false")
        void existsByUsername() {
            insertUser("usr6");

            assertThat(userMapper.existsByUsername("usr6")).isTrue();
            assertThat(userMapper.existsByUsername("unknown")).isFalse();
        }

        @Test
        @DisplayName("existsByUsernameExcludingSelf: 自分が今使っている名前は重複扱いにしない")
        void excludesSelfFromDuplicateCheck() {
            long selfId = insertUser("usr7");

            // 「@ユーザー名を変えずにプロフィールを保存」したときに409にならないための除外
            assertThat(userMapper.existsByUsernameExcludingSelf("usr7", selfId)).isFalse();
        }

        @Test
        @DisplayName("existsByUsernameExcludingSelf: 他人が使っている名前なら true を返す")
        void detectsOtherUsersName() {
            long selfId = insertUser("usr8a");
            insertUser("usr8b");

            assertThat(userMapper.existsByUsernameExcludingSelf("usr8b", selfId)).isTrue();
        }
    }

    @Nested
    @DisplayName("プロフィール")
    class Profile {

        @Test
        @DisplayName("updateProfile: 表示名・@ユーザー名・自己紹介をまとめて更新する")
        void updateProfileChangesValues() {
            long userId = insertUser("usr9");

            userMapper.updateProfile(userId, "新しい表示名", "usr9new", "新しい自己紹介");

            User updated = userMapper.findById(userId).orElseThrow();
            assertThat(updated.getDisplayName()).isEqualTo("新しい表示名");
            assertThat(updated.getUsername()).isEqualTo("usr9new");
            assertThat(updated.getBio()).isEqualTo("新しい自己紹介");
        }

        @Test
        @DisplayName("updateProfile: 自己紹介を null にすると未設定に戻る")
        void updateProfileAcceptsNullBio() {
            long userId = insertUser("usr10");
            userMapper.updateProfile(userId, "表示名", "usr10", "自己紹介");

            userMapper.updateProfile(userId, "表示名", "usr10", null);

            assertThat(userMapper.findById(userId).orElseThrow().getBio()).isNull();
        }

        @Test
        @DisplayName("updateIconImagePath: アイコンの保存パスだけを更新する（他の項目は変えない）")
        void updateIconImagePathChangesOnlyIcon() {
            long userId = insertUser("usr11");

            userMapper.updateIconImagePath(userId, "icons/abc.jpg");

            User updated = userMapper.findById(userId).orElseThrow();
            assertThat(updated.getIconImagePath()).isEqualTo("icons/abc.jpg");
            assertThat(updated.getDisplayName()).isEqualTo("usr11さん");
        }

        @Test
        @DisplayName("selectProfileByUsername: フォロー数とフォロワー数を1回のSQLで同時に取得する")
        void profileIncludesFollowCounts() {
            long meId = insertUser("usr12me");
            long followedId = insertUser("usr12out");
            long followerId = insertUser("usr12in");
            insertFollow(meId, followedId);   // 自分がフォローしている → followingCount
            insertFollow(followerId, meId);   // 自分がフォローされている → followerCount

            UserProfileDetail profile = userMapper.selectProfileByUsername("usr12me", meId).orElseThrow();

            assertThat(profile.getFollowingCount()).isEqualTo(1);
            assertThat(profile.getFollowerCount()).isEqualTo(1);
        }

        @Test
        @DisplayName("selectProfileByUsername: フォローしていない相手なら followedByMe は false")
        void followedByMeIsFalseWhenNotFollowing() {
            long viewerId = insertUser("usr13a");
            insertUser("usr13b");

            assertThat(userMapper.selectProfileByUsername("usr13b", viewerId).orElseThrow().isFollowedByMe())
                    .isFalse();
        }

        // 上のテストと1つにまとめて「false → フォロー → true」と続けて確認することはしない。
        // MyBatis は同じトランザクションの中で同じ検索を同じ引数で呼ぶと、
        // DBに問い合わせ直さず前回の結果を返す（一次キャッシュ）。
        // 途中でデータを変えても結果が変わらず、実装は正しいのにテストだけが落ちる
        @Test
        @DisplayName("selectProfileByUsername: フォロー中の相手なら followedByMe は true")
        void followedByMeIsTrueWhenFollowing() {
            long viewerId = insertUser("usr13c");
            insertUser("usr13d");
            long targetId = userMapper.findByUsername("usr13d").orElseThrow().getId();
            insertFollow(viewerId, targetId);

            assertThat(userMapper.selectProfileByUsername("usr13d", viewerId).orElseThrow().isFollowedByMe())
                    .isTrue();
        }

        @Test
        @DisplayName("selectProfileByUsername: 自分のプロフィールを見たとき followedByMe は false になる")
        void ownProfileIsNotFollowedByMe() {
            long meId = insertUser("usr14");

            assertThat(userMapper.selectProfileByUsername("usr14", meId).orElseThrow().isFollowedByMe())
                    .isFalse();
        }

        @Test
        @DisplayName("selectProfileByUsername: 存在しない@ユーザー名なら空を返す（404の判定に使う）")
        void returnsEmptyForUnknownUsername() {
            assertThat(userMapper.selectProfileByUsername("unknown", 1L)).isEmpty();
        }
    }
}
