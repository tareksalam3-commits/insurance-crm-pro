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
    if (!user?.companyId) { setClients([]); setLoading(false); return; }
    setLoading(true);

    const roleFilters: { agentId?: string; agentName?: string; group?: string; supervisorId?: string } = { ...filters };

    if (user.role === 'agent') {
      // الوكيل يشوف عملاؤه بس عن طريق uid
      roleFilters.agentId = user.uid;
    } else if (user.role === 'group_leader') {
      // رئيس المجموعة يشوف عملاء مجموعته فقط (عن طريق supervisorId = uid)
      roleFilters.supervisorId = user.uid;
    }

    const unsub = subscribeToClients(
      (data) => { setClients(data); setLoading(false); },
      user.companyId,
      roleFilters
    );
    return unsub;
  }, [user?.companyId, user?.role, user?.uid, filters?.agentId, filters?.group]);

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
  const effectiveCompanyId = companyId ?? user?.companyId ?? '';
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveCompanyId) { setAgents([]); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeToAgents((data) => { setAgents(data); setLoading(false); }, effectiveCompanyId);
    return unsub;
  }, [effectiveCompanyId]);

  async function create(data: Omit<Agent, 'id' | 'createdAt'>) {
    return addAgent({ ...data, companyId: effectiveCompanyId });
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
    const unsub = subscribeToUsers((data) => { setUsers(data); setLoading(false); }, effectiveCompanyId);
    return unsub;
  }, [effectiveCompanyId]);

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

export function useRegistrationRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const companyFilter = user?.role === 'super_admin' ? undefined : user?.companyId;
    const unsub = subscribeToRegistrationRequests((data) => { setRequests(data); setLoading(false); }, companyFilter);
    return unsub;
  }, [user?.role, user?.companyId]);

  return { requests, loading };
}
