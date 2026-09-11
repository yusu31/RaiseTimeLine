package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.Post;
import com.raisetech.raisetimeline.domain.PostDetail;
import com.raisetech.raisetimeline.exception.InvalidPostContentException;
import com.raisetech.raisetimeline.exception.PostAccessDeniedException;
import com.raisetech.raisetimeline.exception.PostNotFoundException;
import com.raisetech.raisetimeline.mapper.PostMapper;
import com.raisetech.raisetimeline.request.PostCreateRequest;
import com.raisetech.raisetimeline.request.PostUpdateRequest;
import com.raisetech.raisetimeline.response.PostListResponse;
import com.raisetech.raisetimeline.response.PostResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link PostService} のテスト。DBには接続せず、Mapper をモックに差し替える。
 *
 * <p>ページングは「表示したい件数 + 1件」を取得し、余分に取れたかどうかで
 * 「次のページがあるか」を判定している（{@code COUNT(*)} を別に発行しない軽量な方式）。
 * ここは <strong>20件と21件の境目</strong>でしか壊れないため、その2点を必ず確認する。</p>
 *
 * <p>本文の長さは1〜280文字。{@code null} / 空 / 1文字 / 280文字 / 281文字 の
 * 境目を確認する。中間の値（100文字など）をいくつ試しても、この種の不具合は見つからない。</p>
 */
@ExtendWith(MockitoExtension.class)
class PostServiceTest {

    private static final long USER_ID = 10L;
    private static final long OTHER_USER_ID = 99L;
    private static final long POST_ID = 100L;
    private static final int MAX_CONTENT_LENGTH = 280;
    private static final int DEFAULT_PAGE_SIZE = 20;

    /** サロゲートペアの絵文字（U+1F600）。Java の String では長さ2として数えられる */
    private static final String EMOJI = "😀";

    @Mock
    private PostMapper postMapper;

    @Mock
    private StorageService storageService;

    @Mock
    private SearchKeyword searchKeyword;

    @InjectMocks
    private PostService postService;

    private PostDetail detail(long id, String imagePath) {
        PostDetail detail = new PostDetail();
        detail.setId(id);
        detail.setContent("投稿本文");
        detail.setImagePath(imagePath);
        detail.setCreatedAt(LocalDateTime.of(2026, 9, 5, 12, 0));
        detail.setAuthorId(USER_ID);
        detail.setAuthorUsername("suzuki");
        detail.setAuthorDisplayName("鈴木");
        detail.setLikeCount(0);
        detail.setCommentCount(0);
        return detail;
    }

    /** 指定した件数のダミー行を作る。ページングの境目を確かめるために使う。 */
    private List<PostDetail> rows(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(i -> detail(i, null)).toList();
    }

    private Post ownedPost(long ownerId, String imagePath) {
        Post post = new Post();
        post.setId(POST_ID);
        post.setUserId(ownerId);
        post.setContent("投稿本文");
        post.setImagePath(imagePath);
        return post;
    }

    @Nested
    @DisplayName("投稿の作成（本文と画像の検証）")
    class Create {

        @ParameterizedTest(name = "[{index}] 本文 \"{0}\" は拒否する")
        @NullSource
        @ValueSource(strings = {"", " ", "　", "\n"})
        @DisplayName("本文が未入力・空・空白のみなら InvalidPostContentException を投げ、保存しない")
        void rejectsBlankContent(String content) {
            assertThatThrownBy(() -> postService.create(USER_ID, new PostCreateRequest(content, null)))
                    .isInstanceOf(InvalidPostContentException.class);

            verify(postMapper, never()).insert(any());
        }

        @Test
        @DisplayName("本文が281文字なら拒否する（上限の外）")
        void rejectsContentOverMaxLength() {
            String tooLong = "あ".repeat(MAX_CONTENT_LENGTH + 1);

            assertThatThrownBy(() -> postService.create(USER_ID, new PostCreateRequest(tooLong, null)))
                    .isInstanceOf(InvalidPostContentException.class);

            verify(postMapper, never()).insert(any());
        }

        @Test
        @DisplayName("本文が1文字なら保存できる（下限ちょうど）")
        void acceptsSingleCharacterContent() {
            when(postMapper.selectDetailById(any(), any())).thenReturn(Optional.of(detail(POST_ID, null)));

            postService.create(USER_ID, new PostCreateRequest("あ", null));

            verify(postMapper).insert(any(Post.class));
        }

