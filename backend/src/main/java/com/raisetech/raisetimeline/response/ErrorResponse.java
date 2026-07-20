package com.raisetech.raisetimeline.response;

public record ErrorResponse(
        int status,
        String error,
        String message
) {
}
