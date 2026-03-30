import axios from "axios";
import api from "@/features/api-client";
import {
  User,
  UserListQuery,
  UserListResponse,
  CreateUserRequest,
  UpdateUserRequest,
} from "../types";

export const userManagementApi = {
  async getUsers(query?: UserListQuery): Promise<UserListResponse> {
    try {
      const response = await api.get("/users", { params: query });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || "Failed to fetch users");
      }
      throw error;
    }
  },

  async getUserById(id: string): Promise<User> {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || "Failed to fetch user");
      }
      throw error;
    }
  },

  async createUser(data: CreateUserRequest): Promise<User> {
    try {
      const response = await api.post("/users", data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || "Failed to create user");
      }
      throw error;
    }
  },

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    try {
      const response = await api.put(`/users/${id}`, data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || "Failed to update user");
      }
      throw error;
    }
  },

  async deleteUser(id: string): Promise<void> {
    try {
      await api.delete(`/users/${id}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || "Failed to delete user");
      }
      throw error;
    }
  },

  async toggleUserEnabled(id: string, enabled: boolean): Promise<User> {
    try {
      const response = await api.patch(`/users/${id}/enabled`, { enabled });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.message || "Failed to toggle user status"
        );
      }
      throw error;
    }
  },
};
