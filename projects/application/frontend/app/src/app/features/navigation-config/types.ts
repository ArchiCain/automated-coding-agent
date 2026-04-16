export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  children?: NavigationItem[];
  permission?: string;
  badge?: string;
}

export interface NavigationConfig {
  items: NavigationItem[];
}
