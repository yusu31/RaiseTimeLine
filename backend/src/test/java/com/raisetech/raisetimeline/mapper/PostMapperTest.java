package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.Post;
import com.raisetech.raisetimeline.domain.PostDetail;
import com.raisetech.raisetimeline.support.MapperTestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link PostMapper} のテスト。このアプリで最も使われる SQL の集まり。
 *
 * <p>タイムライン系の SQL は「並び順」「件数の絞り込み」「読み飛ばし」「集計」を1つの文でこなしている。
 * どれか1つが壊れても画面は表示されてしまい、目視では気づきにくいため、
 * 要素ごとに分けて確認する。</p>
 *
 * <p>並び順の検証では作成日時を明示している。PostgreSQL の {@code CURRENT_TIMESTAMP} は
 * トランザクション開始時刻を返すため、1つのテスト内で続けて INSERT すると全部同じ時刻になり、
 * 日時で並べたつもりが id 順を見ているだけになってしまうため。</p>
 */
class PostMapperTest extends MapperTestSupport {

    @Autowired
    private PostMapper postMapper;

    private Post newPost(long userId, String content, String imagePath) {
        Post post = new Post();
        post.setUserId(userId);
        post.setContent(content);
        post.setImagePath(imagePath);
        return post;
    }

    @Nested
    @DisplayName("登録・取得・更新・削除")
    class Crud {

        @Test
        @DisplayName("insert: 登録するとDBが採番したIDがオブジェクトに書き戻される（useGeneratedKeys）")
        void insertWritesGeneratedIdBackToObject() {
            long userId = insertUser("post1");
            Post post = newPost(userId, "投稿本文", null);
            assertThat(post.getId()).isNull();

            postMapper.insert(post);

            // IDが書き戻されないと、投稿直後に「作成した投稿を返す」ことができない
            assertThat(post.getId()).isNotNull();
        }

        @Test
        @DisplayName("findById: 登録した内容がそのまま取得できる")
        void findByIdReturnsStoredValues() {
            long userId = insertUser("post2");
            Post post = newPost(userId, "投稿本文", "uploads/abc.jpg");
            postMapper.insert(post);

            Post found = postMapper.findById(post.getId()).orElseThrow();

            assertThat(found.getUserId()).isEqualTo(userId);
            assertThat(found.getContent()).isEqualTo("投稿本文");
            assertThat(found.getImagePath()).isEqualTo("uploads/abc.jpg");
        }

        @Test
        @DisplayName("findById: 画像なしの投稿は imagePath が null になる")
        void findByIdReturnsNullImagePathWhenNoImage() {
            long userId = insertUser("post3");
            Post post = newPost(userId, "投稿本文", null);
            postMapper.insert(post);

            assertThat(postMapper.findById(post.getId()).orElseThrow().getImagePath()).isNull();
        }

        @Test
        @DisplayName("findById: 存在しないIDなら空を返す（404の判定に使う）")
        void findByIdReturnsEmptyForUnknownId() {
            assertThat(postMapper.findById(999999L)).isEmpty();
        }

        @Test
        @DisplayName("updateContent: 本文だけを書き換える（画像はそのまま残る）")
        void updateContentChangesOnlyContent() {
            long userId = insertUser("post4");
            Post post = newPost(userId, "変更前", "uploads/abc.jpg");
            postMapper.insert(post);

            postMapper.updateContent(post.getId(), "変更後");

            Post updated = postMapper.findById(post.getId()).orElseThrow();
            assertThat(updated.getContent()).isEqualTo("変更後");
            assertThat(updated.getImagePath()).isEqualTo("uploads/abc.jpg");
        }

        @Test
        @DisplayName("deleteById: 削除するとfindByIdが空を返す")
        void deleteByIdRemovesPost() {
            long userId = insertUser("post5");
            Post post = newPost(userId, "投稿本文", null);
            postMapper.insert(post);

            postMapper.deleteById(post.getId());

            assertThat(postMapper.findById(post.getId())).isEmpty();
        }
    }

    @Nested
    @DisplayName("タイムライン（selectTimeline）")
    class Timeline {

        @Test
        @DisplayName("全員の投稿を新しい順（作成日時の降順）で返す")
        void returnsNewestFirst() {
            long userId = insertUser("tl1");
            insertPostAt(userId, "古い投稿", "2026-09-01 12:00:00");
            insertPostAt(userId, "新しい投稿", "2026-09-05 12:00:00");

            List<PostDetail> timeline = postMapper.selectTimeline(20, 0, userId);

            assertThat(timeline).extracting(PostDetail::getContent)
                    .containsExactly("新しい投稿", "古い投稿");
        }

