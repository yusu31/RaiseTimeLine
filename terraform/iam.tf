# ECSタスクが引き受ける(Assume)ための共通の「信頼ポリシー」。
# 「ECSのタスク(ecs-tasks.amazonaws.com)だけがこのロールを使える」と宣言する
data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ① タスク実行ロール: ECS(AWS側のエージェント)がコンテナを起動する「前」に使う権限。
#    イメージをECRから取得する・ログをCloudWatch Logsに書く・DBパスワードとJWT署名鍵をSecrets Managerから読む
resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.project_name}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = {
    Name = "${var.project_name}-ecs-task-execution"
  }
}

# ECR取得とログ出力に必要な権限一式はAWSが用意した管理ポリシーを使う
resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# DBパスワードとJWT署名鍵の2つのシークレットだけを読めるようにする(他のシークレットは読めない=最小権限)
resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "read-app-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_db_instance.main.master_user_secret[0].secret_arn,
        aws_secretsmanager_secret.jwt_secret.arn,
      ]
    }]
  })
}

# ② タスクロール: 起動した「アプリ自身」がAWSを操作するときの権限。
#    アプリはS3へ画像を保存・削除するだけなので、その2操作を画像バケットに限って許可する
resource "aws_iam_role" "ecs_task" {
  name               = "${var.project_name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = {
    Name = "${var.project_name}-ecs-task"
  }
}

resource "aws_iam_role_policy" "ecs_task_s3_images" {
  name = "write-image-bucket"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:DeleteObject"]
      Resource = "arn:aws:s3:::${var.image_bucket_name}/*"
    }]
  })
}
