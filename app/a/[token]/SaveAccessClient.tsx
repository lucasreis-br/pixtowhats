"use client";

import { useEffect } from "react";
import { saveAccess } from "@/app/lib/accessStore";

export default function SaveAccessClient({ token }: { token: string }) {
  useEffect(() => {
    try {
      if (token) saveAccess(token);
    } catch {}
  }, [token]);

  return null;
}
