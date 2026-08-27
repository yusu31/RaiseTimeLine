package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.FollowUserDetail;
import com.raisetech.raisetimeline.domain.User;
import com.raisetech.raisetimeline.exception.SelfFollowException;
import com.raisetech.raisetimeline.exception.UserNotFoundException;
import com.raisetech.raisetimeline.mapper.FollowMapper;
import com.raisetech.raisetimeline.mapper.UserMapper;
import com.raisetech.raisetimeline.response.FollowStatusResponse;
import com.raisetech.raisetimeline.response.FollowUserResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class FollowService {

    private final FollowMapper followMapper;
    private final UserMapper userMapper;
    private final StorageService storageService;

    public FollowService(FollowMapper followMapper, UserMapper userMapper, StorageService storageService) {
        this.followMapper = followMapper;
        this.userMapper = userMapper;
        this.storageService = storageService;
    }

    public FollowStatusResponse follow(Long followerId, String targetUsername) {
        User target = findByUsernameOrThrow(targetUsername);

        // DBのCHECK制約(ck_follows_not_self)に任せてはいけない。
        // ON CONFLICT DO NOTHING が無害化できるのはUNIQUE違反(23505)だけで、
        // CHECK違反(23514)は素通りして汎用ハンドラに落ち、500になってしまう
        if (followerId.equals(target.getId())) {
            throw new SelfFollowException("自分自身をフォローすることはできません");
        }

        followMapper.insertIgnoreDuplicate(followerId, target.getId());
        return currentStatus(target.getId(), followerId);
    }

    public FollowStatusResponse unfollow(Long followerId, String targetUsername) {
        User target = findByUsernameOrThrow(targetUsername);
        // 未フォロー状態で解除しても0件削除されるだけなので、冪等に成功させる
        followMapper.delete(followerId, target.getId());
        return currentStatus(target.getId(), followerId);
    }

    @Transactional(readOnly = true)
    public List<FollowUserResponse> getFollowing(String username, Long currentUserId) {
        User target = findByUsernameOrThrow(username);
        return toResponses(followMapper.selectFollowing(target.getId(), currentUserId));
    }

    @Transactional(readOnly = true)
    public List<FollowUserResponse> getFollowers(String username, Long currentUserId) {
        User target = findByUsernameOrThrow(username);
        return toResponses(followMapper.selectFollowers(target.getId(), currentUserId));
    }

    private User findByUsernameOrThrow(String username) {
        return userMapper.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));
    }

    private FollowStatusResponse currentStatus(Long targetId, Long followerId) {
        int followerCount = followMapper.countFollowers(targetId);
        boolean followedByMe = followMapper.exists(followerId, targetId);
        return new FollowStatusResponse(followerCount, followedByMe);
    }

    private List<FollowUserResponse> toResponses(List<FollowUserDetail> details) {
        return details.stream().map(this::toResponse).toList();
    }

    private FollowUserResponse toResponse(FollowUserDetail detail) {
        String iconImageUrl = detail.getIconImagePath() != null
                ? storageService.toPublicUrl(detail.getIconImagePath())
                : null;
        return new FollowUserResponse(detail.getId(), detail.getUsername(), detail.getDisplayName(),
                iconImageUrl, detail.isFollowedByMe());
    }
}
