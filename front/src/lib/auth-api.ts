import { authClient } from "./auth-client";
import type { AuthApi } from "../types/admin";

export const authApi = authClient as unknown as AuthApi;
