"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiFetchAuth,
  AuthError,
  clearTokens,
  getAccessToken,
  getSelectedOrgId,
  getSelectedProjectId,
  setSelectedOrgId,
  setSelectedProjectId,
} from "./api";

export type Project = {
  id: string;
  name: string;
  slug: string;
  environment: string;
  organizationId: string;
};

export type Membership = {
  role: string;
  organization: { id: string; name: string; slug: string };
};

export function useAuth() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = getAccessToken();
    setToken(t);
    setOrgId(getSelectedOrgId());
    setProjectId(getSelectedProjectId());
    setReady(true);
    if (!t) router.replace("/");
  }, [router]);

  const logout = useCallback(() => {
    clearTokens();
    setToken(null);
    setOrgId(null);
    setProjectId(null);
    router.replace("/");
  }, [router]);

  const selectProject = useCallback((id: string, organizationId?: string) => {
    setSelectedProjectId(id);
    setProjectId(id);
    if (organizationId) {
      setSelectedOrgId(organizationId);
      setOrgId(organizationId);
    }
  }, []);

  return { token, orgId, projectId, ready, logout, selectProject, setOrgId, setProjectId };
}

export async function bootstrapSession(_token?: string) {
  // Uses apiFetchAuth so expired access tokens can refresh automatically
  try {
    const orgs = await apiFetchAuth<{ data: Membership[] }>("/organizations");
    const first = orgs.data[0];
    if (!first) {
      return {
        orgId: null as string | null,
        projectId: null as string | null,
        projects: [] as Project[],
      };
    }

    const orgId = first.organization.id;
    setSelectedOrgId(orgId);

    const projects = await apiFetchAuth<{ data: Project[] }>(
      `/projects?organizationId=${encodeURIComponent(orgId)}`
    );
    const projectId = projects.data[0]?.id ?? null;
    if (projectId) setSelectedProjectId(projectId);

    return { orgId, projectId, projects: projects.data };
  } catch (err) {
    if (err instanceof AuthError) {
      clearTokens();
      throw err;
    }
    throw err;
  }
}
