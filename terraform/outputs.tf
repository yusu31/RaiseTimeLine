output "vpc_id" {
  description = "作成したVPCのID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "パブリックサブネットのID一覧（ALB用）"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "プライベートサブネットのID一覧（RDS用）"
  value       = aws_subnet.private[*].id
}

output "rds_endpoint" {
  description = "RDSの接続エンドポイント(ホスト名:ポート)"
  value       = aws_db_instance.main.endpoint
}

output "rds_master_user_secret_arn" {
  description = "Secrets Managerに自動生成されたマスターパスワードのARN"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "ecr_repository_url" {
  description = "backendのDockerイメージをpushするECRリポジトリURL"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  description = "ECSクラスター名(aws ecs run-task で指定する)"
  value       = aws_ecs_cluster.main.name
}

output "ecs_task_definition_arn" {
  description = "backendのタスク定義ARN(aws ecs run-task で指定する)"
  value       = aws_ecs_task_definition.backend.arn
}

output "ecs_security_group_id" {
  description = "ECSタスクに付けるセキュリティグループID(aws ecs run-task で指定する)"
  value       = aws_security_group.ecs.id
}
