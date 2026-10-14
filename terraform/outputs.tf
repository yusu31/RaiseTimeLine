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
