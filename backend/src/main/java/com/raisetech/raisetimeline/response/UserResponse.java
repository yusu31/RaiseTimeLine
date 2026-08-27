package com.raisetech.raisetimeline.response;

public record UserResponse(
        Long id,
        String username,
        String displayName,
        String email,
        String iconImageUrl
) {
}
