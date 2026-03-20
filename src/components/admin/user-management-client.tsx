"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { createAdminUserAction, deleteAdminUserAction, updateAdminUserAction } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SYSTEM_ROLES, type SystemRole } from "@/types";

import type { AdminUserItem } from "@/services/admin.service";

interface AdminLabels {
  title: string;
  name: string;
  email: string;
  role: string;
  department: string;
  active: string;
  actions: string;
  addUser: string;
  resetForm: string;
  password: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  confirmDelete: string;
  editTitle: string;
  saveSuccess: string;
  noDepartment: string;
  resetPassword: string;
  resetPasswordHint: string;
  resetPasswordMinError: string;
  showPassword: string;
  hidePassword: string;
  saveSuccessTitle: string;
  saveSuccessDescription: string;
  close: string;
  deleteTitle: string;
  deleteDescription: string;
  deleteConfirm: string;
}

interface UserManagementClientProps {
  initialUsers: AdminUserItem[];
  labels: AdminLabels;
}

interface CreateFormState {
  full_name: string;
  email: string;
  role: SystemRole;
  department: string;
  password: string;
  active: boolean;
}

interface EditFormState {
  id: string;
  full_name: string;
  email: string;
  role: SystemRole;
  department: string;
  password: string;
  active: boolean;
}

const EMPTY_CREATE_FORM: CreateFormState = {
  full_name: "",
  email: "",
  role: "STAFF",
  department: "",
  password: "",
  active: true,
};

const NO_DEPARTMENT_VALUE = "__none__";
const DEFAULT_DEPARTMENTS = ["Executive", "Technology", "Sales", "Finance", "Operations"] as const;

function getRoleBadge(role: SystemRole) {
  if (role === "CEO") {
    return "warning" as const;
  }

  if (role === "IT") {
    return "default" as const;
  }

  return "secondary" as const;
}

function fromDepartmentSelectValue(value: string) {
  return value === NO_DEPARTMENT_VALUE ? "" : value;
}

