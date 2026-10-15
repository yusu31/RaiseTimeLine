# ECS Fargateタスク用セキュリティグループ
# Issue7ではタスクを単発起動してログを見るだけなので、受け付ける通信(ingress)は作らない。
# Issue8でALB用SGを作る際に「ALBのSGから8080番だけ許可」するingressを足す。
# 送信(egress)は、ECRからのイメージ取得・Secrets Manager・S3・RDSへの接続に必要なので全許可する
resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-ecs-sg"
  description = "ECS Fargate backend tasks"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-sg"
  }
}

# RDS用セキュリティグループ: ECSタスク用SGからの5432番のみ許可する
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow PostgreSQL access to RDS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}
