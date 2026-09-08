package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.Comment;
import com.raisetech.raisetimeline.domain.CommentDetail;
import com.raisetech.raisetimeline.support.MapperTestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link CommentMapper} のテスト。
 *
 * <p>並び順の検証では作成日時を明示的に指定している。
 * PostgreSQL の {@code CURRENT_TIMESTAMP} は「トランザクションが始まった時刻」を返すため、
 * 1つのテストの中で続けて INSERT すると<strong>全部同じ時刻になり</strong>、
 * 日時での並べ替えを検証したつもりが id 順を見ているだけになってしまうため。</p>
 */
class CommentMapperTest extends MapperTestSupport {

    @Autowired
    private CommentMapper commentMapper;

    private Comment newComment(long postId, long userId, String content) {
        Comment comment = new Comment();
        comment.setPostId(postId);
        comment.setUserId(userId);
        comment.setContent(content);
        return comment;
    }

    @Test
    @DisplayName("insert: 登録するとDBが採番したIDがオブジェクトに書き戻される（useGeneratedKeys）")
    void insertWritesGeneratedIdBackToObject() {
        long userId = insertUser("cmt1");
        long postId = insertPost(userId, "投稿本文");
        Comment comment = newComment(postId, userId, "コメント本文");
        assertThat(comment.getId()).isNull();

        commentMapper.insert(comment);

        // IDが書き戻されないと、直後に「登録したコメントを取得して返す」ことができない
        assertThat(comment.getId()).isNotNull();
        assertThat(commentMapper.findById(comment.getId())).isPresent();
    }

    @Test
    @DisplayName("findById: 登録した内容がそのまま取得できる")
    void findByIdReturnsStoredValues() {
        long userId = insertUser("cmt2");
        long postId = insertPost(userId, "投稿本文");
        Comment comment = newComment(postId, userId, "コメント本文");
        commentMapper.insert(comment);

        Comment found = commentMapper.findById(comment.getId()).orElseThrow();

        assertThat(found.getPostId()).isEqualTo(postId);
        assertThat(found.getUserId()).isEqualTo(userId);
        assertThat(found.getContent()).isEqualTo("コメント本文");
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    @DisplayName("findById: 存在しないIDなら空を返す（例外は投げない）")
    void findByIdReturnsEmptyForUnknownId() {
        assertThat(commentMapper.findById(999999L)).isEmpty();
    }

    @Test
    @DisplayName("deleteById: 削除するとfindByIdが空を返す")
    void deleteByIdRemovesComment() {
        long userId = insertUser("cmt3");
        long postId = insertPost(userId, "投稿本文");
        Comment comment = newComment(postId, userId, "コメント本文");
        commentMapper.insert(comment);

        commentMapper.deleteById(comment.getId());

        assertThat(commentMapper.findById(comment.getId())).isEmpty();
    }

    @Test
    @DisplayName("selectByPostId: 指定した投稿のコメントだけを返す（別の投稿のコメントは含めない）")
    void selectByPostIdIsScopedToOnePost() {
        long userId = insertUser("cmt4");
        long targetPostId = insertPost(userId, "対象の投稿");
        long otherPostId = insertPost(userId, "別の投稿");
        insertComment(targetPostId, userId, "対象へのコメント");
        insertComment(otherPostId, userId, "別の投稿へのコメント");

        List<CommentDetail> comments = commentMapper.selectByPostId(targetPostId);

        assertThat(comments).extracting(CommentDetail::getContent)
                .containsExactly("対象へのコメント");
    }

    @Test
    @DisplayName("selectByPostId: 古い順（作成日時の昇順）で返す。会話が上から読める順序にするため")
    void selectByPostIdReturnsOldestFirst() {
        long userId = insertUser("cmt5");
        long postId = insertPost(userId, "投稿本文");
        // 「後から入れたほうが古い日時」という並びにして、id 順ではなく日時順で並ぶことを確かめる
        jdbcTemplate.update("""
                INSERT INTO comments (post_id, user_id, content, created_at)
                VALUES (?, ?, '新しいコメント', CAST('2026-09-05 12:00:00' AS TIMESTAMP))
                """, postId, userId);
        jdbcTemplate.update("""
                INSERT INTO comments (post_id, user_id, content, created_at)
                VALUES (?, ?, '古いコメント', CAST('2026-09-01 12:00:00' AS TIMESTAMP))
                """, postId, userId);

        List<CommentDetail> comments = commentMapper.selectByPostId(postId);

        assertThat(comments).extracting(CommentDetail::getContent)
                .containsExactly("古いコメント", "新しいコメント");
    }

    @Test
    @DisplayName("selectByPostId: コメントが1件も無ければ空のリストを返す（nullではない）")
    void selectByPostIdReturnsEmptyList() {
        long userId = insertUser("cmt6");
        long postId = insertPost(userId, "投稿本文");

        assertThat(commentMapper.selectByPostId(postId)).isEmpty();
    }

    @Test
    @DisplayName("selectByPostId: コメントした人の表示名とユーザー名も一緒に取得する（JOIN）")
    void selectByPostIdIncludesAuthor() {
        long authorId = insertUser("cmt7");
        long postId = insertPost(authorId, "投稿本文");
        insertComment(postId, authorId, "コメント本文");

        CommentDetail detail = commentMapper.selectByPostId(postId).getFirst();

        assertThat(detail.getAuthorId()).isEqualTo(authorId);
        assertThat(detail.getAuthorUsername()).isEqualTo("cmt7");
        assertThat(detail.getAuthorDisplayName()).isEqualTo("cmt7さん");
    }

    @Test
    @DisplayName("selectDetailById: 1件のコメントを投稿者情報つきで取得する")
    void selectDetailByIdIncludesAuthor() {
        long authorId = insertUser("cmt8");
        long postId = insertPost(authorId, "投稿本文");
        Comment comment = newComment(postId, authorId, "コメント本文");
        commentMapper.insert(comment);

        CommentDetail detail = commentMapper.selectDetailById(comment.getId()).orElseThrow();

        assertThat(detail.getContent()).isEqualTo("コメント本文");
        assertThat(detail.getPostId()).isEqualTo(postId);
        assertThat(detail.getAuthorUsername()).isEqualTo("cmt8");
    }

    @Test
    @DisplayName("selectDetailById: 存在しないIDなら空を返す")
    void selectDetailByIdReturnsEmptyForUnknownId() {
        assertThat(commentMapper.selectDetailById(999999L)).isEmpty();
    }

    @Test
    @DisplayName("投稿を削除すると、紐づくコメントも一緒に消える（ON DELETE CASCADE）")
    void commentsAreDeletedWithPost() {
        long userId = insertUser("cmt9");
        long postId = insertPost(userId, "投稿本文");
        insertComment(postId, userId, "コメント本文");

        jdbcTemplate.update("DELETE FROM posts WHERE id = ?", postId);

        assertThat(commentMapper.selectByPostId(postId)).isEmpty();
    }
}
