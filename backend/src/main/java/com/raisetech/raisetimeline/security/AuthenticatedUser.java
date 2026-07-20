package com.raisetech.raisetimeline.security;

public record AuthenticatedUser(
        Long id,
        String email,
        String displayName
) {
}
