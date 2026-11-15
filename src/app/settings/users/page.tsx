"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { SCREENS, type Role, type Screen, type ScreenAccess, type User } from "@/lib/types";
import { fmtDate, isEmail, today, uid, userName } from "@/lib/utils";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, RowActions, Select, Table, Tabs, Textarea, Toggle } from "@/components/ui";

const TABS = ["Roles", "Users"] as const;

export default function UserManagementPage() {
  const { state, actions } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Roles");
  const [role, setRole] = useState<Role | "new" | null>(null);
  const [user, setUser] = useState<User | "new" | null>(null);
  const { roles, users } = state.settings;
  const saveRoles = (next: Role[]) => actions.updateSettings({ roles: next }, "Roles");
  const saveUsers = (next: User[]) => actions.updateSettings({ users: next }, "Users");

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle="Roles decide which screens and branches a user can work with; users appear as sales, operations and pricing persons."
        actions={
          tab === "Roles" ? (
            <Button onClick={() => setRole("new")}>
              <Plus size={16} aria-hidden /> Add Role
            </Button>
          ) : (
            <Button onClick={() => setUser("new")}>
              <Plus size={16} aria-hidden /> Add Users
            </Button>
          )
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "Roles" ? (
        <Card bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <th>Role Name</th>
                <th>Description</th>
                <th>Branches</th>
                <th>Screens</th>
                <th className="text-right">Users</th>
                <th className="w-px whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const screens = Object.entries(r.access).filter(([, a]) => a?.view);
                const inUse = users.filter((u) => u.roleIds.includes(r.id)).length;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="font-medium">{r.name}</td>
                    <td className="text-slate-600">{r.description}</td>
                    <td>{r.branches.length ? r.branches.join(", ") : "All branches"}</td>
                    <td className="max-w-md">
                      <div className="flex flex-wrap gap-1">
                        {screens.length === SCREENS.length ? (
                          <Badge>All screens</Badge>
                        ) : (
                          screens.map(([s, a]) => (
                            <Badge key={s} className={a?.edit ? "bg-brand-50 text-brand-700 ring-brand-200" : undefined}>
                              {s}
                              {!a?.edit && " (view)"}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{inUse}</td>
                    <td className="whitespace-nowrap">
                      <RowActions
                        label={`Actions for ${r.name}`}
                        items={[
                          { label: "Edit", onSelect: () => setRole(r) },
                          ...(inUse ? [] : [{ label: "Delete", onSelect: () => window.confirm(`Delete role ${r.name}?`) && saveRoles(roles.filter((x) => x.id !== r.id)) }]),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Card bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Branch</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Start / End</th>
                <th>Active</th>
                <th className="w-px whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="font-medium whitespace-nowrap">{userName(u)}</td>
                  <td>{u.department}</td>
                  <td>{u.branch}</td>
                  <td className="text-slate-600">{u.email}</td>
                  <td>{u.roleIds.map((id) => roles.find((r) => r.id === id)?.name).filter(Boolean).join(", ")}</td>
                  <td className="text-xs whitespace-nowrap text-slate-600">
                    {fmtDate(u.startDate)} – {u.endDate ? fmtDate(u.endDate) : "…"}
                  </td>
                  <td>
                    <Badge className={u.active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : undefined}>{u.active ? "Yes" : "No"}</Badge>
                  </td>
                  <td className="whitespace-nowrap">
                    <RowActions label={`Actions for ${userName(u)}`} items={[{ label: "Edit", onSelect: () => setUser(u) }]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {role && (
        <RoleModal
          existing={role === "new" ? undefined : role}
          onClose={() => setRole(null)}
          onSave={(r) => {
            saveRoles(role === "new" ? [...roles, r] : roles.map((x) => (x.id === r.id ? r : x)));
            setRole(null);
          }}
        />
      )}
      {user && (
        <UserModal
          existing={user === "new" ? undefined : user}
          onClose={() => setUser(null)}
          onSave={(u) => {
            saveUsers(user === "new" ? [...users, u] : users.map((x) => (x.id === u.id ? u : x)));
            setUser(null);
          }}
        />
      )}
    </>
  );
}

const ACCESS_KEYS: [keyof ScreenAccess, string][] = [
  ["view", "View only"],
  ["actions", "Actions"],
  ["edit", "Edit"],
];

function RoleModal({ existing, onClose, onSave }: { existing?: Role; onClose: () => void; onSave: (r: Role) => void }) {
  const { state } = useStore();
  const [r, setR] = useState<Role>(existing ?? { id: uid(), name: "", description: "", branches: [], access: {} });
  const taken = state.settings.roles.some((x) => x.id !== r.id && x.name.trim().toLowerCase() === r.name.trim().toLowerCase());
  // Actions and Edit include viewing; clearing View clears the others
  const setAccess = (screen: Screen, key: keyof ScreenAccess, on: boolean) => {
    const cur = r.access[screen] ?? { view: false, actions: false, edit: false };
    const next = key === "view" ? (on ? { ...cur, view: true } : { view: false, actions: false, edit: false }) : { ...cur, [key]: on, view: on || cur.view };
    setR({ ...r, access: { ...r.access, [screen]: next } });
  };
  const all = (key: keyof ScreenAccess) => SCREENS.every((s) => r.access[s]?.[key]);
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={existing ? `Edit role · ${existing.name}` : "Add Role"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!r.name.trim() || taken} onClick={() => onSave({ ...r, name: r.name.trim() })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Role Name *" hint={taken ? <span className="text-red-600">Another role has this name</span> : undefined}>
          <Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea rows={1} value={r.description} onChange={(e) => setR({ ...r, description: e.target.value })} />
        </Field>
      </div>
      <fieldset className="mt-3">
        <legend className="mb-1.5 text-xs font-medium text-slate-700">Branch access (none ticked = all branches)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {state.settings.branches.map((b) => (
            <label key={b.name} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={r.branches.includes(b.name)}
                onChange={(e) => setR({ ...r, branches: e.target.checked ? [...r.branches, b.name] : r.branches.filter((x) => x !== b.name) })}
              />
              {b.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3">
        <div className="mb-1.5 text-xs font-medium text-slate-700">Screens this role can access</div>
        {/* The column headings hold the "on every screen" checkboxes, so keep the header visible on phones */}
        <Table stack={false}>
          <thead>
            <tr>
              <th>Screen Name</th>
              {ACCESS_KEYS.map(([k, label]) => (
                <th key={k} className="text-center">
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" className="accent-brand-600" checked={all(k)} onChange={(e) => SCREENS.forEach((s) => setAccess(s, k, e.target.checked))} aria-label={`${label} on every screen`} />
                    {label}
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCREENS.map((s) => (
              <tr key={s}>
                <td>{s}</td>
                {ACCESS_KEYS.map(([k, label]) => (
                  <td key={k} className="text-center">
                    <input type="checkbox" className="size-4 accent-brand-600" checked={!!r.access[s]?.[k]} onChange={(e) => setAccess(s, k, e.target.checked)} aria-label={`${s}: ${label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Modal>
  );
}

function UserModal({ existing, onClose, onSave }: { existing?: User; onClose: () => void; onSave: (u: User) => void }) {
  const { state } = useStore();
  const [u, setU] = useState<User>(
    existing ?? { id: uid(), firstName: "", lastName: "", department: "", branch: state.settings.branches[0]?.name ?? "", email: "", phone: "", startDate: today(), endDate: "", active: true, roleIds: [] },
  );
  const str = (k: keyof User) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setU({ ...u, [k]: e.target.value });
  const emailTaken = state.settings.users.some((x) => x.id !== u.id && x.email.toLowerCase() === u.email.trim().toLowerCase());
  const valid = u.firstName.trim() && u.lastName.trim() && isEmail(u.email) && !emailTaken && u.roleIds.length > 0 && (!u.endDate || u.endDate >= u.startDate);
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={existing ? `Edit user · ${userName(existing)}` : "Add Users"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={() => onSave(u)} title={!u.roleIds.length ? "Select at least one role" : undefined}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="First Name *">
          <Input value={u.firstName} onChange={str("firstName")} />
        </Field>
        <Field label="Last Name *">
          <Input value={u.lastName} onChange={str("lastName")} />
        </Field>
        <Field label="Department">
          <Input value={u.department} onChange={str("department")} />
        </Field>
        <Field label="Branch">
          <Select value={u.branch} onChange={str("branch")}>
            {state.settings.branches.map((b) => (
              <option key={b.name}>{b.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Email *" hint={emailTaken ? <span className="text-red-600">Another user has this email</span> : undefined}>
          <Input type="email" value={u.email} onChange={str("email")} />
        </Field>
        <Field label="Contact Number">
          <Input value={u.phone} onChange={str("phone")} />
        </Field>
        <Field label="Start Date">
          <Input type="date" value={u.startDate} onChange={str("startDate")} />
        </Field>
        <Field label="End Date" hint={u.endDate && u.endDate < u.startDate ? <span className="text-red-600">Must be after the start date</span> : undefined}>
          <Input type="date" value={u.endDate} onChange={str("endDate")} />
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Active</span>
          <div className="flex h-9 items-center gap-2 text-sm sm:h-8">
            <Toggle checked={u.active} onChange={(active) => setU({ ...u, active })} label="Active" /> {u.active ? "Yes" : "No"}
          </div>
        </div>
      </div>
      <fieldset className="mt-3">
        <legend className="mb-1.5 text-xs font-medium text-slate-700">Available roles *</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {state.settings.roles.map((r) => (
            <label key={r.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 accent-brand-600"
                checked={u.roleIds.includes(r.id)}
                onChange={(e) => setU({ ...u, roleIds: e.target.checked ? [...u.roleIds, r.id] : u.roleIds.filter((x) => x !== r.id) })}
              />
              <span>
                <span className="font-medium">{r.name}</span>
                <span className="block text-xs text-slate-500">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}
