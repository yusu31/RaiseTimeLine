package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.Post;
import com.raisetech.raisetimeline.exception.PostNotFoundException;
import com.raisetech.raisetimeline.mapper.LikeMapper;
import com.raisetech.raisetimeline.mapper.PostMapper;
import com.raisetech.raisetimeline.response.LikeStatusResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link LikeService} のテスト。DBには接続せず、Mapper をモック（偽物）に差し替える。
 *
 * <p>ここで確かめたいのは <strong>「判断の正しさ」</strong>であって SQL の正しさではない。
 * SQL が正しいかどうかは {@code LikeMapperTest} が実DBで確認している。役割を分けている。</p>
 */
@ExtendWith(MockitoExtension.class)
class LikeServiceTest {

    private static final long USER_ID = 10L;
    private static final long POST_ID = 100L;

    @Mock
    private LikeMapper likeMapper;

    @Mock
    private PostMapper postMapper;

    @InjectMocks
    private LikeService likeService;

    private void givenPostExists() {
        Post post = new Post();
        post.setId(POST_ID);
        post.setUserId(USER_ID);
        when(postMapper.findById(POST_ID)).thenReturn(Optional.of(post));
    }

    @Test
    @DisplayName("like: 投稿が存在しなければ PostNotFoundException を投げ、いいねの登録は行わない")
    void likeThrowsWhenPostNotFound() {
        when(postMapper.findById(POST_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> likeService.like(USER_ID, POST_ID))
                .isInstanceOf(PostNotFoundException.class);

        // 存在しない投稿へのいいねが、DBに書き込まれないことまで確認する。
        // 例外が飛ぶことだけを見ていると、「例外の前に書き込んでいた」場合を見逃す
        verify(likeMapper, never()).insertIgnoreDuplicate(anyLong(), anyLong());
    }

    @Test
    @DisplayName("like: いいねを登録し、登録後の件数と自分のいいね状態を返す")
    void likeRegistersAndReturnsCurrentStatus() {
        givenPostExists();
        when(likeMapper.countByPostId(POST_ID)).thenReturn(1);
        when(likeMapper.exists(POST_ID, USER_ID)).thenReturn(true);

        LikeStatusResponse response = likeService.like(USER_ID, POST_ID);

        verify(likeMapper).insertIgnoreDuplicate(POST_ID, USER_ID);
        assertThat(response.likeCount()).isEqualTo(1);
        assertThat(response.likedByMe()).isTrue();
    }

    @Test
    @DisplayName("unlike: 投稿が存在しなければ PostNotFoundException を投げ、削除は行わない")
    void unlikeThrowsWhenPostNotFound() {
        when(postMapper.findById(POST_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> likeService.unlike(USER_ID, POST_ID))
                .isInstanceOf(PostNotFoundException.class);

        verify(likeMapper, never()).delete(anyLong(), anyLong());
    }

    @Test
    @DisplayName("unlike: いいねを取り消し、取り消し後の件数と自分のいいね状態を返す")
    void unlikeRemovesAndReturnsCurrentStatus() {
        givenPostExists();
        when(likeMapper.countByPostId(POST_ID)).thenReturn(0);
        when(likeMapper.exists(POST_ID, USER_ID)).thenReturn(false);

        LikeStatusResponse response = likeService.unlike(USER_ID, POST_ID);

        verify(likeMapper).delete(POST_ID, USER_ID);
        assertThat(response.likeCount()).isZero();
        assertThat(response.likedByMe()).isFalse();
    }

    @Test
    @DisplayName("like: 他人がいいねしている投稿にいいねすると、件数は増えるが likedByMe は自分の状態を返す")
    void likeReturnsViewerSpecificStatus() {
        givenPostExists();
        when(likeMapper.countByPostId(POST_ID)).thenReturn(3);
        when(likeMapper.exists(POST_ID, USER_ID)).thenReturn(true);

        LikeStatusResponse response = likeService.like(USER_ID, POST_ID);

        // 件数（みんなの合計）と likedByMe（自分の状態）は別の情報。取り違えないこと
        assertThat(response.likeCount()).isEqualTo(3);
        assertThat(response.likedByMe()).isTrue();
    }

    @Test
    @DisplayName("like: 投稿の存在確認を先に行ってから、いいねを登録する")
    void checksPostExistenceBeforeInserting() {
        when(postMapper.findById(POST_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> likeService.like(USER_ID, POST_ID))
                .isInstanceOf(PostNotFoundException.class);

        // 存在確認が「後」だと、外部キー違反による500が先に発生してしまう。
        // 404 を返すためには順序が重要になる
        verify(postMapper).findById(POST_ID);
        verify(likeMapper, never()).insertIgnoreDuplicate(any(), any());
    }
}
