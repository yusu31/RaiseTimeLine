# ALB(Application Load Balancer): インターネットからの入口。受けたリクエストをECSタスクへ振り分ける
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# ターゲットグループ: 振り分け先(ECSタスク)の名簿。ヘルスチェックに通ったタスクにだけリクエストを送る。
# Fargate(awsvpc)ではタスクがそれぞれ自分のIPを持つため、target_type は "ip"
resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-backend-tg"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  # 切り離し時の待ち時間。既定の300秒だと destroy が遅いので短くする
  deregistration_delay = 30

  health_check {
    path                = "/actuator/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.project_name}-backend-tg"
  }
}

# リスナー: 「80番ポートで待ち受けて、ターゲットグループへ転送する」という窓口の設定。
# ドメインが無くHTTPS証明書を用意できないためHTTPのみ。HTTPSはIssue9のCloudFrontが担当する
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
