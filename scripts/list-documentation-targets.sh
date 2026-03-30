#!/bin/bash
# Lists all projects and packages that need README documentation
# Output format: JSON array of targets for parallel processing

REPO_ROOT="${1:-.}"
PROJECTS_DIR="$REPO_ROOT/projects"

# Output JSON array
echo "["

first=true

# List all projects
for project_dir in "$PROJECTS_DIR"/*/; do
  if [ -d "$project_dir" ]; then
    project_name=$(basename "$project_dir")

    # Skip hidden directories
    [[ "$project_name" == .* ]] && continue

    # Check if README exists
    has_readme="false"
    [ -f "$project_dir/README.md" ] && has_readme="true"

    # Output project target
    if [ "$first" = true ]; then
      first=false
    else
      echo ","
    fi

    echo "  {"
    echo "    \"type\": \"project\","
    echo "    \"name\": \"$project_name\","
    echo "    \"path\": \"projects/$project_name\","
    echo "    \"has_readme\": $has_readme"
    echo -n "  }"

    # Find packages directory (could be in different locations)
    packages_dir=""
    if [ -d "$project_dir/app/src/packages" ]; then
      packages_dir="$project_dir/app/src/packages"
    elif [ -d "$project_dir/src/packages" ]; then
      packages_dir="$project_dir/src/packages"
    fi

    # List packages if they exist
    if [ -n "$packages_dir" ] && [ -d "$packages_dir" ]; then
      for package_dir in "$packages_dir"/*/; do
        if [ -d "$package_dir" ]; then
          package_name=$(basename "$package_dir")

          # Skip hidden directories
          [[ "$package_name" == .* ]] && continue

          # Check if README exists
          pkg_has_readme="false"
          [ -f "$package_dir/README.md" ] && pkg_has_readme="true"

          # Relative path from repo root (clean up double slashes)
          rel_path="${package_dir#$REPO_ROOT/}"
          rel_path="${rel_path%/}"
          rel_path="${rel_path//\/\//\/}"

          echo ","
          echo "  {"
          echo "    \"type\": \"package\","
          echo "    \"name\": \"$package_name\","
          echo "    \"project\": \"$project_name\","
          echo "    \"path\": \"$rel_path\","
          echo "    \"has_readme\": $pkg_has_readme"
          echo -n "  }"
        fi
      done
    fi
  fi
done

echo ""
echo "]"
