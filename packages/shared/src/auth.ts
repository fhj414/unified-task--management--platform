export interface DepartmentSummary {
  id: string;
  name: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  department: DepartmentSummary | null;
}

export interface MockLoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
