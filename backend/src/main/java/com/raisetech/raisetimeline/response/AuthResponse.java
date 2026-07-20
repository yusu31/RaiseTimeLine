package com.raisetech.raisetimeline.response;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        UserResponse user
) {
}
