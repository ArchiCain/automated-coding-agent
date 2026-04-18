/** A single navigation entry. May contain `children` for nested groups. */
export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  children?: NavigationItem[];
  permission?: string;
  badge?: string;
}

/** Top-level navigation configuration containing all nav items. */
export interface NavigationConfig {
  items: NavigationItem[];
}
