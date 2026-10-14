# RDS用セキュリティグループ
# 本来はECS Fargate用SGからの5432番のみ許可したいが、ECS用SGはIssue7/8でまだ作成していない。
# 暫定としてVPC内CIDR全体からの5432番を許可し、ECS用SGができたらそちらに絞り込む。
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow PostgreSQL access to RDS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Temporary: allow 5432 from within VPC until ECS SG exists"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
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
