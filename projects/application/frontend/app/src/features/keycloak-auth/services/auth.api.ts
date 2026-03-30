import { LoginCredentials, User } from "../types";
import axios from "axios";
import api from "@/features/api-client";

export const authApi = {
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const response = await api.post("/auth/login", credentials);
      return response.data.user;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || "Login failed");
      }
      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout failed", error);
      throw error;
    }
  },

  async checkAuth(): Promise<User | null> {
    try {
      const response = await api.get("/auth/check");
      return response.data.user;
    } catch (error) {
      return null;
    }
  },

  async refreshToken(): Promise<void> {
    try {
      await api.post("/auth/refresh");
    } catch (error) {
      console.error("Token refresh failed", error);
      throw error;
    }
  },
};
