package com.raisetech.raisetimeline.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(max = 50) String displayName,
        @NotBlank @Size(min = 8, max = 72) String password
) {
}