        @Test
        @DisplayName("limit で返す件数を絞る（3件あっても limit 2 なら2件）")
        void limitsNumberOfRows() {
            long userId = insertUser("tl2");
            insertPostAt(userId, "1件目", "2026-09-01 12:00:00");
            insertPostAt(userId, "2件目", "2026-09-02 12:00:00");
            insertPostAt(userId, "3件目", "2026-09-03 12:00:00");

            assertThat(postMapper.selectTimeline(2, 0, userId)).hasSize(2);
        }

        @Test
        @DisplayName("offset で先頭から読み飛ばす（2ページ目の取得に使う）")
        void offsetSkipsRowsFromTheHead() {
            long userId = insertUser("tl3");
            insertPostAt(userId, "1件目", "2026-09-01 12:00:00");
            insertPostAt(userId, "2件目", "2026-09-02 12:00:00");
            insertPostAt(userId, "3件目", "2026-09-03 12:00:00");

            // 新しい順なので 3件目 → 2件目 → 1件目。offset 0 は先頭、offset 1 は1件飛ばした位置
            assertThat(postMapper.selectTimeline(1, 0, userId)).extracting(PostDetail::getContent)
                    .containsExactly("3件目");
            assertThat(postMapper.selectTimeline(1, 1, userId)).extracting(PostDetail::getContent)
                    .containsExactly("2件目");
        }

        @Test
        @DisplayName("最後のページより後ろを指定すると空のリストを返す（例外にはならない）")
        void returnsEmptyListBeyondLastPage() {
            long userId = insertUser("tl4");
            insertPost(userId, "唯一の投稿");

            assertThat(postMapper.selectTimeline(20, 100, userId)).isEmpty();
        }

        @Test
        @DisplayName("投稿者の表示名・@ユーザー名も一緒に取得する（JOIN）")
        void includesAuthorInformation() {
            long userId = insertUser("tl5");
            insertPost(userId, "投稿本文");

            PostDetail detail = postMapper.selectTimeline(20, 0, userId).getFirst();

            assertThat(detail.getAuthorId()).isEqualTo(userId);
            assertThat(detail.getAuthorUsername()).isEqualTo("tl5");
            assertThat(detail.getAuthorDisplayName()).isEqualTo("tl5さん");
        }

        @Test
        @DisplayName("いいね数とコメント数を集計して返す")
        void aggregatesLikeAndCommentCounts() {
            long ownerId = insertUser("tl6a");
            long otherId = insertUser("tl6b");
            long postId = insertPost(ownerId, "投稿本文");
            insertLike(postId, ownerId);
            insertLike(postId, otherId);
            insertComment(postId, otherId, "コメント");

            PostDetail detail = postMapper.selectTimeline(20, 0, ownerId).getFirst();

            assertThat(detail.getLikeCount()).isEqualTo(2);
            assertThat(detail.getCommentCount()).isEqualTo(1);
        }

        @Test
        @DisplayName("likedByMe は閲覧者ごとに変わる（同じ投稿でも、見ている人によって true / false）")
        void likedByMeDependsOnViewer() {
            long ownerId = insertUser("tl7a");
            long otherId = insertUser("tl7b");
            long postId = insertPost(ownerId, "投稿本文");
            insertLike(postId, ownerId);

            assertThat(postMapper.selectTimeline(20, 0, ownerId).getFirst().isLikedByMe()).isTrue();
            assertThat(postMapper.selectTimeline(20, 0, otherId).getFirst().isLikedByMe()).isFalse();
        }

        @Test
        @DisplayName("未ログイン（currentUserId が null）でもタイムラインは取得でき、likedByMe は false になる")
        void worksForAnonymousViewer() {
            long userId = insertUser("tl8");
            long postId = insertPost(userId, "投稿本文");
            insertLike(postId, userId);

            PostDetail detail = postMapper.selectTimeline(20, 0, null).getFirst();

            assertThat(detail.getLikeCount()).isEqualTo(1);
            assertThat(detail.isLikedByMe()).isFalse();
        }
    }

    @Nested
    @DisplayName("プロフィールの投稿一覧（selectByAuthorId）")
    class ByAuthor {

