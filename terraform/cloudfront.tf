# フロント(Reactのビルド成果物)の置き場。インターネットからは直接読めず、CloudFront経由でだけ読める
data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "frontend" {
  # S3のバケット名は世界中で一意にする必要があるため、アカウントIDを含める
  bucket = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"

  # apply→確認→destroy の運用のため、中身が残っていても destroy で消せるようにする
  force_destroy = true

  tags = {
    Name = "${var.project_name}-frontend"
  }
}

# 公開設定をすべて塞ぐ(誤ってバケットを公開してしまう事故を防ぐ)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# OAC(Origin Access Control): 「このCloudFrontだけがS3を読める」ための身分証。
# CloudFrontがS3へのリクエストにAWSの署名(sigv4)を付けるので、バケットを公開せずに済む
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# このディストリビューション(CloudFront)からの読み取りだけを許可する
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.main.arn }
      }
    }]
  })
}

# AWSが用意したキャッシュ・転送の設定(名前で引く。IDを直書きしない)
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Hostヘッダー以外(Authorization・Origin・クエリ・Cookie)をそのままALBへ転送する
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# 画面のURL(/posts/1 など)を /index.html に書き換える関数。画面側のビヘイビアにだけ付ける
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "${var.project_name}-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/functions/spa-rewrite.js")
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  comment             = "${var.project_name} frontend and API"
  default_root_object = "index.html"
  # 日本を含むアジア・北米・欧州の拠点だけ使う(全拠点より安い)
  price_class = "PriceClass_200"

  # 行き先①: フロント用S3(OAC経由)
  origin {
    origin_id                = "frontend-s3"
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # 行き先②: ALB。ドメインが無くHTTPS証明書を用意できないため、CloudFront→ALB間はHTTP
  origin {
    origin_id   = "backend-alb"
    domain_name = aws_lb.main.dns_name

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ビヘイビア(既定): 画面。S3から取り、キャッシュする
  default_cache_behavior {
    target_origin_id       = "frontend-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  # ビヘイビア: /api/* はALBへ。キャッシュせず、POST等の全メソッドを通す。
  # 画面側と違い書き換え関数は付けない(APIの404・403がHTMLに化けないようにするため)
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "backend-alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # 独自ドメインが無いので、CloudFrontの標準ドメイン(xxxx.cloudfront.net)と標準の証明書を使う
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-cdn"
  }
}
