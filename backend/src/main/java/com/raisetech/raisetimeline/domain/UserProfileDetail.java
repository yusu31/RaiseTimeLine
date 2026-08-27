package com.raisetech.raisetimeline.domain;

import java.time.LocalDateTime;

/**
 * プロフィール画面用の読み取り専用の結果。
 * フォロー数とフォロー中フラグを相関サブクエリで同時に取得するため、
 * users テーブルをそのまま表す {@link User} とは別のクラスにしている
 * （プロフィール取得・フォロー数・フォロー判定を3回に分けて問い合わせるとN+1になる）。
 */
public class UserProfileDetail {

    private Long id;
    private String username;
    private String displayName;
    private String bio;
    private String iconImagePath;
    private LocalDateTime createdAt;
    private int followingCount;
    private int followerCount;
    private boolean followedByMe;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getIconImagePath() {
        return iconImagePath;
    }

    public void setIconImagePath(String iconImagePath) {
        this.iconImagePath = iconImagePath;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public int getFollowingCount() {
        return followingCount;
    }

    public void setFollowingCount(int followingCount) {
        this.followingCount = followingCount;
    }

    public int getFollowerCount() {
        return followerCount;
    }

    public void setFollowerCount(int followerCount) {
        this.followerCount = followerCount;
    }

    public boolean isFollowedByMe() {
        return followedByMe;
    }

    public void setFollowedByMe(boolean followedByMe) {
        this.followedByMe = followedByMe;
    }
}
