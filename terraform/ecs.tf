# ECSクラスター(タスクを置く論理的なグループ。Fargateなので管理するサーバーは無い)
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

# コンテナの標準出力(Spring Bootのログ)の送り先。溜まり続けないよう7日で自動削除する
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-backend"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-backend-logs"
  }
}

# タスク定義: 「どのイメージを、どれだけのCPU/メモリで、どんな設定で動かすか」の設計書
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${aws_ecr_repository.backend.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    # Spring Bootは環境変数がapplication.ymlの値より優先されるため、コード変更なしで本番用の値を渡せる
    environment = [
      { name = "SPRING_PROFILES_ACTIVE", value = "prod" },
      { name = "SPRING_DATASOURCE_URL", value = "jdbc:postgresql://${aws_db_instance.main.endpoint}/${var.db_name}" },
      { name = "SPRING_DATASOURCE_USERNAME", value = var.db_username },
      { name = "APP_STORAGE_TYPE", value = "s3" },
      { name = "APP_STORAGE_S3_BUCKET", value = var.image_bucket_name },
      { name = "APP_STORAGE_S3_REGION", value = var.aws_region },
      { name = "CORS_ALLOWED_ORIGINS", value = var.cors_allowed_origins },
    ]

    # パスワードは値そのものを書かず、Secrets Managerのシークレット(JSON)の"password"キーだけを
    # 起動時に取り出して環境変数に入れる(「ARN:キー名::」という書き方)
    secrets = [
      {
        name      = "SPRING_DATASOURCE_PASSWORD"
        valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::"
      },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.backend.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "backend"
      }
    }
  }])

  tags = {
    Name = "${var.project_name}-backend"
  }
}
