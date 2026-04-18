/** Standard error response shape from the backend API. */
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
