import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccessCode,
  AccessCodeType,
  AdminUserStatus,
  AdminUserSummary,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Ban,
  Copy,
  KeyRound,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

type AssignableType = "weekly" | "monthly" | "master";
type StatusFilter = "all" | "active" | "suspended" | "inactive";

interface IssueResult {
  code: AccessCode;
  revoked: number;
  unsuspended: boolean;
}

const TYPE_LABEL: Record<AccessCodeType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  master: "Master",
};

const STATUS_LABEL: Record<AdminUserStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
  suspended: "Suspended",
  no_access: "No access",
};

const STATUS_CLASS: Record<AdminUserStatus, string> = {
  active: "border-green-200 bg-green-100 text-green-700",
  expired: "border-amber-200 bg-amber-100 text-amber-700",
  revoked: "border-neutral-200 bg-neutral-100 text-neutral-600",
  suspended: "border-red-200 bg-red-100 text-red-700",
  no_access: "border-neutral-200 bg-neutral-100 text-neutral-600",
};

const ASSIGNABLE_TYPES: { value: AssignableType; label: string }[] = [
  { value: "weekly", label: "Weekly (W) - 7 days" },
  { value: "monthly", label: "Monthly (M) - 30 days" },
  { value: "master", label: "Master (X) - never expires" },
];

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString() : "-";
}