export function UserManagementClient({ initialUsers, labels }: UserManagementClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editing, setEditing] = useState<EditFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserItem | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [pending, startTransition] = useTransition();

  const sortedUsers = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name)), [users]);

  const departmentOptions = useMemo(() => {
    const fromUsers = users
      .map((user) => user.department.trim())
      .filter((department) => department.length > 0 && department !== "-");

    return Array.from(new Set([...DEFAULT_DEPARTMENTS, ...fromUsers])).sort((a, b) => a.localeCompare(b));
  }, [users]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (showSaveDialog) {
        setShowSaveDialog(false);
        return;
      }

      if (deleteTarget) {
        setDeleteTarget(null);
        return;
      }

      if (editing) {
        setEditing(null);
        return;
      }

      if (showCreateForm) {
        setShowCreateForm(false);
        setCreateForm(EMPTY_CREATE_FORM);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteTarget, editing, showCreateForm, showSaveDialog]);

  function beginEdit(user: AdminUserItem) {
    setShowResetPassword(false);
    setEditing({
      id: user.id,
      full_name: user.name,
      email: user.email,
      role: user.role,
      department: user.department === "-" ? "" : user.department,
      password: "",
      active: user.active,
    });
  }

  function resetCreateForm() {
    setCreateForm(EMPTY_CREATE_FORM);
  }

  function hideCreateForm() {
    resetCreateForm();
    setShowCreateForm(false);
  }

  function openCreateForm() {
    setShowCreateForm(true);
  }

  function onCreate() {
    if (!createForm.full_name.trim() || !createForm.email.trim() || createForm.password.trim().length < 8) {
      toast.error("Please fill name, email and password (min 8 chars)");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createAdminUserAction({
          ...createForm,
          full_name: createForm.full_name.trim(),
          email: createForm.email.trim().toLowerCase(),
          department: createForm.department.trim(),
          password: createForm.password.trim(),
        });

        if (!result.ok || !result.user) {
          toast.error(result.message ?? "Unable to create user");
          return;
        }

        setUsers((current) => [result.user, ...current]);
        setCreateForm(EMPTY_CREATE_FORM);
        setShowCreateForm(false);
        toast.success("User created");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to create user");
      }
    });
  }

  function onSaveEdit() {
    if (!editing) {
      return;
    }

    const trimmedPassword = editing.password.trim();

    if (!editing.full_name.trim() || !editing.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    if (trimmedPassword.length > 0 && trimmedPassword.length < 8) {
      toast.error(labels.resetPasswordMinError);
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateAdminUserAction({
          ...editing,
          full_name: editing.full_name.trim(),
          email: editing.email.trim().toLowerCase(),
          department: editing.department.trim(),
          password: trimmedPassword.length > 0 ? trimmedPassword : undefined,
        });

        if (!result.ok || !result.user) {
          toast.error(result.message ?? "Unable to update user");
          return;
        }

        setUsers((current) => current.map((item) => (item.id === result.user.id ? result.user : item)));
        setEditing(null);
        setShowSaveDialog(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update user");
      }
    });
  }

  function requestDelete(user: AdminUserItem) {
    setDeleteTarget(user);
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    const target = deleteTarget;

    startTransition(async () => {
      try {
        const result = await deleteAdminUserAction({ id: target.id });

        if (!result.ok) {
          toast.error(result.message ?? "Unable to delete user");
          return;
        }

        setUsers((current) => current.filter((item) => item.id !== target.id));
        if (editing?.id === target.id) {
          setEditing(null);
        }
        setDeleteTarget(null);
        toast.success("User deleted");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to delete user");
      }
    });
  }

  return (
    <div className="space-y-4">
      {!showCreateForm ? (
        <div className="flex justify-start">
          <Button onClick={openCreateForm} disabled={pending} data-audit-action="admin-open-create-user" data-audit-type="users">
            {labels.addUser}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-6">
          <Input
            placeholder={labels.name}
            value={createForm.full_name}
            onChange={(event) => setCreateForm((current) => ({ ...current, full_name: event.target.value }))}
          />
          <Input
            type="email"
            placeholder={labels.email}
            value={createForm.email}
            onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
          />
          <Select
            value={createForm.role}
            onValueChange={(value) => setCreateForm((current) => ({ ...current, role: value as SystemRole }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={labels.role} />
            </SelectTrigger>
            <SelectContent>
              {SYSTEM_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={createForm.department || NO_DEPARTMENT_VALUE}
            onValueChange={(value) => setCreateForm((current) => ({ ...current, department: fromDepartmentSelectValue(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={labels.department} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DEPARTMENT_VALUE}>{labels.noDepartment}</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="password"
            placeholder={labels.password}
            value={createForm.password}
            onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
          />
          <div className="flex items-center justify-between gap-2 rounded-md border px-3">
            <span className="text-sm">{labels.active}</span>
            <Switch
              checked={createForm.active}
              onCheckedChange={(checked) => setCreateForm((current) => ({ ...current, active: checked }))}
            />
          </div>
          <div className="md:col-span-6 flex flex-wrap gap-2">
            <Button onClick={onCreate} disabled={pending} data-audit-action="admin-create-user" data-audit-type="users">
              {labels.addUser}
            </Button>
            <Button variant="outline" onClick={resetCreateForm} disabled={pending}>
              {labels.resetForm}
            </Button>
            <Button variant="ghost" onClick={hideCreateForm} disabled={pending}>
              {labels.cancel}
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{labels.name}</TableHead>
            <TableHead>{labels.email}</TableHead>
            <TableHead>{labels.role}</TableHead>
            <TableHead>{labels.department}</TableHead>
            <TableHead>{labels.active}</TableHead>
            <TableHead>{labels.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant={getRoleBadge(user.role)}>{user.role}</Badge>
              </TableCell>
              <TableCell>{user.department}</TableCell>
              <TableCell>
                {user.active ? <Badge variant="success">Active</Badge> : <Badge variant="warning">Inactive</Badge>}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => beginEdit(user)} disabled={pending}>
                    {labels.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => requestDelete(user)}
                    disabled={pending}
                    data-audit-action="admin-delete-user"
                    data-audit-type="users"
                    data-audit-id={user.id}
                  >
                    {labels.delete}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setEditing(null);
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-slate-200 bg-background p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={labels.editTitle}
          >
            <h3 className="text-xl font-semibold tracking-tight">{labels.editTitle}</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                placeholder={labels.name}
                value={editing.full_name}
                onChange={(event) =>
                  setEditing((current) => (current ? { ...current, full_name: event.target.value } : current))
                }
              />
              <Input
                type="email"
                placeholder={labels.email}
                value={editing.email}
                onChange={(event) => setEditing((current) => (current ? { ...current, email: event.target.value } : current))}
              />
              <Select
                value={editing.role}
                onValueChange={(value) => setEditing((current) => (current ? { ...current, role: value as SystemRole } : current))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={labels.role} />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={editing.department || NO_DEPARTMENT_VALUE}
                onValueChange={(value) =>
                  setEditing((current) => (current ? { ...current, department: fromDepartmentSelectValue(value) } : current))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={labels.department} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT_VALUE}>{labels.noDepartment}</SelectItem>
                  {departmentOptions.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="md:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <KeyRound className="h-4 w-4" />
                  {labels.resetPassword}
                </div>
                <div className="relative mt-2">
                  <Input
                    type={showResetPassword ? "text" : "password"}
                    className="pr-12"
                    placeholder={labels.resetPassword}
                    value={editing.password}
                    onChange={(event) => setEditing((current) => (current ? { ...current, password: event.target.value } : current))}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showResetPassword ? labels.hidePassword : labels.showPassword}
                    title={showResetPassword ? labels.hidePassword : labels.showPassword}
                    onClick={() => setShowResetPassword((current) => !current)}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">{labels.resetPasswordHint}</p>
              </div>

              <div className="md:col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">{labels.active}</span>
                <Switch
                  checked={editing.active}
                  onCheckedChange={(checked) => setEditing((current) => (current ? { ...current, active: checked } : current))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
                {labels.cancel}
              </Button>
              <Button
                onClick={onSaveEdit}
                disabled={pending}
                data-audit-action="admin-update-user"
                data-audit-type="users"
                data-audit-id={editing.id}
              >
                {labels.save}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showSaveDialog ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSaveDialog(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={labels.saveSuccessTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{labels.saveSuccessTitle}</h4>
                <p className="mt-1 text-sm text-slate-600">{labels.saveSuccessDescription}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowSaveDialog(false)}>{labels.close}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={labels.deleteTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-100 p-2 text-rose-600">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{labels.deleteTitle}</h4>
                <p className="mt-1 text-sm text-slate-600">
                  {labels.deleteDescription} <span className="font-semibold text-slate-800">{deleteTarget.name}</span>
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>
                {labels.cancel}
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
                <Trash2 className="mr-2 h-4 w-4" />
                {labels.deleteConfirm}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
