import type { NavigationItem } from './types';

/**
 * Find a navigation item by its path
 *
 * @param items - Navigation items to search
 * @param path - Current route path
 * @returns The matching navigation item, or null if not found
 */
export function findNavItemByPath(
  items: NavigationItem[],
  path: string
): NavigationItem | null {
  for (const item of items) {
    // Check if this item matches
    if (item.path === path) {
      return item;
    }

    // Recursively search children
    if (item.children) {
      const found = findNavItemByPath(item.children, path);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Find the active navigation item based on the current path
 *
 * Uses exact matching for root path ('/'), and prefix matching for others.
 * Returns the deepest matching item in the tree.
 *
 * @param items - Navigation items to search
 * @param currentPath - Current route pathname
 * @returns The active navigation item, or null if no match
 */
export function findActiveNavItem(
  items: NavigationItem[],
  currentPath: string
): NavigationItem | null {
  let bestMatch: NavigationItem | null = null;
  let bestMatchLength = 0;

  function search(items: NavigationItem[]) {
    for (const item of items) {
      if (item.path) {
        const isMatch =
          item.path === '/'
            ? currentPath === '/' // Exact match for root
            : currentPath.startsWith(item.path); // Prefix match for others

        if (isMatch && item.path.length > bestMatchLength) {
          bestMatch = item;
          bestMatchLength = item.path.length;
        }
      }

      if (item.children) {
        search(item.children);
      }
    }
  }

  search(items);
  return bestMatch;
}

/**
 * Check if a navigation item or any of its ancestors is active
 *
 * @param item - Navigation item to check
 * @param activeItem - Currently active navigation item
 * @param items - Full navigation tree (for finding ancestors)
 * @returns True if the item or any ancestor is active
 */
export function isItemOrAncestorActive(
  item: NavigationItem,
  activeItem: NavigationItem | null,
  _items: NavigationItem[]
): boolean {
  if (!activeItem) {
    return false;
  }

  // Direct match
  if (item.id === activeItem.id) {
    return true;
  }

  // Check if activeItem is a descendant of item
  function isDescendant(parent: NavigationItem, target: NavigationItem): boolean {
    if (!parent.children) {
      return false;
    }

    for (const child of parent.children) {
      if (child.id === target.id) {
        return true;
      }
      if (child.children && isDescendant(child, target)) {
        return true;
      }
    }

    return false;
  }

  return isDescendant(item, activeItem);
}

/**
 * Flatten the navigation tree into a single array
 *
 * Useful for breadcrumb generation or searching all items.
 *
 * @param items - Navigation items to flatten
 * @returns Flattened array of all navigation items
 */
export function flattenNavigation(items: NavigationItem[]): NavigationItem[] {
  const flattened: NavigationItem[] = [];

  function flatten(items: NavigationItem[]) {
    for (const item of items) {
      flattened.push(item);
      if (item.children) {
        flatten(item.children);
      }
    }
  }

  flatten(items);
  return flattened;
}

/**
 * Get the depth/nesting level of a navigation item
 *
 * @param item - Navigation item to measure
 * @param items - Full navigation tree
 * @param currentDepth - Current depth (used for recursion)
 * @returns Depth level (0 for root items)
 */
export function getNavigationDepth(
  item: NavigationItem,
  items: NavigationItem[],
  currentDepth = 0
): number {
  for (const navItem of items) {
    if (navItem.id === item.id) {
      return currentDepth;
    }

    if (navItem.children) {
      const depth = getNavigationDepth(item, navItem.children, currentDepth + 1);
      if (depth !== -1) {
        return depth;
      }
    }
  }

  return -1;
}

/**
 * Get all navigable items (items with paths)
 *
 * @param items - Navigation items to filter
 * @returns Array of items that have paths
 */
export function getNavigableItems(items: NavigationItem[]): NavigationItem[] {
  const navigable: NavigationItem[] = [];

  function collect(items: NavigationItem[]) {
    for (const item of items) {
      if (item.path && !item.metadata?.disabled) {
        navigable.push(item);
      }
      if (item.children) {
        collect(item.children);
      }
    }
  }

  collect(items);
  return navigable;
}
