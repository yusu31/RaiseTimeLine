package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.User;
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

    boolean existsByEmail(@Param("email") String email);

    boolean existsByUsername(@Param("username") String username);
}
