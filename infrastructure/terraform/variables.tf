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
  description = "SSH key pair name for EC2 access"
  type        = string
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 30
}

variable "data_volume_size" {
  description = "Data EBS volume size in GB (K3s persistent volumes)"
  type        = number
  default     = 50
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed for SSH and K3s API access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "domain" {
  description = "Domain name for the application (e.g., rtsdev.co)"
  type        = string
  default     = ""
}
