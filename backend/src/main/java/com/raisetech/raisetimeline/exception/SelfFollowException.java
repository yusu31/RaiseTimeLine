package com.raisetech.raisetimeline.exception;

/**
 * 自分自身をフォローしようとしたときに投げる。
 * DBのCHECK制約(ck_follows_not_self)違反はSQLSTATE 23514で、
 * ON CONFLICT DO NOTHING（UNIQUE違反=23505のみ対象）では無害化できず500になってしまうため、
 * アプリ側で先に弾いて400を返す。
 */
public class SelfFollowException extends RuntimeException {

    public SelfFollowException(String message) {
        super(message);
    }
}
