export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  containers: ContainerInfo[];
  nodeName: string;
  cpu?: string;
  memory?: string;
}

export interface ContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  state: string;
  restartCount: number;
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: Array<{ port: number; targetPort: number; protocol: string }>;
  externalIP?: string;
}

export interface NamespaceGroup {
  namespace: string;
  displayName: string;
  pods: PodInfo[];
  services: ServiceInfo[];
}
