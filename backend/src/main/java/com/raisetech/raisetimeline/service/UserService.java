package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.User;
import com.raisetech.raisetimeline.exception.UserNotFoundException;
import com.raisetech.raisetimeline.exception.UsernameAlreadyExistsException;
import com.raisetech.raisetimeline.mapper.UserMapper;
import com.raisetech.raisetimeline.request.ProfileUpdateRequest;
import com.raisetech.raisetimeline.response.UserProfileResponse;
import com.raisetech.raisetimeline.response.UserResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional
public class UserService {

    private final UserMapper userMapper;
    private final StorageService storageService;

    public UserService(UserMapper userMapper, StorageService storageService) {
        this.userMapper = userMapper;
        this.storageService = storageService;
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String username) {
        User user = findByUsernameOrThrow(username);
        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getBio(),
                toIconUrl(user.getIconImagePath()),
                user.getCreatedAt());
    }

    public UserResponse updateProfile(Long userId, ProfileUpdateRequest request) {
        User user = findByIdOrThrow(userId);

        // 自分自身は重複判定から除外する。除外しないと
        // 「@ユーザー名を変えずに表示名だけ直して保存」しただけで409になってしまう
        if (userMapper.existsByUsernameExcludingSelf(request.username(), userId)) {
            throw new UsernameAlreadyExistsException("そのユーザー名は既に使われています");
        }

        userMapper.updateProfile(userId, request.displayName(), request.username(), request.bio());
        return toUserResponse(findByIdOrThrow(user.getId()));
    }

    public UserResponse updateIcon(Long userId, MultipartFile image) {
        User user = findByIdOrThrow(userId);
        String previousPath = user.getIconImagePath();

        // 「新ファイル保存 → DB更新 → 旧ファイル削除」の順を守る。
        // 先に旧ファイルを消すと、DB更新に失敗したときアイコンだけ失われる
        String newPath = storageService.store(image);
        userMapper.updateIconImagePath(userId, newPath);
        if (previousPath != null) {
            storageService.delete(previousPath);
        }

        return toUserResponse(findByIdOrThrow(userId));
    }

    @Transactional(readOnly = true)
    public User findByUsernameOrThrow(String username) {
        return userMapper.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));
    }

    private User findByIdOrThrow(Long id) {
        return userMapper.findById(id)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getEmail(), toIconUrl(user.getIconImagePath()));
    }

    private String toIconUrl(String iconImagePath) {
        return iconImagePath != null ? storageService.toPublicUrl(iconImagePath) : null;
    }
}
