package com.raisetech.raisetimeline.service;

import org.springframework.web.multipart.MultipartFile;

/**
 * 画像などのファイル保存処理を抽象化するインターフェース。
 * 実装は {@code app.storage.type} の設定で切り替わり、Beanは常にどちらか一方だけが登録される
 * （{@code local} → {@link LocalStorageService} / {@code s3} → S3実装）。
 * そのため利用側の Service は実装を意識せず、このインターフェースを注入するだけでよい。
 */
public interface StorageService {

    /**
     * ファイルを保存し、DBに残す識別子（ファイル名）を返す。
     */
    String store(MultipartFile file);

    /**
     * 保存済みファイルの識別子を、フロントエンドの {@code <img src>} 用URLに変換する。
     *
     * <p>戻り値は有効期限を持たない恒久的なURLであることを前提としている。
     * 将来これを署名付きURL（presigned URL）へ変更する場合、有効期限を表現できないため
     * このシグネチャの変更（有効期限の引数追加など）が必要になる。</p>
     */
    String toPublicUrl(String storedPath);

    /**
     * 保存済みファイルを削除する。
     */
    void delete(String storedPath);
}
