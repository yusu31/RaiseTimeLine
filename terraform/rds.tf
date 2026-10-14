# RDS(PostgreSQL)はプライベートサブネット2つ(1a/1c)にまたがって配置する
# (RDSのDBサブネットグループは最低2AZを要求する仕様のため)
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = var.db_engine_version

  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  storage_type      = "gp2"

  db_name  = var.db_name
  username = var.db_username
  # パスワードは生の値を書かず、AWS Secrets Managerに自動生成・自動保管させる
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  multi_az               = false
  publicly_accessible    = false

  # 学習用途のため、destroy時にスナップショットを作らず即削除できるようにする
  skip_final_snapshot = true

  tags = {
    Name = "${var.project_name}-db"
  }
}
