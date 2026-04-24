variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., prod, staging)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = null
}

variable "instance_type" {
  description = "EC2 instance type (t3.medium=4GB, t3.large=8GB)"
  type        = string
  default     = "t3.large"
}

variable "key_name" {
  description = "SSH key pair name for EC2 access (break-glass only; regular access is Tailscale SSH)"
  type        = string
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 30
}

variable "data_volume_size" {
  description = "Data EBS volume size in GB (mounted at /mnt/data, backs /var/lib/docker)"
  type        = number
  default     = 50
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed for SSH break-glass access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "tailscale_auth_key" {
  description = "Reusable Tailscale auth key. See https://login.tailscale.com/admin/settings/keys."
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Base domain served behind Caddy (e.g. scain-coding-agent.dev). Subdomains: app, api, auth, openclaw."
  type        = string
}

variable "repo_url" {
  description = "Repo to clone into /srv/aca during user-data."
  type        = string
  default     = "https://github.com/rtslabs/scain-coding-agent.git"
}

variable "repo_branch" {
  description = "Branch to check out in /srv/aca."
  type        = string
  default     = "dev"
}
