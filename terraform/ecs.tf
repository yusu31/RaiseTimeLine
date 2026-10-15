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
      # CloudFront→ALBはHTTPで転送されるため、バックエンドから見るとブラウザのOrigin(https://…cloudfront.net)は
      # 別オリジン扱いになる。CloudFrontのドメインを許可しないとPOST等が403で弾かれる
      { name = "CORS_ALLOWED_ORIGINS", value = "https://${aws_cloudfront_distribution.main.domain_name}" },
    ]

    # パスワードは値そのものを書かず、Secrets Managerのシークレット(JSON)の"password"キーだけを
    # 起動時に取り出して環境変数に入れる(「ARN:キー名::」という書き方)
    secrets = [
      {
        name      = "SPRING_DATASOURCE_PASSWORD"
        valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::"
      },
      # JWT署名鍵は文字列1つだけのシークレットなので、ARNをそのまま指定する。
      # 渡し忘れ・取得失敗時は、アプリ側(application-prod.yml)が起動を止める
      {
        name      = "JWT_SECRET"
        valueFrom = aws_secretsmanager_secret.jwt_secret.arn
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

# ECSサービス: 「タスクを常に desired_count 個、動かし続ける」ための管理役。
# タスクが落ちたら自動で起動し直し、ALBのターゲットグループへ登録・解除も行う
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  # Spring Bootの起動に約81〜91秒かかる。この間にヘルスチェックに落ちて殺されないよう、倍近い猶予を持たせる
  health_check_grace_period_seconds = 180

  # NAT Gatewayを置かない構成のため、パブリックサブネット+パブリックIPでECR等へ直接出る
  # (外からの入口はECS用SGがALBからの8080番だけに絞っている)
  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8080
  }

  # リスナーができる前にサービスを作ると、ターゲットグループがALBに紐付いていないとして失敗する
  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "${var.project_name}-backend"
  }
}