function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "-";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function UserManagementSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetMobile, setTargetMobile] = useState("");
  const [targetType, setTargetType] = useState<AssignableType>("monthly");
  const [targetAdmin, setTargetAdmin] = useState(false);
  const [mobileLocked, setMobileLocked] = useState(false);
  const [issued, setIssued] = useState<IssueResult | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileMobile, setProfileMobile] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileSurname, setProfileSurname] = useState("");

  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery<AdminUserSummary[]>({
    queryKey: ["/api/admin/users"],
  });

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/access-codes"] });
  };

  const issueMutation = useMutation({
    mutationFn: async (payload: {
      mobile_number: string;
      type: AssignableType;
      hasAdminAccess: boolean;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/users/${payload.mobile_number}/access`,
        {
          type: payload.type,
          hasAdminAccess: payload.hasAdminAccess,
        }
      );
      return (await res.json()) as IssueResult;
    },
    onSuccess: (result) => {
      invalidateUsers();
      setIssued(result);
      toast({
        title: "New access code issued",
        description: `${result.code.code} - ${result.revoked} previous code(s) revoked.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not issue access",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (payload: { mobile_number: string; reason: string | null }) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/users/${payload.mobile_number}/suspend`,
        { reason: payload.reason }
      );
      return (await res.json()) as { revoked: number };
    },
    onSuccess: (result, payload) => {
      invalidateUsers();
      toast({
        title: `${payload.mobile_number} suspended`,
        description: `${result.revoked} code(s) revoked. Progress and test history kept.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not suspend user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (mobileNumber: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${mobileNumber}`);
      return (await res.json()) as {
        codes: number;
        progress: number;
        tests: number;
      };
    },
    onSuccess: (result, mobileNumber) => {
      invalidateUsers();
      toast({
        title: `${mobileNumber} deleted`,
        description: `${result.codes} code(s), ${result.progress} progress row(s) and ${result.tests} test(s) removed.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (payload: {
      mobile_number: string;
      name: string;
      surname: string;
    }) => {
      const res = await apiRequest(
        "PUT",
        `/api/admin/users/${payload.mobile_number}/profile`,
        {
          name: payload.name.trim() || null,
          surname: payload.surname.trim() || null,
        }
      );
      return (await res.json()) as { name: string | null; surname: string | null };
    },
    onSuccess: (_result, payload) => {
      invalidateUsers();
      setProfileDialogOpen(false);
      toast({ title: `${payload.mobile_number} updated` });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const adminMobile =
    typeof window !== "undefined"
      ? sessionStorage.getItem("k53_admin_mobile") || ""
      : "";

  const stats = useMemo(() => {
    const active = users.filter((user) => user.status === "active").length;
    const suspended = users.filter((user) => user.status === "suspended").length;
    return {
      total: users.length,
      active,
      suspended,
      needsAccess: users.length - active - suspended,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (term) {
        const haystack = [user.mobile_number, user.name, user.surname]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (statusFilter === "active") return user.status === "active";
      if (statusFilter === "suspended") return user.status === "suspended";
      if (statusFilter === "inactive") {
        return user.status !== "active" && user.status !== "suspended";
      }
      return true;
    });
  }, [users, search, statusFilter]);

  const openIssueDialog = (user?: AdminUserSummary) => {
    setIssued(null);
    setTargetMobile(user?.mobile_number ?? "");
    setTargetType(
      user?.access_type === "weekly" ||
        user?.access_type === "monthly" ||
        user?.access_type === "master"
        ? user.access_type
        : "monthly"
    );
    setTargetAdmin(user?.has_admin_access ?? false);
    setMobileLocked(!!user);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setIssued(null);
  };

  const openProfileDialog = (user: AdminUserSummary) => {
    setProfileMobile(user.mobile_number);
    setProfileName(user.name ?? "");
    setProfileSurname(user.surname ?? "");
    setProfileDialogOpen(true);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Code copied" });
    } catch {
      toast({
        title: "Could not copy",
        description: "Select the code and copy it manually.",
        variant: "destructive",
      });
    }
  };

  const suspendUser = (user: AdminUserSummary) => {
    if (!window.confirm(
      `Suspend access for ${user.mobile_number}? All current codes will be revoked. Study progress and test history are kept.`
    )) {
      return;
    }
    const reason = window.prompt(
      `Reason for suspending ${user.mobile_number} (optional):`
    );
    if (reason === null) return;
    suspendMutation.mutate({
      mobile_number: user.mobile_number,
      reason: reason.trim() || null,
    });
  };

  const deleteUser = (user: AdminUserSummary) => {
    if (!window.confirm(
      `Delete all server-saved data for ${user.mobile_number}? This permanently removes access codes, study progress and test history from the server. Data saved on the learner's device is not affected. This cannot be undone.`
    )) {
      return;
    }
    deleteMutation.mutate(user.mobile_number);
  };

  const validMobile = /^\d{10}$/.test(targetMobile);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold tracking-tight">Users</h2>
            <p className="text-sm text-muted-foreground">
              Mobile-linked access, saved progress and test history.
            </p>
          </div>
        </div>
        <Button onClick={() => openIssueDialog()} className="h-10">
          <UserPlus className="h-4 w-4 mr-2" />
          Issue access
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total users", value: stats.total, tone: "text-foreground" },
          { label: "Active", value: stats.active, tone: "text-green-600" },
          { label: "Suspended", value: stats.suspended, tone: "text-red-600" },
          { label: "Need access", value: stats.needsAccess, tone: "text-amber-600" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </p>
            <p className={`text-2xl font-display font-black mt-1 ${stat.tone}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
        Daily (D) codes are shared and are not linked to a mobile number, so they do
        not appear here. To move a daily learner onto Weekly or Monthly, use
        Issue access and enter their mobile number.
      </div>

      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search mobile, name or surname"
            value={search}
            onChange={(event) => setSearch(event.target.value.slice(0, 60))}
            inputMode="search"
            className="h-10 pl-9 bg-background/60"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger className="h-10 sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="active">Active access</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="inactive">Needs access</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          aria-label="Refresh users"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Expires</TableHead>
              <TableHead className="hidden lg:table-cell">Saved data</TableHead>
              <TableHead className="hidden xl:table-cell">Last activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-destructive py-10">
                  Could not load users. Try refresh.
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  No users match this view.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isSelf = user.mobile_number === adminMobile;
                const fullName = [user.name, user.surname].filter(Boolean).join(" ");
                return (
                  <TableRow key={user.mobile_number}>
                    <TableCell>
                      {fullName ? (
                        <p className="font-semibold leading-tight">{fullName}</p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">Name not provided</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="font-mono text-xs text-muted-foreground">{user.mobile_number}</span>
                        {user.has_admin_access && (
                          <Badge variant="outline" className="border-purple-200 bg-purple-100 text-purple-700">
                            Admin
                          </Badge>
                        )}
                        {isSelf && <Badge variant="secondary">You</Badge>}
                      </div>
                      {user.suspended && user.suspension_reason && (
                        <p className="text-[10px] text-red-600 mt-1 max-w-[220px] truncate">
                          {user.suspension_reason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.access_type ? (
                        <div>
                          <p className="font-semibold">{TYPE_LABEL[user.access_type]}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {user.access_code || "-"}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No code</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_CLASS[user.status]}
                      >
                        {STATUS_LABEL[user.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {user.expires_at ? formatDate(user.expires_at) : user.access_type === "master" ? "Never" : "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      <p>{user.progress_count} progress</p>
                      <p>{user.test_count} tests</p>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                      {formatDateTime(user.last_activity_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit name and surname"
                          aria-label={`Edit ${user.mobile_number}`}
                          onClick={() => openProfileDialog(user)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          disabled={isSelf}
                          title={isSelf ? "Use Access Codes to manage your own key" : user.suspended ? "Restore access" : "Issue or change access"}
                          onClick={() => openIssueDialog(user)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">
                            {user.suspended ? "Restore" : "Access"}
                          </span>
                        </Button>
                        {!user.suspended && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600"
                            disabled={isSelf || suspendMutation.isPending}
                            title="Suspend access"
                            aria-label={`Suspend ${user.mobile_number}`}
                            onClick={() => suspendUser(user)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          disabled={isSelf || deleteMutation.isPending}
                          title="Delete all saved data"
                          aria-label={`Delete ${user.mobile_number}`}
                          onClick={() => deleteUser(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{mobileLocked ? "Change access" : "Issue access"}</DialogTitle>
            <DialogDescription>
              {issued
                ? "Share the new code with the learner."
                : "A new code revokes the learner's previous codes. The new period starts now."}
            </DialogDescription>
          </DialogHeader>

          {issued ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-green-700">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-[11px] font-black uppercase tracking-widest">
                    New access code
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl bg-white border border-green-200 px-3 py-3 text-center font-mono text-2xl font-black tracking-[0.2em]">
                    {issued.code.code}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12"
                    aria-label="Copy new code"
                    onClick={() => copyCode(issued.code.code)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-green-800">
                  {TYPE_LABEL[issued.code.type]} access until{" "}
                  {issued.code.expires_at ? formatDate(issued.code.expires_at) : "further notice"}.
                </p>
                {issued.unsuspended && (
                  <p className="text-xs font-semibold text-green-800">
                    Suspension lifted for this mobile.
                  </p>
                )}
                <p className="text-xs text-green-800">
                  {issued.revoked} previous code(s) revoked.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={closeDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!validMobile || issueMutation.isPending) return;
                issueMutation.mutate({
                  mobile_number: targetMobile,
                  type: targetType,
                  hasAdminAccess: targetType === "master" ? targetAdmin : false,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="user-mobile">Mobile number</Label>
                <Input
                  id="user-mobile"
                  value={targetMobile}
                  onChange={(event) =>
                    setTargetMobile(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  maxLength={10}
                  disabled={mobileLocked}
                  className="h-11 font-mono tracking-[0.2em]"
                />
                {!validMobile && targetMobile.length > 0 && (
                  <p className="text-[11px] text-destructive">
                    Enter a 10-digit mobile number.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Access type</Label>
                <Select
                  value={targetType}
                  onValueChange={(value) => setTargetType(value as AssignableType)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {targetType === "master" && (
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Checkbox
                    checked={targetAdmin}
                    onCheckedChange={(checked) => setTargetAdmin(checked === true)}
                  />
                  Grant admin console access
                </label>
              )}

              {mobileLocked && users.find((user) => user.mobile_number === targetMobile)?.suspended && (
                <p className="text-xs rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  This mobile is suspended. Issuing a new code also lifts the suspension.
                </p>
              )}

              <p className="text-[11px] text-muted-foreground">
                Saved study progress and test history stay linked to this mobile.
              </p>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!validMobile || issueMutation.isPending}
                >
                  {issueMutation.isPending ? "Issuing..." : "Issue new code"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={profileDialogOpen}
        onOpenChange={(open) => setProfileDialogOpen(open)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Name and surname shown for this learner on the Users page. Access is
              managed separately.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (profileMutation.isPending) return;
              profileMutation.mutate({
                mobile_number: profileMobile,
                name: profileName,
                surname: profileSurname,
              });
            }}
          >
            <div className="space-y-1.5">
              <Label>Mobile number</Label>
              <Input
                value={profileMobile}
                readOnly
                disabled
                className="h-11 font-mono tracking-[0.2em]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value.slice(0, 200))}
                placeholder="Optional"
                maxLength={200}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-surname">Surname</Label>
              <Input
                id="profile-surname"
                value={profileSurname}
                onChange={(event) => setProfileSurname(event.target.value.slice(0, 200))}
                placeholder="Optional"
                maxLength={200}
                className="h-11"
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              Clearing both fields falls back to the name captured on the learner's
              latest test.
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProfileDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
