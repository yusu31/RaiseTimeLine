package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.RefreshToken;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;

/**
 * SQLはすべて resources/mapper/RefreshTokenMapper.xml に定義する。
 */
@Mapper
public interface RefreshTokenMapper {

    void insert(RefreshToken refreshToken);

    Optional<RefreshToken> findByToken(@Param("token") String token);

    void deleteByToken(@Param("token") String token);
}
