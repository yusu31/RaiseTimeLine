package com.raisetech.raisetimeline.support;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Mapper テストの共通の土台。各テストクラスはこれを継承する。
 *
 * <p>ここに置くのは<strong>テストデータを用意する道具だけ</strong>で、検証（assert）は置かない。
 * 検証を親クラスに書くと、テストを読んだときに「何を確かめているのか」が分からなくなるため。</p>
 */
@MapperTest
public abstract class MapperTestSupport {

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    /**
     * 各テストの前に全テーブルを空にする。
     *
     * <p><strong>なぜ必要か:</strong> {@code selectTimeline} のように「全投稿から取ってくる」SQL は、
     * 別のテストが残したデータがあると件数が変わってしまう。
     * 「1件だけ入れたので1件返るはず」という検証が、実行する順番によって成功したり失敗したりする
     * （＝たまに落ちるテスト）。それを防ぐため、毎回まっさらな状態から始める。</p>
     *
     * <p><strong>なぜ消しても平気か:</strong> 接続先は開発用とは別のテスト専用DB
     * {@code raisetimeline_test} であり、画面で見ているデータは別のDBにある。
     * さらに {@code @MybatisTest} によって各テストはトランザクション内で実行され、
     * 終了時に自動でロールバックされる（PostgreSQL では TRUNCATE も巻き戻せる）。</p>
     */
    @BeforeEach
    void truncateAllTables() {
        jdbcTemplate.execute("TRUNCATE TABLE posts, comments, likes, follows, refresh_tokens, users CASCADE");
    }

    /**
     * テスト用のユーザーを1人作り、採番されたIDを返す。
     * username は一意制約があり15文字までなので、テストごとに短く重複しない名前を渡すこと。
     */
    protected long insertUser(String username) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO users (display_name, email, password_hash, username)
                VALUES (?, ?, 'dummy-hash', ?)
                RETURNING id
                """, Long.class, username + "さん", username + "@example.com", username);
    }

    /** テスト用の投稿を1件作り、採番されたIDを返す。 */
    protected long insertPost(long userId, String content) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO posts (user_id, content) VALUES (?, ?) RETURNING id
                """, Long.class, userId, content);
    }

    /**
     * 作成日時を明示した投稿を作る。
     * 並び順（新しい順）を検証したいときは、既定の CURRENT_TIMESTAMP だと
     * 同じ時刻になって順序が定まらないため、こちらを使う。
     */
    protected long insertPostAt(long userId, String content, String createdAt) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO posts (user_id, content, created_at) VALUES (?, ?, CAST(? AS TIMESTAMP))
                RETURNING id
                """, Long.class, userId, content, createdAt);
    }

    /** followerId が followingId をフォローしている状態を作る。 */
    protected void insertFollow(long followerId, long followingId) {
        jdbcTemplate.update("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
                followerId, followingId);
    }

    /** postId に userId のいいねを付ける。 */
    protected void insertLike(long postId, long userId) {
        jdbcTemplate.update("INSERT INTO likes (post_id, user_id) VALUES (?, ?)", postId, userId);
    }

    /** postId に userId のコメントを付ける。 */
    protected void insertComment(long postId, long userId, String content) {
        jdbcTemplate.update("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)",
                postId, userId, content);
    }
}