        @Test
        @DisplayName("本文が280文字ちょうどなら保存できる（上限ちょうど）")
        void acceptsExactlyMaxLengthContent() {
            when(postMapper.selectDetailById(any(), any())).thenReturn(Optional.of(detail(POST_ID, null)));

            postService.create(USER_ID, new PostCreateRequest("あ".repeat(MAX_CONTENT_LENGTH), null));

            verify(postMapper).insert(any(Post.class));
        }

        @Test
        @DisplayName("画像が添付されていなければ、ファイル保存処理を呼ばない")
        void doesNotStoreFileWhenNoImage() {
            when(postMapper.selectDetailById(any(), any())).thenReturn(Optional.of(detail(POST_ID, null)));

            postService.create(USER_ID, new PostCreateRequest("投稿本文", null));

            verify(storageService, never()).store(any());
        }

        @Test
        @DisplayName("画像の中身が空なら、ファイル保存処理を呼ばない（空ファイルが送られてくる場合への対応）")
        void doesNotStoreEmptyImage() {
            MultipartFile emptyImage = new MockMultipartFile("image", "photo.jpg", "image/jpeg", new byte[0]);
            when(postMapper.selectDetailById(any(), any())).thenReturn(Optional.of(detail(POST_ID, null)));

            postService.create(USER_ID, new PostCreateRequest("投稿本文", emptyImage));

            verify(storageService, never()).store(any());
        }

        @Test
        @DisplayName("画像が添付されていれば保存し、その保存名を投稿に紐づける")
        void storesImageAndLinksItToPost() {
            MultipartFile image = new MockMultipartFile("image", "photo.jpg", "image/jpeg", "content".getBytes());
            when(storageService.store(image)).thenReturn("abc-123.jpg");
            when(postMapper.selectDetailById(any(), any())).thenReturn(Optional.of(detail(POST_ID, null)));

            postService.create(USER_ID, new PostCreateRequest("投稿本文", image));

            verify(storageService).store(image);
        }

        @Test
        @DisplayName("本文が不正なら、画像の保存も行わない（使われないファイルが残らないように）")
        void doesNotStoreImageWhenContentIsInvalid() {
            MultipartFile image = new MockMultipartFile("image", "photo.jpg", "image/jpeg", "content".getBytes());

            assertThatThrownBy(() -> postService.create(USER_ID, new PostCreateRequest("", image)))
                    .isInstanceOf(InvalidPostContentException.class);

            // 検証より先に保存していると、投稿されなかった画像がストレージに溜まり続ける
            verify(storageService, never()).store(any());
        }
    }

    @Nested
    @DisplayName("投稿の更新・削除（権限の判定）")
    class UpdateAndDelete {

