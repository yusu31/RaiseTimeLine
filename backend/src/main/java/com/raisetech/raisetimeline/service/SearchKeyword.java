package com.raisetech.raisetimeline.service;

import org.springframework.stereotype.Component;

/**
 * 検索キーワードを LIKE / ILIKE に安全に渡せる形へ整える。
 * ユーザー検索（F-10）と投稿検索（F-09）が共有する唯一のルールとして切り出している。
 * （各サービスにコピーすると、片方だけ修正して挙動がずれる事故が起きるため）
 */
@Component
public class SearchKeyword {

    /**
     * 前後の空白を取り除き、LIKE のワイルドカード（{@code %} {@code _}）をエスケープする。
     * <p>
     * 検索すべきでない入力（null・空文字・空白のみ）に対しては空文字を返す。
     * 呼び出し側は戻り値が空かどうかだけを見て「DBに問い合わせない」判断ができる。
     * <p>
     * なお MyBatis の {@code #{}} を使っている限り SQLインジェクションは発生しない。
     * ここで防いでいるのは「SQLは壊れないが検索の意味が壊れる」という別種の問題で、
     * エスケープしないと {@code %} 1文字の検索が {@code LIKE '%%%'} となり全件に一致してしまう。
     */
    public String normalize(String keyword) {
        String trimmed = keyword == null ? "" : keyword.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        // バックスラッシュを必ず最初に置換する。順番を逆にすると、
        // 後の処理が「自分で足したエスケープ文字」まで二重に変換して意味が壊れる
        return trimmed
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
