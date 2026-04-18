import { NavigationItem } from './types';

/** Recursively flattens nested navigation items into a single-level array. */
export function flattenNavigation(items: NavigationItem[]): NavigationItem[] {
  const result: NavigationItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children) {
      result.push(...flattenNavigation(item.children));
    }
  }
  return result;
}

/** Finds the navigation item whose `route` matches the given path, or `null`. */
export function findActiveNavItem(
  items: NavigationItem[],
  currentRoute: string,
): NavigationItem | null {
  const flat = flattenNavigation(items);
  return flat.find(item => item.route === currentRoute) ?? null;
}

/** Finds the parent navigation item that contains a child with the given `id`, or `null`. */
export function findParentNavItem(
  items: NavigationItem[],
  childId: string,
): NavigationItem | null {
  for (const item of items) {
    if (item.children?.some(child => child.id === childId)) {
      return item;
    }
    if (item.children) {
      const found = findParentNavItem(item.children, childId);
      if (found) return found;
    }
  }
  return null;
}
