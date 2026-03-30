output "k3s_ip" {
  description = "Elastic IP address of the K3s server"
  value       = aws_eip.k3s.public_ip
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.k3s.id
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh ubuntu@${aws_eip.k3s.public_ip}"
}

output "kubeconfig_command" {
  description = "Command to fetch kubeconfig from the server"
  value       = "scp ubuntu@${aws_eip.k3s.public_ip}:/etc/rancher/k3s/k3s.yaml ~/.kube/k3s-config && sed -i '' 's/127.0.0.1/${aws_eip.k3s.public_ip}/g' ~/.kube/k3s-config"
}

output "dns_instructions" {
  description = "DNS configuration instructions"
  value       = var.domain != "" ? "Add a wildcard DNS record: *.${var.domain} -> A -> ${aws_eip.k3s.public_ip}" : "Set the 'domain' variable to get DNS instructions"
}
