package com.raisetech.raisetimeline.service;

import org.springframework.web.multipart.MultipartFile;

/**
 * 画像などのファイル保存処理を抽象化するインターフェース。
 * ローカル開発中は {@link LocalStorageService}（ファイルシステム保存）を使用し、
 * デプロイフェーズで AWS S3 実装（例: S3StorageService）に差し替える想定。
 */
public interface StorageService {

    /**
     * ファイルを保存し、DBに残す識別子（ファイル名）を返す。
     */
    String store(MultipartFile file);

    /**
     * 保存済みファイルの識別子を、フロントエンドの {@code <img src>} 用URLに変換する。
     */
    String toPublicUrl(String storedPath);

    /**
     * 保存済みファイルを削除する。
     */
    void delete(String storedPath);
}
