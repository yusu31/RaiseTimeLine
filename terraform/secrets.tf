# JWT署名鍵: ランダムな48文字を生成し、Secrets Managerに保管する。
# 公開リポジトリの application.yml にある既定値は使わず、ECSタスクへ環境変数 JWT_SECRET として注入する。
# 特殊文字を含めないのは、環境変数として扱うときの記号まわりの事故を避けるため
resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.project_name}-jwt-secret"
  description = "JWT signing key for the backend"

  # 通常は削除しても30日間は同名で作り直せない。apply→確認→destroy を繰り返す運用のため、即時削除にする
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-jwt-secret"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}
