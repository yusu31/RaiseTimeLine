variable "aws_region" {
  description = "リソースを作成するAWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "リソース名のプレフィックスに使うプロジェクト名"
  type        = string
  default     = "raisetimeline"
}

variable "vpc_cidr" {
  description = "VPC全体のCIDRブロック"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "使用するアベイラビリティゾーン（2つ。ALBとRDSサブネットグループの両方が2AZを要求する）"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
}

variable "public_subnet_cidrs" {
  description = "パブリックサブネットのCIDRブロック（ALB・ECS Fargate用、availability_zonesと同じ順番）"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "プライベートサブネットのCIDRブロック（RDS専用、availability_zonesと同じ順番）"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "db_name" {
  description = "RDSに作成するデータベース名（ローカルのdocker-compose.ymlと一致させる）"
  type        = string
  default     = "raisetimeline"
}

variable "db_username" {
  description = "RDSのマスターユーザー名（ローカルのdocker-compose.ymlと一致させる）"
  type        = string
  default     = "raisetime"
}

variable "db_instance_class" {
  description = "RDSインスタンスタイプ（無料利用枠対象。Single-AZ構成のみ無料枠適用）"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDSのストレージサイズ(GB)。無料利用枠は20GBまで"
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "PostgreSQLのエンジンバージョン"
  type        = string
  default     = "17.11"
}
