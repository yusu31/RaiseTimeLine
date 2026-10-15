terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # JWT署名鍵のランダム文字列を生成するために使う
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# 認証情報は環境変数 AWS_PROFILE=terraform で指定する想定（コードにプロファイル名を埋め込まない）
provider "aws" {
  region = var.aws_region
}
