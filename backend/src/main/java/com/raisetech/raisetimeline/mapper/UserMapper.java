package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.User;
import com.raisetech.raisetimeline.domain.UserProfileDetail;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;

/**
 * SQLはすべて resources/mapper/UserMapper.xml に定義する。
 */
@Mapper
public interface UserMapper {

    void insert(User user);

    Optional<User> findByEmail(@Param("email") String email);

    Optional<User> findById(@Param("id") Long id);

    Optional<User> findByUsername(@Param("username") String username);

    /**
     * プロフィール画面用。フォロー数・フォロー中フラグを1クエリで同時に取得する。
     * currentUserId は閲覧者のID（followedByMe の判定に使う）。
     */
    Optional<UserProfileDetail> selectProfileByUsername(@Param("username") String username,
                                                        @Param("currentUserId") Long currentUserId);

    boolean existsByEmail(@Param("email") String email);

    boolean existsByUsername(@Param("username") String username);

    /**
     * 自分自身を除いて @ユーザー名 の重複を調べる。
     * プロフィール編集では「変更せずに保存」もありうるため、自分の現在の名前は重複扱いにしない。
     */
    boolean existsByUsernameExcludingSelf(@Param("username") String username, @Param("selfId") Long selfId);

    void updateProfile(@Param("id") Long id, @Param("displayName") String displayName,
                       @Param("username") String username, @Param("bio") String bio);

    void updateIconImagePath(@Param("id") Long id, @Param("iconImagePath") String iconImagePath);
}
