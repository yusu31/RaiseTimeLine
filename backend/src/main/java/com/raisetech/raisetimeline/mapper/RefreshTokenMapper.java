package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.RefreshToken;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

import java.util.Optional;

@Mapper
public interface RefreshTokenMapper {

    @Insert("INSERT INTO refresh_tokens (user_id, token, expires_at) "
            + "VALUES (#{userId}, #{token}, #{expiresAt})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(RefreshToken refreshToken);

    @Select("SELECT * FROM refresh_tokens WHERE token = #{token}")
    Optional<RefreshToken> findByToken(String token);

    @Delete("DELETE FROM refresh_tokens WHERE token = #{token}")
    void deleteByToken(String token);
}
