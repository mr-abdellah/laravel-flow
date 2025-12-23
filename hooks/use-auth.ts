"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  api_key?: string;
  created_at: string;
}

export const useUser = () => {
  return useQuery<User>({
    queryKey: ["user"],
    queryFn: async () => {
      const { data } = await api.get("/user");
      return data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useLogin = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: any) => {
      // CSRF protection for Laravel Sanctum (if needed, but we use token based for API)
      // await api.get('/sanctum/csrf-cookie');
      const { data } = await api.post("/login", credentials);
      return data;
    },
    onSuccess: (data) => {
      Cookies.set("token", data.access_token);
      queryClient.invalidateQueries({ queryKey: ["user"] });
      router.push("/dashboard");
    },
  });
};

export const useRegister = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: any) => {
      const { data } = await api.post("/register", credentials);
      return data;
    },
    onSuccess: (data) => {
      Cookies.set("token", data.access_token);
      queryClient.invalidateQueries({ queryKey: ["user"] });
      router.push("/dashboard");
    },
  });
};

export const useLogout = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post("/logout");
    },
    onSuccess: () => {
      Cookies.remove("token");
      queryClient.setQueryData(["user"], null);
      router.push("/login");
    },
  });
};

export const useUpdateApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (apiKey: string) => {
      await api.put("/user/api-key", { api_key: apiKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};
