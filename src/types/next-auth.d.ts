import type { DefaultSession } from "next-auth";
import type { ActiveRole } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: ActiveRole[];
    } & DefaultSession["user"];
  }

  interface User {
    roles?: ActiveRole[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roles?: ActiveRole[];
  }
}
