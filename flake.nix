{
  description = "Dev environment with latest stable toolchain";

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

        nodeVersion = pkgs.nodejs_20;
        pythonVersion = pkgs.python311;
        terraform = pkgs.terraform;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.docker
            pkgs.direnv
            pkgs.go-task
            pkgs.git

            terraform
            pkgs.awscli2
            pkgs.kubectl
            pkgs.kubernetes-helm
            pkgs.helmfile

            nodeVersion
            nodeVersion.pkgs.npm

            pythonVersion
            pythonVersion.pkgs.pip
            pythonVersion.pkgs.virtualenv
            pythonVersion.pkgs.fastapi
          ];

          shellHook = ''
            echo ""
            echo "Dev Shell Ready:"
            echo "  Node.js $(node --version)"
            echo "  npm $(npm --version)"
            echo "  Python $(python3 --version)"
            echo "  Terraform $(terraform --version | head -n1)"
            echo "  AWS CLI $(aws --version)"
            echo "  kubectl $(kubectl version --client -o json 2>/dev/null | grep gitVersion | head -1 | cut -d'"' -f4)"
            echo "  Helm $(helm version --short 2>/dev/null)"
            echo "  Helmfile $(helmfile --version 2>/dev/null)"
            echo "  Task $(task --version)"
            echo ""

            # Install helm-diff plugin (required by helmfile)
            helm plugin install https://github.com/databus23/helm-diff 2>/dev/null || true

            # Enable Task shell completion
            if [ -n "$BASH_VERSION" ]; then
              source <(task --completion bash)
            elif [ -n "$ZSH_VERSION" ]; then
              autoload -U compinit && compinit
              source <(task --completion zsh)
            fi
          '';
        };
      });
}
