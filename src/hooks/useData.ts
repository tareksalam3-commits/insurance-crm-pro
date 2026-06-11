import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { subscribeToClients, addClient, updateClient, deleteClient } from '../services/clientService';
import { subscribeToAgents, addAgent, updateAgent, deleteAgent } from '../services/agentService';
import { subscribeToUsers, createUserWithSecondaryApp, updateUserProfile, deleteUserProfile } from '../services/authService';
import { subscribeToCompanies, addCompany, updateCompany, deleteCompany } from '../services/companyService';
import { subscribeToRegistrationRequests } from '../services/authService';
import type { Client, Agent, User, Company, RegistrationRequest, UserRole } from '../types';

// ─── useAgents ────────────────────────────────────────────────
// كل دور يشوف وكلائه بس

export function useAgents(companyId?: string) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(true); return; }
    const cid = companyId ?? user.companyId ?? '';
    if (!cid) { setAgents([]); setLoading(false); return; }
    setLoading(true);

    const unsub = subscribeToAgents((data) => {
      let result = data;
      // المراقب يشوف وكلائه فقط (supervisorId == uid)
      if (user.role === 'supervisor' || user.role === 'general_supervisor') {
        result = data.filter((a) => a.supervisorId === user.uid);
      }
      // رئيس المجموعة يشوف أعضاء مجموعته فقط
      else if (user.role === 'group_leader') {
        result = data.filter((a) => a.supervisorId === user.uid);
      }
      // sales_manager و super_admin يشوفوا الكل
      setAgents(result);
      setLoading(false);
    }, cid);
    return unsub;
  }, [companyId, user?.companyId, user?.uid, user?.role]);

  async function create(data: Omit<Agent, 'id' | 'createdAt'>) {
    const cid = companyId ?? user?.companyId ?? '';
    return addAgent({ ...data, companyId: cid });
  }
  async function update(id: string, data: Partial<Agent>) { return updateAgent(id, data); }
  async function remove(id: string) { return deleteAgent(id); }

  return { agents, loading, create, update, remove };
}

// ─── useClients ───────────────────────────────────────────────
// المراقب يشوف عملاء وكلائه فقط

export function useClients(filters?: { agentName?: string; agentId?: string; group?: string }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [myAgentIds, setMyAgentIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);

  // الخطوة 1: للمراقب — نجيب أولاً قائمة الوكلاء التابعين له
  useEffect(() => {
    if (!user) return;
    const needsAgentFilter = user.role === 'supervisor' || user.role === 'general_supervisor' || user.role === 'group_leader';
    if (!needsAgentFilter) { setMyAgentIds(null); return; }

    const unsub = subscribeToAgents((allAgents) => {
      const ids = new Set<string>(
        allAgents
          .filter((a) => a.supervisorId === user.uid)
          .map((a) => a.uid)
          .filter((id): id is string => !!id)
      );
      setMyAgentIds(ids);
    }, user.companyId);
    return unsub;
  }, [user?.uid, user?.role, user?.companyId]);

  // الخطوة 2: نجيب العملاء ونفلترهم
  useEffect(() => {
    if (!user) { setLoading(true); return; }
    if (!user.companyId) { setClients([]); setLoading(false); return; }

    const needsAgentFilter = user.role === 'supervisor' || user.role === 'general_supervisor' || user.role === 'group_leader';
    // انتظر تحميل الـ agentIds للمراقب
    if (needsAgentFilter && myAgentIds === null) { setLoading(true); return; }

    setLoading(true);
    const roleFilters: { agentId?: string; agentName?: string; group?: string } = { ...filters };
    if (user.role === 'agent') roleFilters.agentId = user.uid;

    const unsub = subscribeToClients((data) => {
      let result = data;

      if (needsAgentFilter && myAgentIds !== null) {
        if (myAgentIds.size > 0) {
          // فلتر بناءً على agentId الموجود في الـ agent document
          result = data.filter((c) => myAgentIds.has(c.agentId));
        } else {
          result = []; // المراقب مفيش عنده وكلاء تابعين
        }
      }

      setClients(result);
      setLoading(false);
    }, user.companyId, roleFilters);
    return unsub;
  }, [user?.uid, user?.companyId, user?.role, myAgentIds, filters?.agentId, filters?.group]);

  async function create(data: Omit<Client, 'id' | 'createdAt'>) {
    if (!user?.companyId) return;
    // agentId يجب أن يكون uid الـ Firebase Auth للوكيل (مش document id)
    const agentId = user.role === 'agent' ? user.uid : (data.agentId || '');
    return addClient({ ...data, agentId, companyId: user.companyId });
  }
  async function update(id: string, data: Partial<Client>) { return updateClient(id, data); }
  async function remove(id: string) { return deleteClient(id); }

  return { clients, loading, create, update, remove };
}

// ─── useUsers ─────────────────────────────────────────────────

export function useUsers(companyId?: string) {
  const { user } = useAuth();
  const effectiveCompanyId = user?.role === 'super_admin' ? companyId : user?.companyId;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    }, effectiveCompanyId);
    return unsub;
  }, [effectiveCompanyId]);

  async function create(data: { email: string; password: string; displayName: string; role: UserRole; companyId: string; managerId?: string }) {
    return createUserWithSecondaryApp(data.email, data.password, data.displayName, data.role, data.companyId, data.managerId);
  }
  async function update(uid: string, data: Partial<User>) { return updateUserProfile(uid, data); }
  async function remove(uid: string) { return deleteUserProfile(uid); }

  return { users, loading, create, update, remove };
}

// ─── useCompanies ─────────────────────────────────────────────

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToCompanies((data) => { setCompanies(data); setLoading(false); });
    return unsub;
  }, []);

  async function create(data: Omit<Company, 'id' | 'createdAt'>) { return addCompany(data); }
  async function update(id: string, data: Partial<Company>) { return updateCompany(id, data); }
  async function remove(id: string) { return deleteCompany(id); }

  return { companies, loading, create, update, remove };
}

// ─── useRegistrationRequests ──────────────────────────────────

export function useRegistrationRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRequests([]); setLoading(false); return; }
    setLoading(true);

    const companyFilter = user.role === 'super_admin' ? undefined : user.companyId;

    // المراقب العام يرى كل طلبات الشركة (هو المسؤول عن الموافقة والتعيين)
    // المراقب يرى الطلبات الموجهة إليه فقط
    const managerFilter = user.role === 'supervisor' ? user.uid : undefined;

    const unsub = subscribeToRegistrationRequests(
      (data) => {
        let filtered = data;
        if (managerFilter) filtered = data.filter((r) => r.managerId === managerFilter);
        setRequests(filtered);
        setLoading(false);
      },
      companyFilter,
      managerFilter,
    );
    return unsub;
  }, [user?.role, user?.companyId, user?.uid]);

  return { requests, loading };
}
