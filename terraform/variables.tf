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
