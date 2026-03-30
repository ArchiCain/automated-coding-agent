{
  description = "OpenClaw Gateway - minimal toolchain for Docker image";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_20
            pkgs.nodejs_20.pkgs.npm
            pkgs.git
            pkgs.go-task
            pkgs.gh
            pkgs.kubectl
            pkgs.kubernetes-helm
            pkgs.helmfile
            pkgs.openssh
          ];

          shellHook = ''
            # Include /usr/local/bin for globally installed tools (OpenClaw, Claude Code CLI)
            export PATH="/usr/local/bin:$PATH"

            # Install helm-diff plugin (required by helmfile)
            helm plugin install https://github.com/databus23/helm-diff 2>/dev/null || true
          '';
        };
      });
}