        @Test
        @DisplayName("update: 投稿が存在しなければ PostNotFoundException を投げ、更新しない")
        void updateThrowsNotFound() {
            when(postMapper.findById(POST_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> postService.update(USER_ID, POST_ID, new PostUpdateRequest("新しい本文")))
                    .isInstanceOf(PostNotFoundException.class);

            verify(postMapper, never()).updateContent(anyLong(), anyString());
        }

        @Test
        @DisplayName("update: 他人の投稿なら PostAccessDeniedException を投げ、更新しない")
        void updateThrowsAccessDenied() {
            when(postMapper.findById(POST_ID)).thenReturn(Optional.of(ownedPost(OTHER_USER_ID, null)));

            // 存在はするので404ではなく403。投稿自体は公開情報なので、存在を隠す必要はない
            assertThatThrownBy(() -> postService.update(USER_ID, POST_ID, new PostUpdateRequest("新しい本文")))
                    .isInstanceOf(PostAccessDeniedException.class);

            verify(postMapper, never()).updateContent(anyLong(), anyString());
        }

        @Test
        @DisplayName("update: 自分の投稿なら本文を更新できる")
        void updateOwnPost() {
            when(postMapper.findById(POST_ID)).thenReturn(Optional.of(ownedPost(USER_ID, null)));
            when(postMapper.selectDetailById(POST_ID, USER_ID)).thenReturn(Optional.of(detail(POST_ID, null)));

            postService.update(USER_ID, POST_ID, new PostUpdateRequest("新しい本文"));

            verify(postMapper).updateContent(POST_ID, "新しい本文");
        }

        @Test
        @DisplayName("delete: 投稿が存在しなければ PostNotFoundException を投げ、削除しない")
        void deleteThrowsNotFound() {
            when(postMapper.findById(POST_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> postService.delete(USER_ID, POST_ID))
                    .isInstanceOf(PostNotFoundException.class);

            verify(postMapper, never()).deleteById(anyLong());
        }

        @Test
        @DisplayName("delete: 他人の投稿なら PostAccessDeniedException を投げ、削除も画像削除もしない")
        void deleteThrowsAccessDenied() {
            when(postMapper.findById(POST_ID)).thenReturn(Optional.of(ownedPost(OTHER_USER_ID, "abc-123.jpg")));

            assertThatThrownBy(() -> postService.delete(USER_ID, POST_ID))
                    .isInstanceOf(PostAccessDeniedException.class);

            verify(postMapper, never()).deleteById(anyLong());
            verify(storageService, never()).delete(anyString());
        }

        @Test
        @DisplayName("delete: 画像付きの投稿を削除すると、画像ファイルも削除する")
        void deleteAlsoRemovesImageFile() {
            when(postMapper.findById(POST_ID)).thenReturn(Optional.of(ownedPost(USER_ID, "abc-123.jpg")));

            postService.delete(USER_ID, POST_ID);

            verify(postMapper).deleteById(POST_ID);
            verify(storageService).delete("abc-123.jpg");
        }

        @Test
        @DisplayName("delete: 画像が無い投稿では、画像削除処理を呼ばない")
        void deleteDoesNotTouchStorageWhenNoImage() {
            when(postMapper.findById(POST_ID)).thenReturn(Optional.of(ownedPost(USER_ID, null)));

            postService.delete(USER_ID, POST_ID);

            verify(postMapper).deleteById(POST_ID);
            verify(storageService, never()).delete(any());
        }
    }

    @Nested
    @DisplayName("投稿1件の取得")
    class GetPost {

        @Test
        @DisplayName("投稿が存在しなければ PostNotFoundException を投げる")
        void throwsWhenNotFound() {
            when(postMapper.selectDetailById(POST_ID, USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> postService.getPost(POST_ID, USER_ID))
                    .isInstanceOf(PostNotFoundException.class);
        }

        @Test
        @DisplayName("画像の保存名は公開URLに変換して返す")
        void convertsImagePathToPublicUrl() {
            when(postMapper.selectDetailById(POST_ID, USER_ID))
                    .thenReturn(Optional.of(detail(POST_ID, "abc-123.jpg")));
            when(storageService.toPublicUrl("abc-123.jpg")).thenReturn("/uploads/abc-123.jpg");

            PostResponse response = postService.getPost(POST_ID, USER_ID);

            assertThat(response.imageUrl()).isEqualTo("/uploads/abc-123.jpg");
        }

        @Test
        @DisplayName("画像が無ければ URL は null にし、変換処理そのものを呼ばない")
        void skipsUrlConversionWhenNoImage() {
            when(postMapper.selectDetailById(POST_ID, USER_ID))
                    .thenReturn(Optional.of(detail(POST_ID, null)));

            assertThat(postService.getPost(POST_ID, USER_ID).imageUrl()).isNull();
            verify(storageService, never()).toPublicUrl(any());
        }
    }

    @Nested
    @DisplayName("タイムラインのページング（境界値）")
    class Paging {

        @ParameterizedTest(name = "[{index}] size={0} のとき {1} 件を要求する")
        @CsvSource({
                "0,   21",   // 下限の外 → 既定20 + 1
                "1,    2",   // 下限ちょうど
                "100, 101",  // 上限ちょうど
                "101,  21",  // 上限の外 → 既定20 + 1
                "-1,   21"   // 負の値 → 既定20 + 1
        })
        @DisplayName("size は 1〜100 の範囲に正規化され、範囲外は既定値20になる")
        void normalizesPageSize(int requestedSize, int expectedLimit) {
            postService.getTimeline(0, requestedSize, USER_ID);

            // 「次のページがあるか」を判定するため、常に表示件数 + 1件 を要求する
            verify(postMapper).selectTimeline(expectedLimit, 0, USER_ID);
        }

        @ParameterizedTest(name = "[{index}] page={0} のとき offset={1}")
        @CsvSource({
                "-1,  0",  // 負のページは0ページ目として扱う
                "0,   0",
                "1,  10",
                "3,  30"
        })
        @DisplayName("page が負なら0ページ目として扱い、offset は page × size で計算する")
        void normalizesPageNumber(int requestedPage, int expectedOffset) {
            postService.getTimeline(requestedPage, 10, USER_ID);

            verify(postMapper).selectTimeline(11, expectedOffset, USER_ID);
        }

        @Test
        @DisplayName("取得件数が表示件数と同じなら、次のページは無いと判定する（20件 → hasNext=false）")
        void hasNextIsFalseWhenExactlyPageSize() {
            when(postMapper.selectTimeline(anyInt(), anyLong(), any())).thenReturn(rows(DEFAULT_PAGE_SIZE));

            PostListResponse response = postService.getTimeline(0, DEFAULT_PAGE_SIZE, USER_ID);

            assertThat(response.hasNext()).isFalse();
            assertThat(response.posts()).hasSize(DEFAULT_PAGE_SIZE);
        }

        @Test
        @DisplayName("表示件数より1件多く取得できたら、次のページがあると判定し、余分な1件は返さない（21件 → hasNext=true・20件）")
        void hasNextIsTrueWhenOneMoreRowExists() {
            when(postMapper.selectTimeline(anyInt(), anyLong(), any())).thenReturn(rows(DEFAULT_PAGE_SIZE + 1));

            PostListResponse response = postService.getTimeline(0, DEFAULT_PAGE_SIZE, USER_ID);

            assertThat(response.hasNext()).isTrue();
            // 21件目は「次があるか」を知るためだけに取得した行なので、画面には出さない
            assertThat(response.posts()).hasSize(DEFAULT_PAGE_SIZE);
        }

        @Test
        @DisplayName("投稿が1件も無ければ、空のリストと hasNext=false を返す")
        void returnsEmptyResultWhenNoPosts() {
            when(postMapper.selectTimeline(anyInt(), anyLong(), any())).thenReturn(List.of());

            PostListResponse response = postService.getTimeline(0, DEFAULT_PAGE_SIZE, USER_ID);

            assertThat(response.posts()).isEmpty();
            assertThat(response.hasNext()).isFalse();
        }

        @Test
        @DisplayName("正規化した後のページ番号を返す（-1 を指定しても 0 が返る）")
        void returnsNormalizedPageNumber() {
            assertThat(postService.getTimeline(-1, DEFAULT_PAGE_SIZE, USER_ID).page()).isZero();
        }

        @Test
        @DisplayName("フォロー中タイムラインも同じ規則でページングする")
        void followingTimelineUsesSameRules() {
            postService.getFollowingTimeline(1, 10, USER_ID);

            verify(postMapper).selectFollowingTimeline(11, 10, USER_ID);
        }

        @Test
        @DisplayName("プロフィールの投稿一覧も同じ規則でページングする")
        void postsByAuthorUseSameRules() {
            postService.getPostsByAuthor(OTHER_USER_ID, 1, 10, USER_ID);

            verify(postMapper).selectByAuthorId(OTHER_USER_ID, 11, 10, USER_ID);
        }
    }

    /**
     * ブラウザの通常操作では起こらないが、URLを手で書き換えれば誰でも送れる入力を確かめる（Issue #79）。
     *
     * <p><strong>ページ位置のけた溢れについて（Issue #82 で修正）。</strong>
     * {@code offset} は {@code page × size} で求めるが、{@code page} には上限が無い
     * （{@code Math.max(page, 0)} で下限だけ押さえている）。
     * {@code int} は約21億までしか表せないため、以前は掛け算の結果が範囲を超えると
     * <strong>一周して負の数になり</strong>、負の {@code OFFSET} を PostgreSQL が拒否して 500 になっていた。
     *
     * <p>いまは {@code long} で計算しているので、けた溢れる余地そのものが無い
     * （{@code int} の最大値 × ページサイズの上限100 でも約2,147億で、{@code long} の上限の
     * 100万分の1にも届かない）。<strong>ここで守っているのは「大きなページ番号でも
     * 正しい位置を渡すこと」。</strong>境目の前後を対で置いて、片方だけ壊れたときに気づけるようにする。</p>
     */
    @Nested
    @DisplayName("想定外の入力（極端なページ番号・絵文字）")
    class UnexpectedInput {

        /** 掛け算の結果が int に収まる最大のページ番号（× 20 = 2147483640） */
        private static final int LARGEST_PAGE_FITTING_IN_INT = 107374182;

        /** 掛け算の結果が int の範囲を超える最小のページ番号（× 20 = 2147483660） */
        private static final int SMALLEST_PAGE_EXCEEDING_INT = 107374183;

        @Test
        @DisplayName("掛け算の結果が int に収まる範囲では、正しい offset を渡す（境界の内側）")
        void passesCorrectOffsetWhenProductFitsInInt() {
            long expected = (long) LARGEST_PAGE_FITTING_IN_INT * DEFAULT_PAGE_SIZE;
            // 前提の明示: ここはまだ int に収まっている
            assertThat(expected).isLessThanOrEqualTo(Integer.MAX_VALUE);

            postService.getTimeline(LARGEST_PAGE_FITTING_IN_INT, DEFAULT_PAGE_SIZE, USER_ID);

            verify(postMapper).selectTimeline(DEFAULT_PAGE_SIZE + 1, expected, USER_ID);
        }

        @Test
        @DisplayName("ページ番号が1つ大きく、掛け算が int の範囲を超えても、正しい offset を渡す（境界の外側）")
        void passesCorrectOffsetWhenProductExceedsInt() {
            long expected = (long) SMALLEST_PAGE_EXCEEDING_INT * DEFAULT_PAGE_SIZE;
            // 前提の明示: int で計算していたら一周して負になっていた値
            assertThat(expected).isGreaterThan(Integer.MAX_VALUE);
            assertThat(SMALLEST_PAGE_EXCEEDING_INT * DEFAULT_PAGE_SIZE).isNegative();

            postService.getTimeline(SMALLEST_PAGE_EXCEEDING_INT, DEFAULT_PAGE_SIZE, USER_ID);

            verify(postMapper).selectTimeline(DEFAULT_PAGE_SIZE + 1, expected, USER_ID);
        }

        @Test
        @DisplayName("ページ番号が int の最大値でも、正しい offset を渡す")
        void passesCorrectOffsetForMaxIntPage() {
            long expected = (long) Integer.MAX_VALUE * DEFAULT_PAGE_SIZE;

            postService.getTimeline(Integer.MAX_VALUE, DEFAULT_PAGE_SIZE, USER_ID);

            verify(postMapper).selectTimeline(DEFAULT_PAGE_SIZE + 1, expected, USER_ID);
        }

        @Test
        @DisplayName("フォロー中タイムラインでも、int の範囲を超える位置で正しい offset を渡す")
        void followingTimelineHandlesLargeOffset() {
            long expected = (long) SMALLEST_PAGE_EXCEEDING_INT * DEFAULT_PAGE_SIZE;

            postService.getFollowingTimeline(SMALLEST_PAGE_EXCEEDING_INT, DEFAULT_PAGE_SIZE, USER_ID);

            verify(postMapper).selectFollowingTimeline(DEFAULT_PAGE_SIZE + 1, expected, USER_ID);
        }

        @Test
        @DisplayName("プロフィールの投稿一覧でも、int の範囲を超える位置で正しい offset を渡す")
        void postsByAuthorHandlesLargeOffset() {
            long expected = (long) SMALLEST_PAGE_EXCEEDING_INT * DEFAULT_PAGE_SIZE;

            postService.getPostsByAuthor(OTHER_USER_ID, SMALLEST_PAGE_EXCEEDING_INT, DEFAULT_PAGE_SIZE, USER_ID);

            verify(postMapper).selectByAuthorId(OTHER_USER_ID, DEFAULT_PAGE_SIZE + 1, expected, USER_ID);
        }

        @Test
        @DisplayName("投稿検索でも、int の範囲を超える位置で正しい offset を渡す")
        void searchPostsHandlesLargeOffset() {
            long expected = (long) SMALLEST_PAGE_EXCEEDING_INT * DEFAULT_PAGE_SIZE;
            when(searchKeyword.normalize("天気")).thenReturn("天気");

            postService.searchPosts("天気", SMALLEST_PAGE_EXCEEDING_INT, DEFAULT_PAGE_SIZE, USER_ID);

            verify(postMapper).selectByKeyword("天気", DEFAULT_PAGE_SIZE + 1, expected, USER_ID);
        }

        @Test
        @DisplayName("絵文字は2文字として数えるため、140個ちょうどなら保存できる（上限ちょうど）")
        void acceptsExactlyMaxLengthOfEmoji() {
            // 絵文字は Java の String では2つ分の長さを占める（サロゲートペア）。
            // 280文字の上限は「絵文字140個」に相当する。フロントの残り文字数表示も
            // JavaScript の String#length を使っており、同じ数え方になっている。
            String content = EMOJI.repeat(MAX_CONTENT_LENGTH / 2);
            assertThat(content.length()).isEqualTo(MAX_CONTENT_LENGTH);
            when(postMapper.selectDetailById(any(), any())).thenReturn(Optional.of(detail(POST_ID, null)));

            postService.create(USER_ID, new PostCreateRequest(content, null));

            verify(postMapper).insert(any(Post.class));
        }

        @Test
        @DisplayName("絵文字141個は282文字ぶんになるため拒否し、保存しない（上限の外）")
        void rejectsEmojiOverMaxLength() {
            String content = EMOJI.repeat(MAX_CONTENT_LENGTH / 2 + 1);
            assertThat(content.length()).isEqualTo(MAX_CONTENT_LENGTH + 2);

            assertThatThrownBy(() -> postService.create(USER_ID, new PostCreateRequest(content, null)))
                    .isInstanceOf(InvalidPostContentException.class);

            verify(postMapper, never()).insert(any());
        }
    }

    @Nested
    @DisplayName("投稿検索")
    class SearchPosts {

        @Test
        @DisplayName("キーワードが空になるならDBに問い合わせず、空の結果を返す")
        void doesNotQueryDatabaseForBlankKeyword() {
            when(searchKeyword.normalize("   ")).thenReturn("");

            PostListResponse response = postService.searchPosts("   ", 0, 20, USER_ID);

            assertThat(response.posts()).isEmpty();
            assertThat(response.hasNext()).isFalse();
            // 空文字で検索すると ILIKE '%%' が全投稿に一致してしまう
            verify(postMapper, never()).selectByKeyword(anyString(), anyInt(), anyLong(), any());
        }

        @Test
        @DisplayName("エスケープ済みのキーワードをDBに渡す")
        void passesEscapedKeywordToMapper() {
            when(searchKeyword.normalize("50%")).thenReturn("50\\%");

            postService.searchPosts("50%", 0, 20, USER_ID);

            verify(postMapper).selectByKeyword("50\\%", 21, 0, USER_ID);
        }

        @Test
        @DisplayName("検索結果でも「次のページがあるか」を同じ規則で判定する")
        void appliesSamePagingRule() {
            when(searchKeyword.normalize(anyString())).thenReturn("テスト");
            when(postMapper.selectByKeyword(anyString(), anyInt(), anyLong(), any()))
                    .thenReturn(rows(DEFAULT_PAGE_SIZE + 1));

            PostListResponse response = postService.searchPosts("テスト", 0, DEFAULT_PAGE_SIZE, USER_ID);

            assertThat(response.hasNext()).isTrue();
            assertThat(response.posts()).hasSize(DEFAULT_PAGE_SIZE);
        }
    }

    @Nested
    @DisplayName("新着投稿")
    class NewPosts {

        @Test
        @DisplayName("countNewerThan: 基準IDが負なら0として扱う（初回読み込みと同じ扱いにする）")
        void normalizesNegativeAfterId() {
            postService.getNewPostsCount(-5);

            verify(postMapper).countNewerThan(0);
        }

        @Test
        @DisplayName("countNewerThan: Mapper が返した件数をそのまま返す")
        void returnsCountFromMapper() {
            when(postMapper.countNewerThan(100)).thenReturn(3L);

            assertThat(postService.getNewPostsCount(100).count()).isEqualTo(3L);
        }

        @Test
        @DisplayName("getNewPosts: 上限50件ちょうどなら、まだ続きがあるとは判定しない")
        void hasMoreIsFalseWhenExactlyAtLimit() {
            when(postMapper.selectNewerThan(anyLong(), anyInt(), any())).thenReturn(rows(50));

            var response = postService.getNewPosts(0, USER_ID);

            assertThat(response.hasMore()).isFalse();
            assertThat(response.posts()).hasSize(50);
        }

        @Test
        @DisplayName("getNewPosts: 上限より1件多ければ続きがあると判定し、余分な1件は返さない")
        void hasMoreIsTrueWhenOneMoreRowExists() {
            when(postMapper.selectNewerThan(anyLong(), anyInt(), any())).thenReturn(rows(51));

            var response = postService.getNewPosts(0, USER_ID);

            assertThat(response.hasMore()).isTrue();
            assertThat(response.posts()).hasSize(50);
        }

        @Test
        @DisplayName("getNewPosts: 基準IDが負なら0として扱う")
        void normalizesNegativeAfterIdForList() {
            postService.getNewPosts(-5, USER_ID);

            verify(postMapper).selectNewerThan(0, 51, USER_ID);
        }
    }
}
