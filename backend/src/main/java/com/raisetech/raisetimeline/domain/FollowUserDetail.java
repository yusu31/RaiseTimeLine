package com.raisetech.raisetimeline.domain;

/**
 * フォロー中／フォロワー一覧の1行。follows と users を JOIN した読み取り専用の結果。
 * 一覧の各行にフォローボタンを出すため、閲覧者から見た followedByMe を同じクエリで取得する。
 */
public class FollowUserDetail {

    private Long id;
    private String username;
    private String displayName;
    private String iconImagePath;
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

    public String getIconImagePath() {
        return iconImagePath;
    }

    public void setIconImagePath(String iconImagePath) {
        this.iconImagePath = iconImagePath;
    }

    public boolean isFollowedByMe() {
        return followedByMe;
    }

    public void setFollowedByMe(boolean followedByMe) {
        this.followedByMe = followedByMe;
    }
}
