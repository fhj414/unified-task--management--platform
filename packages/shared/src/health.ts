export type ComponentStatus = 'up' | 'down';

export interface ServiceStatuses {
  api: ComponentStatus;
  database: ComponentStatus;
  redis: ComponentStatus;
}

export interface HealthResponse {
  status: ComponentStatus;
  timestamp: string;
  services: ServiceStatuses;
}
