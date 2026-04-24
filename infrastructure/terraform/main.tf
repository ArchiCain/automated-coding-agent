terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# -------------------------------------------------------------------
# EC2 host — docker + tailscale + caddy (compose stack target)
# -------------------------------------------------------------------

resource "aws_instance" "host" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.host.id]

  # Terraform renders user-data.sh via templatefile() — placeholders in the
  # script (TAILSCALE_AUTH_KEY, DOMAIN, REPO_URL, REPO_BRANCH) get
  # substituted before cloud-init boots the instance.
  user_data = templatefile("${path.module}/user-data.sh", {
    TAILSCALE_AUTH_KEY = var.tailscale_auth_key
    DOMAIN             = var.domain
    REPO_URL           = var.repo_url
    REPO_BRANCH        = var.repo_branch
  })

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-host"
  }

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

# Separate EBS volume for persistent data (survives instance replacement).
# User-data formats it and mounts at /mnt/data; docker data-root lives there.
resource "aws_ebs_volume" "data" {
  availability_zone = aws_instance.host.availability_zone
  size              = var.data_volume_size
  type              = "gp3"
  encrypted         = true

  tags = {
    Name = "${var.project_name}-${var.environment}-data"
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.host.id
}

# -------------------------------------------------------------------
# Elastic IP (stable address for DNS A records)
# -------------------------------------------------------------------

resource "aws_eip" "host" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-host"
  }
}

resource "aws_eip_association" "host" {
  instance_id   = aws_instance.host.id
  allocation_id = aws_eip.host.id
}

# -------------------------------------------------------------------
# Security Group — SSH (break-glass), HTTP, HTTPS. Regular access is
# over Tailscale, not public :22.
# -------------------------------------------------------------------

resource "aws_security_group" "host" {
  name        = "${var.project_name}-${var.environment}-host"
  description = "Security group for the compose host (docker + caddy)"

  # SSH — break-glass only; normal access is over Tailscale SSH.
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_cidr_blocks
    description = "SSH access (break-glass; prefer Tailscale SSH)"
  }

  # HTTP — Caddy serves ACME HTTP-01 challenges + redirects to HTTPS.
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP (Caddy / ACME)"
  }

  # HTTPS — Caddy terminates TLS here.
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS (Caddy)"
  }

  # All outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-host"
  }
}

# -------------------------------------------------------------------
# Data Sources
# -------------------------------------------------------------------

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
