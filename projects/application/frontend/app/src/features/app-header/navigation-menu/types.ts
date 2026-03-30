export interface NavigationTab {
  name: string;
  id: string;
  path: string;
}

export interface NavigationMenuProps {
  tabs: NavigationTab[];
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
}
