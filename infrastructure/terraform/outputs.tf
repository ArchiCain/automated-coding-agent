output "eip" {
  description = "Elastic IP address of the compose host"
  value       = aws_eip.host.public_ip
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.host.id
}

output "ssh_command" {
  description = "SSH command to connect to the server (break-glass; prefer Tailscale SSH)"
  value       = "ssh ubuntu@${aws_eip.host.public_ip}"
}

output "tailscale_hostname" {
  description = "The --hostname user-data passed to `tailscale up`. Reachable over the Tailnet as scain-coding-agent or scain-coding-agent.{tailnet}.ts.net."
  value       = "scain-coding-agent"
}

output "caddy_status_command" {
  description = "Check Caddy is running and serving."
  value       = "ssh ubuntu@${aws_eip.host.public_ip} systemctl status caddy"
}

output "dns_instructions" {
  description = "DNS configuration instructions"
  value       = "Point these A records at ${aws_eip.host.public_ip}: app.${var.domain}, api.${var.domain}, auth.${var.domain}, openclaw.${var.domain}."
}
