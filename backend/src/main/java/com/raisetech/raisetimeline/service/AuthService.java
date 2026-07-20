package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.config.JwtProperties;
import com.raisetech.raisetimeline.domain.RefreshToken;
import com.raisetech.raisetimeline.domain.User;
import com.raisetech.raisetimeline.exception.EmailAlreadyExistsException;
import com.raisetech.raisetimeline.exception.InvalidCredentialsException;
import com.raisetech.raisetimeline.exception.InvalidRefreshTokenException;
import com.raisetech.raisetimeline.mapper.RefreshTokenMapper;
import com.raisetech.raisetimeline.mapper.UserMapper;
import com.raisetech.raisetimeline.request.LoginRequest;
import com.raisetech.raisetimeline.request.SignupRequest;
import com.raisetech.raisetimeline.response.AuthResponse;
import com.raisetech.raisetimeline.response.RefreshResponse;
import com.raisetech.raisetimeline.response.UserResponse;
import com.raisetech.raisetimeline.security.AuthenticatedUser;
import com.raisetech.raisetimeline.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@Transactional
public class AuthService {

    private static final String LOGIN_ERROR_MESSAGE = "メールアドレスまたはパスワードが正しくありません";

    private final UserMapper userMapper;
    private final RefreshTokenMapper refreshTokenMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtProperties jwtProperties;

    public AuthService(
            UserMapper userMapper,
            RefreshTokenMapper refreshTokenMapper,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            JwtProperties jwtProperties
    ) {
        this.userMapper = userMapper;
        this.refreshTokenMapper = refreshTokenMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.jwtProperties = jwtProperties;
    }

    public AuthResponse signup(SignupRequest request) {
        if (userMapper.existsByEmail(request.email())) {
            throw new EmailAlreadyExistsException("このメールアドレスは既に登録されています");
        }

        User user = new User();
        user.setEmail(request.email());
        user.setDisplayName(request.displayName());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userMapper.insert(user);

        return issueTokens(user);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userMapper.findByEmail(request.email())
                .orElseThrow(() -> new InvalidCredentialsException(LOGIN_ERROR_MESSAGE));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException(LOGIN_ERROR_MESSAGE);
        }

        return issueTokens(user);
    }

    public RefreshResponse refresh(String refreshTokenValue) {
        RefreshToken refreshToken = refreshTokenMapper.findByToken(refreshTokenValue)
                .orElseThrow(() -> new InvalidRefreshTokenException("リフレッシュトークンが無効です"));

        if (refreshToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            refreshTokenMapper.deleteByToken(refreshTokenValue);
            throw new InvalidRefreshTokenException("リフレッシュトークンの有効期限が切れています");
        }

        User user = userMapper.findById(refreshToken.getUserId())
                .orElseThrow(() -> new InvalidRefreshTokenException("リフレッシュトークンが無効です"));

        String accessToken = jwtTokenProvider.generateAccessToken(
                new AuthenticatedUser(user.getId(), user.getEmail(), user.getDisplayName()));
        return new RefreshResponse(accessToken);
    }

    public void logout(String refreshTokenValue) {
        refreshTokenMapper.deleteByToken(refreshTokenValue);
    }

    private AuthResponse issueTokens(User user) {
        AuthenticatedUser authenticatedUser = new AuthenticatedUser(user.getId(), user.getEmail(), user.getDisplayName());
        String accessToken = jwtTokenProvider.generateAccessToken(authenticatedUser);

        String refreshTokenValue = UUID.randomUUID().toString();
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUserId(user.getId());
        refreshToken.setToken(refreshTokenValue);
        refreshToken.setExpiresAt(LocalDateTime.now().plus(jwtProperties.refreshTokenValidity()));
        refreshTokenMapper.insert(refreshToken);

        UserResponse userResponse = new UserResponse(user.getId(), user.getDisplayName(), user.getEmail());
        return new AuthResponse(accessToken, refreshTokenValue, userResponse);
    }
}