        @Test
        @DisplayName("指定したユーザーの投稿だけを返す（他人の投稿は含めない）")
        void returnsOnlyPostsOfGivenAuthor() {
            long targetId = insertUser("auth1a");
            long otherId = insertUser("auth1b");
            insertPost(targetId, "本人の投稿");
            insertPost(otherId, "他人の投稿");

            assertThat(postMapper.selectByAuthorId(targetId, 20, 0, targetId))
                    .extracting(PostDetail::getContent)
                    .containsExactly("本人の投稿");
        }

        @Test
        @DisplayName("投稿が1件も無ければ空のリストを返す")
        void returnsEmptyListWhenAuthorHasNoPosts() {
            long userId = insertUser("auth2");

            assertThat(postMapper.selectByAuthorId(userId, 20, 0, userId)).isEmpty();
        }
    }

    @Nested
    @DisplayName("フォロー中タイムライン（selectFollowingTimeline）")
    class FollowingTimeline {

        @Test
        @DisplayName("フォローしている人の投稿と自分の投稿を返し、無関係な人の投稿は返さない")
        void includesFollowedUsersAndSelfOnly() {
            long meId = insertUser("ftl1me");
            long followedId = insertUser("ftl1fol");
            long strangerId = insertUser("ftl1str");
            insertFollow(meId, followedId);
            insertPostAt(meId, "自分の投稿", "2026-09-03 12:00:00");
            insertPostAt(followedId, "フォロー中の人の投稿", "2026-09-02 12:00:00");
            insertPostAt(strangerId, "無関係な人の投稿", "2026-09-01 12:00:00");

            List<PostDetail> timeline = postMapper.selectFollowingTimeline(20, 0, meId);

            // 自分の投稿を含めるのは X と同じ挙動。フォローしていない自分の投稿が消えると不自然なため
            assertThat(timeline).extracting(PostDetail::getContent)
                    .containsExactly("自分の投稿", "フォロー中の人の投稿");
        }

        @Test
        @DisplayName("誰もフォローしていなくても、自分の投稿は表示される")
        void showsOwnPostsWhenFollowingNobody() {
            long meId = insertUser("ftl2");
            insertPost(meId, "自分の投稿");

            assertThat(postMapper.selectFollowingTimeline(20, 0, meId))
                    .extracting(PostDetail::getContent)
                    .containsExactly("自分の投稿");
        }

        @Test
        @DisplayName("フォローを解除した相手の投稿は表示されなくなる")
        void excludesUnfollowedUsers() {
            long meId = insertUser("ftl3me");
            long otherId = insertUser("ftl3oth");
            insertFollow(meId, otherId);
            insertPost(otherId, "相手の投稿");

            jdbcTemplate.update("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", meId, otherId);

            assertThat(postMapper.selectFollowingTimeline(20, 0, meId)).isEmpty();
        }
    }

    @Nested
    @DisplayName("投稿検索（selectByKeyword・ILIKE）")
    class SearchByKeyword {

        @Test
        @DisplayName("本文の一部で検索できる（中間一致）")
        void matchesPartOfContent() {
            long userId = insertUser("sr1");
            insertPost(userId, "今日はテストを書いた");
            insertPost(userId, "明日は休みます");

            assertThat(postMapper.selectByKeyword("テスト", 20, 0, userId))
                    .extracting(PostDetail::getContent)
                    .containsExactly("今日はテストを書いた");
        }

        @Test
        @DisplayName("大文字小文字を区別しない（ILIKE を使っているため）")
        void isCaseInsensitive() {
            long userId = insertUser("sr2");
            insertPost(userId, "Spring Boot を学んだ");

            assertThat(postMapper.selectByKeyword("spring boot", 20, 0, userId)).hasSize(1);
            assertThat(postMapper.selectByKeyword("SPRING BOOT", 20, 0, userId)).hasSize(1);
        }

        @Test
        @DisplayName("エスケープ済みの % は「すべてに一致する記号」ではなく普通の文字として扱われる")
        void escapedPercentIsTreatedAsLiteral() {
            long userId = insertUser("sr3");
            insertPost(userId, "セールで10%オフ");
            insertPost(userId, "参加者は10人でした");

            // ESCAPE '\' が効いていないと、\% がワイルドカードとして働き両方に一致してしまう
            assertThat(postMapper.selectByKeyword("10\\%", 20, 0, userId))
                    .extracting(PostDetail::getContent)
                    .containsExactly("セールで10%オフ");
        }

        @Test
        @DisplayName("一致する投稿が無ければ空のリストを返す")
        void returnsEmptyListWhenNoMatch() {
            long userId = insertUser("sr4");
            insertPost(userId, "投稿本文");

            assertThat(postMapper.selectByKeyword("該当なし", 20, 0, userId)).isEmpty();
        }

