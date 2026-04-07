import { useCallback, useMemo, useRef } from "react";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

interface UseApiReturn {
  get: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>;
  post: <T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ) => Promise<T>;
  del: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>;
}

export function useApi(): UseApiReturn {
  const clientRef = useRef<AxiosInstance>(
    axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
      headers: {
        "Content-Type": "application/json",
      },
    }),
  );

  const get = useCallback(
    async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
      const response = await clientRef.current.get<T>(url, config);
      return response.data;
    },
    [],
  );

  const post = useCallback(
    async <T>(
      url: string,
      data?: unknown,
      config?: AxiosRequestConfig,
    ): Promise<T> => {
      const response = await clientRef.current.post<T>(url, data, config);
      return response.data;
    },
    [],
  );

  const del = useCallback(
    async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
      const response = await clientRef.current.delete<T>(url, config);
      return response.data;
    },
    [],
  );

  return useMemo(() => ({ get, post, del }), [get, post, del]);
}
