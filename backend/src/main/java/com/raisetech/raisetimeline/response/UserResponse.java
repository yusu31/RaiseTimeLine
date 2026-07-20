package com.raisetech.raisetimeline.response;

public record UserResponse(
        Long id,
        String displayName,
        String email
) {
}