        @Test
        @DisplayName("検索結果も新しい順で返し、limit で件数を絞れる")
        void ordersNewestFirstAndLimits() {
            long userId = insertUser("sr5");
            insertPostAt(userId, "検索対象 1件目", "2026-09-01 12:00:00");
            insertPostAt(userId, "検索対象 2件目", "2026-09-02 12:00:00");

            assertThat(postMapper.selectByKeyword("検索対象", 1, 0, userId))
                    .extracting(PostDetail::getContent)
                    .containsExactly("検索対象 2件目");
        }
    }

    @Nested
    @DisplayName("投稿1件の取得（selectDetailById）")
    class DetailById {

        @Test
        @DisplayName("投稿者情報といいね数・コメント数を含めて1件返す")
        void returnsPostWithAggregates() {
            long ownerId = insertUser("det1a");
            long otherId = insertUser("det1b");
            long postId = insertPost(ownerId, "投稿本文");
            insertLike(postId, otherId);
            insertComment(postId, otherId, "コメント");

            PostDetail detail = postMapper.selectDetailById(postId, ownerId).orElseThrow();

            assertThat(detail.getContent()).isEqualTo("投稿本文");
            assertThat(detail.getAuthorUsername()).isEqualTo("det1a");
            assertThat(detail.getLikeCount()).isEqualTo(1);
            assertThat(detail.getCommentCount()).isEqualTo(1);
            assertThat(detail.isLikedByMe()).isFalse();
        }

        @Test
        @DisplayName("存在しないIDなら空を返す（404の判定に使う）")
        void returnsEmptyForUnknownId() {
            assertThat(postMapper.selectDetailById(999999L, 1L)).isEmpty();
        }
    }

    @Nested
    @DisplayName("新着投稿（countNewerThan / selectNewerThan）")
    class NewPosts {

        @Test
        @DisplayName("countNewerThan: 指定したIDより後に作られた投稿の件数を返す（指定したID自身は含めない）")
        void countsOnlyPostsAfterGivenId() {
            long userId = insertUser("new1");
            long firstId = insertPost(userId, "1件目");
            insertPost(userId, "2件目");
            insertPost(userId, "3件目");

            // 「id > afterId」なので、1件目自身は数えず2件になる（境目の確認）
            assertThat(postMapper.countNewerThan(firstId)).isEqualTo(2);
        }

        @Test
        @DisplayName("countNewerThan: 最新の投稿IDを渡すと0を返す（新着なしの状態）")
        void countsZeroWhenNothingIsNewer() {
            long userId = insertUser("new2");
            insertPost(userId, "1件目");
            long latestId = insertPost(userId, "2件目");

            assertThat(postMapper.countNewerThan(latestId)).isZero();
        }

        @Test
        @DisplayName("countNewerThan: 0 を渡すと全件を数える（初回読み込み時の扱い）")
        void countsAllWhenAfterIdIsZero() {
            long userId = insertUser("new3");
            insertPost(userId, "1件目");
            insertPost(userId, "2件目");

            assertThat(postMapper.countNewerThan(0L)).isEqualTo(2);
        }

        @Test
        @DisplayName("selectNewerThan: 指定したIDより後の投稿を、新しい順（ID降順）で返す")
        void returnsNewerPostsInDescendingIdOrder() {
            long userId = insertUser("new4");
            long firstId = insertPost(userId, "1件目");
            insertPost(userId, "2件目");
            insertPost(userId, "3件目");

            assertThat(postMapper.selectNewerThan(firstId, 20, userId))
                    .extracting(PostDetail::getContent)
                    .containsExactly("3件目", "2件目");
        }

        @Test
        @DisplayName("selectNewerThan: limit で返す件数を絞る（一度に大量に返さないため）")
        void limitsNumberOfRows() {
            long userId = insertUser("new5");
            long firstId = insertPost(userId, "1件目");
            insertPost(userId, "2件目");
            insertPost(userId, "3件目");

            assertThat(postMapper.selectNewerThan(firstId, 1, userId)).hasSize(1);
        }

        @Test
        @DisplayName("selectNewerThan: 新着が無ければ空のリストを返す")
        void returnsEmptyListWhenNothingIsNewer() {
            long userId = insertUser("new6");
            long latestId = insertPost(userId, "1件目");

            assertThat(postMapper.selectNewerThan(latestId, 20, userId)).isEmpty();
        }
    }
}
