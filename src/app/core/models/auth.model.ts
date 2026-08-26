export interface User {
  id?: string | number;
  full_name: string;
  email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginCredentials {
  full_name: string;
}
