package com.raisetech.raisetimeline.request;

import org.springframework.web.multipart.MultipartFile;

/**
 * multipart/form-data で受け取った投稿作成パラメータをServiceへ渡すための値オブジェクト。
 * Controllerで {@code @RequestParam} を個別に受け取って組み立てる（recordのままではMultipartFileとの
 * バインディングが不安定になりやすいため、あえて {@code @RequestBody} にしていない）。
 */
public record PostCreateRequest(String content, MultipartFile image) {
}
