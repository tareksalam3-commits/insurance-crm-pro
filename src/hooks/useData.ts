import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { subscribeToClients, addClient, updateClient, deleteClient } from '../services/clientService';
import { subscribeToAgents, addAgent, updateAgent, deleteAgent } from '../services/agentService';
import { subscribeToUsers, createUserWithSecondaryApp, updateUserProfile, deleteUserProfile } from '../services/authService';
import { subscribeToCompanies, addCompany, updateCompany, deleteCompany } from '../services/companyService';
import { subscribeToRegistrationRequests } from '../services/authService';
import type { Client, Agent, User, Company, RegistrationRequest, UserRole } from '../types';

// ─── useClients ────────────────────────────────────────────────────────────────

export function useClients(filters?: { agentName?: string; agentId?: string; group?: string }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // انتظر حتى يتحمل الـ user من Firestore
    if (!user) { setLoading(true); return; }
    if (!user.companyId) { setClients([]); setLoading(false); return; }
    setLoading(true);

    const roleFilters: { agentId?: string; agentName?: string; group?: string; supervisorId?: string } = { ...filters };

    if (user.role === 'agent') {
      roleFilters.agentId = user.uid;
    } else if (user.role === 'group_leader') {
      roleFilters.supervisorId = user.uid;
    }
    // supervisor و general_supervisor و sales_manager يشوفوا كل عملاء الشركة بدون فلتر إضافي

    const unsub = subscribeToClients(
      (data) => { setClients(data); setLoading(false); },
      user.companyId,
      roleFilters
    );
    return unsub;
  }, [user?.uid, user?.companyId, user?.role, filters?.agentId, filters?.group]);

  async function create(data: Omit<Client, 'id' | 'createdAt'>) {
    if (!user?.companyId) return;
    const agentId = user.role === 'agent' ? user.uid : (data.agentId || '');
    return addClient({ ...data, agentId, companyId: user.companyId });
  }

  async function update(id: string, data: Partial<Client>) {
    return updateClient(id, data);
  }

  async function remove(id: string) {
    return deleteClient(id);
  }

  return { clients, loading, create, update, remove };
}

// ─── useAgents ────────────────────────────────────────────────────────────────

export function useAgents(companyId?: string) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const effectiveCompanyId = companyId ?? user?.companyId ?? '';
    // لو user لسه null معناه البيانات بتتحمل — نفضل في loading
    if (!user) { setLoading(true); return; }
    // لو user موجود بس مفيش companyId
    if (!effectiveCompanyId) { setAgents([]); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeToAgents((data) => { setAgents(data); setLoading(false); }, effectiveCompanyId);
    return unsub;
  }, [companyId, user?.companyId, user?.uid]);

  async function create(data: Omit<Agent, 'id' | 'createdAt'>) {
    const cid = companyId ?? user?.companyId ?? '';
    return addAgent({ ...data, companyId: cid });
  }

  async function update(id: string, data: Partial<Agent>) {
    return updateAgent(id, data);
  }

  async function remove(id: string) {
    return deleteAgent(id);
  }

  return { agents, loading, create, update, remove };
}

// ─── useUsers ─────────────────────────────────────────────────────────────────

export function useUsers(companyId?: string) {
  const { user } = useAuth();
  const effectiveCompanyId = user?.role === 'super_admin' ? companyId : user?.companyId;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToUsers(
      (data) => {
        let filtered = data;
        if (user?.role === 'supervisor') {
          filtered = data.filter((u) => u.managerId === user.uid);
        } else if (user?.role === 'general_supervisor') {
          filtered = data.filter((u) => u.managerId === user.uid);
        }
        setUsers(filtered);
        setLoading(false);
      },
      effectiveCompanyId,
    );
    return unsub;
  }, [effectiveCompanyId, user?.role, user?.uid]);

  async function create(data: { email: string; password: string; displayName: string; role: UserRole; companyId: string; managerId?: string }) {
    return createUserWithSecondaryApp(data.email, data.password, data.displayName, data.role, data.companyId, data.managerId);
  }

  async function update(uid: string, data: Partial<User>) {
    return updateUserProfile(uid, data);
  }

  async function remove(uid: string) {
    return deleteUserProfile(uid);
  }

  return { users, loading, create, update, remove };
}

// ─── useCompanies ─────────────────────────────────────────────────────────────

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToCompanies((data) => { setCompanies(data); setLoading(false); });
    return unsub;
  }, []);

  async function create(data: Omit<Company, 'id' | 'createdAt'>) {
    return addCompany(data);
  }

  async function update(id: string, data: Partial<Company>) {
    return updateCompany(id, data);
  }

  async function remove(id: string) {
    return deleteCompany(id);
  }

  return { companies, loading, create, update, remove };
}

// ─── useRegistrationRequests ──────────────────────────────────────────────────
// FIX: تبسيط الكيري لتجنب مشاكل Composite Index في Firestore

export function useRegistrationRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRequests([]); setLoading(false); return; }
    setLoading(true);

    // super_admin وsales_manager: كل الطلبات في الشركة/النظام
    // general_supervisor وsupervisor: فقط الطلبات الموجهة إليهم (managerId == uid)
    const companyFilter = user.role === 'super_admin' ? undefined : user.companyId;
    const managerFilter =
      (user.role === 'general_supervisor' || user.role === 'supervisor')
        ? user.uid
        : undefined;

    const unsub = subscribeToRegistrationRequests(
      (data) => {
        // فلترة إضافية على الكلاينت لضمان الدقة
        let filtered = data;
        if (managerFilter) {
          filtered = data.filter((r) => r.managerId === managerFilter);
        }
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
