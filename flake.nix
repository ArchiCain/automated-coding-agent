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

        nodeVersion = pkgs.nodejs_22;
        pythonVersion = pkgs.python311;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.docker
            pkgs.docker-client
            pkgs.direnv
            pkgs.go-task
            pkgs.git

            pkgs.tmux

            nodeVersion

            pythonVersion
            pythonVersion.pkgs.pip
            pythonVersion.pkgs.virtualenv
          ];

          shellHook = ''
            echo ""
            echo "Dev Shell Ready:"
            echo "  Node.js $(node --version)"
            echo "  npm $(npm --version)"
            echo "  Python $(python3 --version)"
            echo "  Task $(task --version)"
            echo ""

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
