package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.Comment;
import com.raisetech.raisetimeline.domain.CommentDetail;
import com.raisetech.raisetimeline.domain.Post;
import com.raisetech.raisetimeline.exception.CommentAccessDeniedException;
import com.raisetech.raisetimeline.exception.CommentNotFoundException;
import com.raisetech.raisetimeline.exception.InvalidCommentContentException;
import com.raisetech.raisetimeline.exception.PostNotFoundException;
import com.raisetech.raisetimeline.mapper.CommentMapper;
import com.raisetech.raisetimeline.mapper.PostMapper;
import com.raisetech.raisetimeline.request.CommentCreateRequest;
import com.raisetech.raisetimeline.response.CommentResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link CommentService} のテスト。
 *
 * <p>本文の長さは1〜280文字。<strong>境目（0/1/280/281）</strong>を確認する。
 * 削除の権限判定は「投稿が存在するか」「自分のものか」の組み合わせで
 * 404 と 403 を出し分けており、その表を埋める形でケースを選んでいる。</p>
 */
@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

    private static final long USER_ID = 10L;
    private static final long OTHER_USER_ID = 99L;
    private static final long POST_ID = 100L;
    private static final long COMMENT_ID = 1000L;
    private static final int MAX_CONTENT_LENGTH = 280;

    @Mock
    private CommentMapper commentMapper;

    @Mock
    private PostMapper postMapper;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private CommentService commentService;

    private void givenPostExists() {
        Post post = new Post();
        post.setId(POST_ID);
        when(postMapper.findById(POST_ID)).thenReturn(Optional.of(post));
    }

    private CommentDetail detail(String iconImagePath) {
        CommentDetail detail = new CommentDetail();
        detail.setId(COMMENT_ID);
        detail.setPostId(POST_ID);
        detail.setContent("コメント本文");
        detail.setCreatedAt(LocalDateTime.of(2026, 9, 5, 12, 0));
        detail.setAuthorId(USER_ID);
        detail.setAuthorUsername("suzuki");
        detail.setAuthorDisplayName("鈴木");
        detail.setAuthorIconImagePath(iconImagePath);
        return detail;
    }

    private Comment ownedComment(long ownerId) {
        Comment comment = new Comment();
        comment.setId(COMMENT_ID);
        comment.setPostId(POST_ID);
        comment.setUserId(ownerId);
        return comment;
    }

    @Nested
    @DisplayName("一覧取得")
    class GetComments {

        @Test
        @DisplayName("投稿が存在しなければ PostNotFoundException を投げ、コメントを取りに行かない")
        void throwsWhenPostNotFound() {
            when(postMapper.findById(POST_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> commentService.getComments(POST_ID))
                    .isInstanceOf(PostNotFoundException.class);

            verify(commentMapper, never()).selectByPostId(anyLong());
        }

        @Test
        @DisplayName("アイコンの保存パスは公開URLに変換して返す")
        void convertsIconPathToPublicUrl() {
            givenPostExists();
            when(commentMapper.selectByPostId(POST_ID)).thenReturn(List.of(detail("icons/abc.jpg")));
            when(storageService.toPublicUrl("icons/abc.jpg")).thenReturn("/uploads/icons/abc.jpg");

            List<CommentResponse> comments = commentService.getComments(POST_ID);

            assertThat(comments).singleElement()
                    .extracting(comment -> comment.author().iconImageUrl())
                    .isEqualTo("/uploads/icons/abc.jpg");
        }

        @Test
        @DisplayName("アイコンが未設定なら URL は null にし、変換処理そのものを呼ばない")
        void skipsUrlConversionWhenIconIsNotSet() {
            givenPostExists();
            when(commentMapper.selectByPostId(POST_ID)).thenReturn(List.of(detail(null)));

            List<CommentResponse> comments = commentService.getComments(POST_ID);

            assertThat(comments).singleElement()
                    .extracting(comment -> comment.author().iconImageUrl())
                    .isNull();
            // null を渡すと保存先によっては "/uploads/null" のような文字列ができてしまう。
            // そもそも呼ばないことを確認する
            verify(storageService, never()).toPublicUrl(any());
        }

        @Test
        @DisplayName("コメントが無ければ空のリストを返す")
        void returnsEmptyListWhenNoComments() {
            givenPostExists();
            when(commentMapper.selectByPostId(POST_ID)).thenReturn(List.of());

            assertThat(commentService.getComments(POST_ID)).isEmpty();
        }
    }

    @Nested
    @DisplayName("作成（本文の境界値）")
    class Create {

        @ParameterizedTest(name = "[{index}] 本文 \"{0}\" は拒否する")
        @NullSource
        @ValueSource(strings = {"", " ", "　"})
        @DisplayName("本文が空・空白のみ・未入力なら InvalidCommentContentException を投げ、登録しない")
        void rejectsBlankContent(String content) {
            givenPostExists();

            assertThatThrownBy(() -> commentService.create(USER_ID, POST_ID, new CommentCreateRequest(content)))
                    .isInstanceOf(InvalidCommentContentException.class);

            verify(commentMapper, never()).insert(any());
        }

        @Test
        @DisplayName("本文が281文字なら拒否する（上限の外）")
        void rejectsContentOverMaxLength() {
            givenPostExists();
            String tooLong = "あ".repeat(MAX_CONTENT_LENGTH + 1);

            assertThatThrownBy(() -> commentService.create(USER_ID, POST_ID, new CommentCreateRequest(tooLong)))
                    .isInstanceOf(InvalidCommentContentException.class);

            verify(commentMapper, never()).insert(any());
        }

        @Test
        @DisplayName("本文が1文字でも登録できる（下限ちょうど）")
        void acceptsSingleCharacterContent() {
            givenPostExists();
            when(commentMapper.selectDetailById(any())).thenReturn(Optional.of(detail(null)));

            commentService.create(USER_ID, POST_ID, new CommentCreateRequest("あ"));

            verify(commentMapper).insert(any(Comment.class));
        }

        @Test
        @DisplayName("本文が280文字ちょうどなら登録できる（上限ちょうど）")
        void acceptsExactlyMaxLengthContent() {
            givenPostExists();
            when(commentMapper.selectDetailById(any())).thenReturn(Optional.of(detail(null)));

            commentService.create(USER_ID, POST_ID,
                    new CommentCreateRequest("あ".repeat(MAX_CONTENT_LENGTH)));

            verify(commentMapper).insert(any(Comment.class));
        }

        @Test
        @DisplayName("投稿が存在しなければ、本文の検証より先に PostNotFoundException を投げる")
        void checksPostBeforeValidatingContent() {
            when(postMapper.findById(POST_ID)).thenReturn(Optional.empty());

            // 本文も不正だが、返るのは 404。存在しない投稿に対して
            // 「本文が長すぎます」と答えるのは案内として誤り
            assertThatThrownBy(() -> commentService.create(USER_ID, POST_ID, new CommentCreateRequest("")))
                    .isInstanceOf(PostNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("削除（権限の判定）")
    class Delete {

        @Test
        @DisplayName("コメントが存在しなければ CommentNotFoundException を投げ、削除しない")
        void throwsNotFoundWhenCommentMissing() {
            when(commentMapper.findById(COMMENT_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> commentService.delete(USER_ID, COMMENT_ID))
                    .isInstanceOf(CommentNotFoundException.class);

            verify(commentMapper, never()).deleteById(anyLong());
        }

        @Test
        @DisplayName("他人のコメントなら CommentAccessDeniedException を投げ、削除しない")
        void throwsAccessDeniedForOtherUsersComment() {
            when(commentMapper.findById(COMMENT_ID)).thenReturn(Optional.of(ownedComment(OTHER_USER_ID)));

            // 存在はするので404ではなく403。存在の有無まで隠したい場合は404に寄せる設計もあるが、
            // このアプリはコメント自体が公開情報なので403で「権限が無い」と明示している
            assertThatThrownBy(() -> commentService.delete(USER_ID, COMMENT_ID))
                    .isInstanceOf(CommentAccessDeniedException.class);

            verify(commentMapper, never()).deleteById(anyLong());
        }

        @Test
        @DisplayName("自分のコメントなら削除できる")
        void deletesOwnComment() {
            when(commentMapper.findById(COMMENT_ID)).thenReturn(Optional.of(ownedComment(USER_ID)));

            commentService.delete(USER_ID, COMMENT_ID);

            verify(commentMapper).deleteById(COMMENT_ID);
        }
    }

    @Test
    @DisplayName("作成直後にコメントを取得できなければ CommentNotFoundException を投げる（想定外の状態を黙って通さない）")
    void throwsWhenCreatedCommentCannotBeRead() {
        givenPostExists();
        when(commentMapper.selectDetailById(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                commentService.create(USER_ID, POST_ID, new CommentCreateRequest("コメント本文")))
                .isInstanceOf(CommentNotFoundException.class);

        verify(storageService, never()).toPublicUrl(anyString());
    }
}
