"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardList, FolderCog, ListChecks, RefreshCw, X } from "lucide-react";

import {
  createProjectAction,
  createProjectCaseAction,
  getProjectCasesPageAction,
  getProjectTemplatesPageAction,
  getProjectTransfersPageAction,
  requestProjectTransferAction,
  reviewProjectTransferAction,
  updateProjectCommissionRateAction,
} from "@/app/actions/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { PaginatedResult, ProjectCaseItem, ProjectOption, ProjectTemplateItem, ProjectTransferItem } from "@/services/projects.service";

interface ProjectCommissionSettingsProps {
  initialProjectsPage: PaginatedResult<ProjectTemplateItem>;
  initialCasesPage: PaginatedResult<ProjectCaseItem>;
  initialPendingTransfersPage: PaginatedResult<ProjectTransferItem>;
  locale: string;
}

interface SalesProjectWorkspaceProps {
  templates: ProjectTemplateItem[];
  myCases: ProjectCaseItem[];
  myTransfers: ProjectTransferItem[];
  transferTargets: ProjectOption[];
  reviewQueue?: ProjectTransferItem[];
  canReviewTransfers?: boolean;
  allowCaseCreate?: boolean;
  locale: string;
}

interface CreateProjectForm {
  name: string;
  description: string;
  status: "todo" | "in_progress" | "doing" | "done" | "active";
  dueDate: string;
  commissionRate: string;
  active: boolean;
  requireCustomerName: boolean;
  requireCustomerPhone: boolean;
  requireCustomerAddress: boolean;
  requireFacePhoto: boolean;
  requireIdCard: boolean;
  requireIdAddress: boolean;
}

interface TransferDraft {
  toSalesId: string;
  reason: string;
}

const NONE_OPTION = "__none__";
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const EMPTY_CREATE_FORM: CreateProjectForm = {
  name: "",
  description: "",
  status: "todo",
  dueDate: "",
  commissionRate: "0",
  active: true,
  requireCustomerName: true,
  requireCustomerPhone: true,
  requireCustomerAddress: false,
  requireFacePhoto: false,
  requireIdCard: false,
  requireIdAddress: false,
};

function normalizeInputRate(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function localizeStatus(status: string, locale: string) {
  const normalized = status.toLowerCase();

  if (locale === "th") {
    if (normalized === "done") return "เสร็จแล้ว";
    if (normalized === "in_progress" || normalized === "doing") return "กำลังดำเนินการ";
    if (normalized === "active") return "เปิดใช้งาน";
    return "รอดำเนินการ";
  }

  if (normalized === "done") return "Done";
  if (normalized === "in_progress" || normalized === "doing") return "In Progress";
  if (normalized === "active") return "Active";
  return "Todo";
}

function localizeApprovalStatus(status: string, locale: string) {
  const normalized = status.toLowerCase();

  if (locale === "th") {
    if (normalized === "approved") return "อนุมัติแล้ว";
    if (normalized === "rejected") return "ไม่อนุมัติ";
    return "รออนุมัติ";
  }

  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  return "Pending";
}

function localizeLifecycleStatus(status: string, locale: string) {
  const normalized = status.toLowerCase();

  if (locale === "th") {
    if (normalized === "handover_pending") return "รอโอนงาน";
    if (normalized === "in_progress") return "กำลังดำเนินการ";
    if (normalized === "done") return "เสร็จแล้ว";
    if (normalized === "cancelled") return "ยกเลิก";
    return "เปิดเคส";
  }

  if (normalized === "handover_pending") return "Handover Pending";
  if (normalized === "in_progress") return "In Progress";
  if (normalized === "done") return "Done";
  if (normalized === "cancelled") return "Cancelled";
  return "Open";
}

function statusBadgeVariant(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "done" || normalized === "approved") return "success" as const;
  if (normalized === "pending" || normalized === "in_progress" || normalized === "doing" || normalized === "active") {
    return "warning" as const;
  }

  return "outline" as const;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return locale === "th" ? "ไม่ระบุ" : "-";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function requirementsSummary(project: ProjectTemplateItem, locale: string) {
  const labels =
    locale === "th"
      ? {
          fullName: "ชื่อ-นามสกุล",
          phone: "เบอร์โทร",
          address: "ที่อยู่",
          facePhoto: "รูปหน้าตรง",
          idCard: "รูปบัตรประชาชน",
          idAddress: "ที่อยู่ตามบัตร",
        }
      : { fullName: "Name", phone: "Phone", address: "Address", facePhoto: "Face", idCard: "ID Card", idAddress: "ID Address" };

  const required = Object.entries(project.requirements)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => labels[key as keyof typeof labels]);

  return required.length ? required.join(", ") : locale === "th" ? "ไม่ต้องกรอกข้อมูล" : "No required fields";
}

export function ProjectCommissionSettings({ initialProjectsPage, initialCasesPage, initialPendingTransfersPage, locale }: ProjectCommissionSettingsProps) {
  const [pending, startTransition] = useTransition();

  const [projects, setProjects] = useState(initialProjectsPage.items);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [caseRows, setCaseRows] = useState(initialCasesPage.items);
  const [casesLoading, setCasesLoading] = useState(false);

  const [pendingTransfers, setPendingTransfers] = useState(initialPendingTransfersPage.items);
  const [transfersLoading, setTransfersLoading] = useState(false);

  const [createForm, setCreateForm] = useState<CreateProjectForm>(EMPTY_CREATE_FORM);
  const [draftRates, setDraftRates] = useState<Record<string, string>>(
    Object.fromEntries(initialProjectsPage.items.map((item) => [item.id, String(item.commissionRate)])),
  );
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [reviewingTransferId, setReviewingTransferId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<"manage" | "templates" | "cases" | "transfers" | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const modalCloseTimerRef = useRef<number | null>(null);

  const t =
    locale === "th"
      ? {
          title: "จัดการโปรเจต (CEO)",
          description: "เพิ่มโครงการถาวร ตั้งค่าคอมมิชชั่น และกำหนดข้อมูลลูกค้าที่ฝ่ายขายต้องกรอก",
          name: "ชื่อโครงการ",
          desc: "รายละเอียดโครงการ",
          status: "สถานะ",
          dueDate: "กำหนดส่ง",
          commission: "คอมมิชชั่น (%)",
          active: "เปิดใช้งาน",
          reqTitle: "ข้อมูลลูกค้าที่ต้องกรอก",
          reqName: "ชื่อ-นามสกุล",
          reqPhone: "เบอร์โทร",
          reqAddress: "ที่อยู่",
          reqFace: "รูปหน้าตรง",
          reqIdCard: "รูปบัตรประชาชน",
          reqIdAddress: "ที่อยู่ตามบัตร",
          add: "เพิ่มโปรเจต",
          reset: "รีเซ็ต",
          save: "บันทึก",
          templates: "รายการโปรเจต",
          cases: "เคสขายทั้งหมด",
          transferQueue: "คำขอโอนงานรออนุมัติ",
          project: "โครงการ",
          customer: "ลูกค้า",
          owner: "ผู้รับผิดชอบ",
          commissionOwner: "เจ้าของคอมมิชชั่น",
          approval: "การอนุมัติ",
          lifecycle: "สถานะงาน",
          from: "จาก",
          to: "ไปยัง",
          reason: "เหตุผล",
          requestedBy: "ผู้ส่งคำขอ",
          approve: "อนุมัติ",
          reject: "ไม่อนุมัติ",
          phone: "เบอร์โทร",
        }
      : {
          title: "Project Template Management (CEO)",
          description: "Create permanent projects, define commission, and configure required customer fields for sales.",
          name: "Project Name",
          desc: "Description",
          status: "Status",
          dueDate: "Due Date",
          commission: "Commission (%)",
          active: "Active",
          reqTitle: "Required customer fields",
          reqName: "Full Name",
          reqPhone: "Phone",
          reqAddress: "Address",
          reqFace: "Face Photo",
          reqIdCard: "ID Card",
          reqIdAddress: "ID Address",
          add: "Add Template",
          reset: "Reset",
          save: "Save",
          templates: "Template List",
          cases: "All Sales Cases",
          transferQueue: "Pending Transfer Queue",
          project: "Project",
          customer: "Customer",
          owner: "Owner",
          commissionOwner: "Commission Owner",
          approval: "Approval",
          lifecycle: "Lifecycle",
          from: "From",
          to: "To",
          reason: "Reason",
          requestedBy: "Requested By",
          approve: "Approve",
          reject: "Reject",
          phone: "Phone",
        };

  const statusOptions = useMemo(
    () => ["todo", "in_progress", "doing", "done", "active"].map((value) => ({ value, label: localizeStatus(value, locale) })),
    [locale],
  );

  const menu =
    locale === "th"
      ? {
          hint: "กดปุ่มเมนูด้านบนเพื่อเปิดฟอร์มในป๊อปอัพ",
          manage: "จัดการโปรเจต",
          templates: "รายการโปรเจต",
          cases: "เคสขายทั้งหมด",
          transfers: "คำขอโอนงาน",
          close: "ปิด",
          actions: "การทำงาน",
          noData: "ยังไม่มีข้อมูล",
          noPending: "ไม่มีคำขอค้าง",
          saving: "กำลังบันทึก...",
          search: "\u0e04\u0e49\u0e19\u0e2b\u0e32",
          searchTemplates: "\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e42\u0e1b\u0e23\u0e40\u0e08\u0e15",
          searchCases: "\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e40\u0e04\u0e2a",
          searchTransfers: "\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e04\u0e33\u0e02\u0e2d\u0e42\u0e2d\u0e19\u0e07\u0e32\u0e19",
          rowsPerPage: "\u0e41\u0e16\u0e27/\u0e2b\u0e19\u0e49\u0e32",
          page: "\u0e2b\u0e19\u0e49\u0e32",
          prev: "\u0e01\u0e48\u0e2d\u0e19\u0e2b\u0e19\u0e49\u0e32",
          next: "\u0e16\u0e31\u0e14\u0e44\u0e1b",
          results: "\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23",
        }
      : {
          hint: "Open each section in popup using menu buttons.",
          manage: "Manage Template",
          templates: "Template List",
          cases: "All Cases",
          transfers: "Transfer Queue",
          close: "Close",
          actions: "Actions",
          noData: "No data",
          noPending: "No pending requests",
          saving: "Saving...",
          search: "Search",
          searchTemplates: "Search templates",
          searchCases: "Search cases",
          searchTransfers: "Search transfer queue",
          rowsPerPage: "Rows/page",
          page: "Page",
          prev: "Prev",
          next: "Next",
          results: "results",
        };


  const [templatesSearch, setTemplatesSearch] = useState("");
  const [templatesPage, setTemplatesPage] = useState(1);
  const [templatesPageSize, setTemplatesPageSize] = useState(initialProjectsPage.pageSize);
  const [templatesCursor, setTemplatesCursor] = useState<string | null>(null);
  const [templatesCursorHistory, setTemplatesCursorHistory] = useState<Array<string | null>>([]);
  const [templatesHasNext, setTemplatesHasNext] = useState(initialProjectsPage.hasNext);
  const [templatesNextCursor, setTemplatesNextCursor] = useState<string | null>(initialProjectsPage.nextCursor);

  const [casesSearch, setCasesSearch] = useState("");
  const [casesPage, setCasesPage] = useState(1);
  const [casesPageSize, setCasesPageSize] = useState(initialCasesPage.pageSize);
  const [casesCursor, setCasesCursor] = useState<string | null>(null);
  const [casesCursorHistory, setCasesCursorHistory] = useState<Array<string | null>>([]);
  const [casesHasNext, setCasesHasNext] = useState(initialCasesPage.hasNext);
  const [casesNextCursor, setCasesNextCursor] = useState<string | null>(initialCasesPage.nextCursor);

  const [transfersSearch, setTransfersSearch] = useState("");
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersPageSize, setTransfersPageSize] = useState(initialPendingTransfersPage.pageSize);
  const [transfersCursor, setTransfersCursor] = useState<string | null>(null);
  const [transfersCursorHistory, setTransfersCursorHistory] = useState<Array<string | null>>([]);
  const [transfersHasNext, setTransfersHasNext] = useState(initialPendingTransfersPage.hasNext);
  const [transfersNextCursor, setTransfersNextCursor] = useState<string | null>(initialPendingTransfersPage.nextCursor);

  const debouncedTemplatesSearch = useDebouncedValue(templatesSearch, 320);
  const debouncedCasesSearch = useDebouncedValue(casesSearch, 320);
  const debouncedTransfersSearch = useDebouncedValue(transfersSearch, 320);

  const pagedTemplates = useMemo(
    () => ({
      items: projects,
      currentPage: templatesPage,
      hasNext: templatesHasNext,
    }),
    [projects, templatesPage, templatesHasNext],
  );

  const pagedCases = useMemo(
    () => ({
      items: caseRows,
      currentPage: casesPage,
      hasNext: casesHasNext,
    }),
    [caseRows, casesPage, casesHasNext],
  );

  const pagedTransfers = useMemo(
    () => ({
      items: pendingTransfers,
      currentPage: transfersPage,
      hasNext: transfersHasNext,
    }),
    [pendingTransfers, transfersPage, transfersHasNext],
  );

  useEffect(() => {
    setTemplatesPage(1);
    setTemplatesCursor(null);
    setTemplatesCursorHistory([]);
    setTemplatesHasNext(false);
    setTemplatesNextCursor(null);
  }, [templatesSearch, templatesPageSize]);

  useEffect(() => {
    setCasesPage(1);
    setCasesCursor(null);
    setCasesCursorHistory([]);
    setCasesHasNext(false);
    setCasesNextCursor(null);
  }, [casesSearch, casesPageSize]);

  useEffect(() => {
    setTransfersPage(1);
    setTransfersCursor(null);
    setTransfersCursorHistory([]);
    setTransfersHasNext(false);
    setTransfersNextCursor(null);
  }, [transfersSearch, transfersPageSize]);

  useEffect(() => {
    let active = true;

    const loadTemplates = async () => {
      setProjectsLoading(true);

      const result = await getProjectTemplatesPageAction({
        page_size: templatesPageSize,
        search: debouncedTemplatesSearch || null,
        cursor: templatesCursor,
      });

      if (!active) {
        return;
      }

      if (!result.ok || !result.data) {
        toast.error(result.message ?? (locale === "th" ? "โหลดรายการโปรเจตไม่สำเร็จ" : "Unable to load project templates"));
        setProjectsLoading(false);
        return;
      }

      setProjects(result.data.items);
      setTemplatesHasNext(result.data.hasNext);
      setTemplatesNextCursor(result.data.nextCursor);
      setDraftRates((current) => {
        const next = { ...current };
        for (const project of result.data.items) {
          if (!(project.id in next)) {
            next[project.id] = String(project.commissionRate);
          }
        }
        return next;
      });
      setProjectsLoading(false);
    };

    void loadTemplates();

    return () => {
      active = false;
    };
  }, [templatesCursor, templatesPageSize, debouncedTemplatesSearch, locale]);

  useEffect(() => {
    let active = true;

    const loadCases = async () => {
      setCasesLoading(true);
      const result = await getProjectCasesPageAction({
        page_size: casesPageSize,
        search: debouncedCasesSearch || null,
        cursor: casesCursor,
      });

      if (!active) {
        return;
      }

      if (!result.ok || !result.data) {
        toast.error(result.message ?? (locale === "th" ? "โหลดรายการเคสไม่สำเร็จ" : "Unable to load project cases"));
        setCasesLoading(false);
        return;
      }

      setCaseRows(result.data.items);
      setCasesHasNext(result.data.hasNext);
      setCasesNextCursor(result.data.nextCursor);
      setCasesLoading(false);
    };

    void loadCases();

    return () => {
      active = false;
    };
  }, [casesCursor, casesPageSize, debouncedCasesSearch, locale]);

  useEffect(() => {
    let active = true;

    const loadTransfers = async () => {
      setTransfersLoading(true);
      const result = await getProjectTransfersPageAction({
        page_size: transfersPageSize,
        search: debouncedTransfersSearch || null,
        cursor: transfersCursor,
      });

      if (!active) {
        return;
      }

      if (!result.ok || !result.data) {
        toast.error(result.message ?? (locale === "th" ? "โหลดคำขอโอนงานไม่สำเร็จ" : "Unable to load transfer queue"));
        setTransfersLoading(false);
        return;
      }

      setPendingTransfers(result.data.items);
      setTransfersHasNext(result.data.hasNext);
      setTransfersNextCursor(result.data.nextCursor);
      setTransfersLoading(false);
    };

    void loadTransfers();

    return () => {
      active = false;
    };
  }, [transfersCursor, transfersPageSize, debouncedTransfersSearch, locale]);


  useEffect(() => {
    return () => {
      if (modalCloseTimerRef.current) {
        clearTimeout(modalCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeModal) {
        closeModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeModal]);

  function openModal(modal: Exclude<typeof activeModal, null>) {
    if (activeModal === modal && modalOpen) {
      closeModal();
      return;
    }

    if (modalCloseTimerRef.current) {
      clearTimeout(modalCloseTimerRef.current);
    }

    setActiveModal(modal);
    requestAnimationFrame(() => setModalOpen(true));
  }

  function closeModal() {
    setModalOpen(false);
    modalCloseTimerRef.current = window.setTimeout(() => setActiveModal(null), 260);
  }

  function resetCreateForm() {
    setCreateForm(EMPTY_CREATE_FORM);
  }

  function onAddProject() {
    if (!createForm.name.trim()) {
      toast.error(locale === "th" ? "กรุณากรอกชื่อโครงการ" : "Please enter project name");
      return;
    }

    const rate = normalizeInputRate(createForm.commissionRate);

    if (rate === null) {
      toast.error(locale === "th" ? "กรุณากรอกเปอร์เซ็นต์ระหว่าง 0 ถึง 100" : "Please enter rate between 0 and 100");
      return;
    }

    startTransition(async () => {
      const result = await createProjectAction({
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        customer_id: null,
        owner_id: null,
        status: createForm.status,
        due_date: createForm.dueDate || null,
        commission_rate: rate,
        active: createForm.active,
        is_template: true,
        require_customer_name: createForm.requireCustomerName,
        require_customer_phone: createForm.requireCustomerPhone,
        require_customer_address: createForm.requireCustomerAddress,
        require_face_photo: createForm.requireFacePhoto,
        require_id_card: createForm.requireIdCard,
        require_id_address: createForm.requireIdAddress,
      });

      if (!result.ok || !result.project) {
        toast.error(result.message ?? (locale === "th" ? "ไม่สามารถสร้างโครงการได้" : "Unable to create project"));
        return;
      }

      const newProject: ProjectTemplateItem = {
        id: result.project.id,
        name: result.project.name,
        description: result.project.description ?? "",
        status: result.project.status,
        ownerId: result.project.owner_id ?? null,
        ownerName: "-",
        customerId: result.project.customer_id ?? null,
        customerName: "-",
        dueDate: result.project.due_date ?? null,
        commissionRate: Number(result.project.commission_rate ?? rate),
        active: Boolean(result.project.active ?? true),
        isTemplate: Boolean(result.project.is_template ?? true),
        requirements: {
          fullName: Boolean(result.project.require_customer_name ?? createForm.requireCustomerName),
          phone: Boolean(result.project.require_customer_phone ?? createForm.requireCustomerPhone),
          address: Boolean(result.project.require_customer_address ?? createForm.requireCustomerAddress),
          facePhoto: Boolean(result.project.require_face_photo ?? createForm.requireFacePhoto),
          idCard: Boolean(result.project.require_id_card ?? createForm.requireIdCard),
          idAddress: Boolean(result.project.require_id_address ?? createForm.requireIdAddress),
        },
        updatedAt: result.project.created_at ?? new Date().toISOString(),
        createdAt: result.project.created_at ?? new Date().toISOString(),
      };

      setProjects((current) => [newProject, ...current]);
      setDraftRates((current) => ({ ...current, [newProject.id]: String(newProject.commissionRate) }));
      resetCreateForm();
      toast.success(locale === "th" ? "เพิ่มโปรเจตสำเร็จ" : "Template created");
    });
  }

  function onSaveCommission(projectId: string) {
    const rate = normalizeInputRate(draftRates[projectId] ?? "");

    if (rate === null) {
      toast.error(locale === "th" ? "กรุณากรอกเปอร์เซ็นต์ระหว่าง 0 ถึง 100" : "Please enter rate between 0 and 100");
      return;
    }

    setSavingProjectId(projectId);

    startTransition(async () => {
      const result = await updateProjectCommissionRateAction({ project_id: projectId, commission_rate: rate });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "ไม่สามารถบันทึกได้" : "Unable to save"));
        setSavingProjectId(null);
        return;
      }

      setProjects((current) =>
        current.map((item) =>
          item.id === projectId
            ? {
                ...item,
                commissionRate: result.project?.commission_rate ?? rate,
              }
            : item,
        ),
      );

      setSavingProjectId(null);
      toast.success(locale === "th" ? "บันทึกสำเร็จ" : "Saved");
    });
  }

  function onReviewTransfer(transferId: string, decision: "approved" | "rejected") {
    setReviewingTransferId(transferId);

    startTransition(async () => {
      const result = await reviewProjectTransferAction({ transfer_id: transferId, decision });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "ไม่สามารถตรวจสอบคำขอได้" : "Unable to review request"));
        setReviewingTransferId(null);
        return;
      }

      setPendingTransfers((current) => current.filter((item) => item.id !== transferId));
      setReviewingTransferId(null);
      toast.success(decision === "approved" ? t.approve : t.reject);
    });
  }


  function renderTableToolbar(props: {
    searchValue: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
    pageSize: number;
    onPageSizeChange: (value: number) => void;
    page: number;
    itemsCount: number;
    canPrev: boolean;
    hasNext: boolean;
    loading?: boolean;
    onPrev: () => void;
    onNext: () => void;
  }) {
    return (
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Input
          value={props.searchValue}
          onChange={(event) => props.onSearchChange(event.target.value)}
          placeholder={props.searchPlaceholder}
          className="w-full md:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{menu.rowsPerPage}</span>
          <select
            value={props.pageSize}
            onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>{menu.page} {props.page}</span>
          <span>({props.itemsCount} {menu.results})</span>
          {props.loading ? <span className="text-xs">{menu.saving}</span> : null}
          <Button type="button" variant="outline" size="sm" onClick={props.onPrev} disabled={Boolean(props.loading) || !props.canPrev}>{menu.prev}</Button>
          <Button type="button" variant="outline" size="sm" onClick={props.onNext} disabled={Boolean(props.loading) || !props.hasNext}>{menu.next}</Button>
        </div>
      </div>
    );
  }


  function renderManageSection() {
    return (
      <div className="grid gap-3 md:grid-cols-6">
        <Input className="md:col-span-2" placeholder={t.name} value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} />
        <Input className="md:col-span-1" type="number" min={0} max={100} step="0.01" placeholder={t.commission} value={createForm.commissionRate} onChange={(event) => setCreateForm((current) => ({ ...current, commissionRate: event.target.value }))} />
        <Select value={createForm.status} onValueChange={(value) => setCreateForm((current) => ({ ...current, status: value as CreateProjectForm["status"] }))}>
          <SelectTrigger className="md:col-span-1"><SelectValue placeholder={t.status} /></SelectTrigger>
          <SelectContent>
            {statusOptions.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="md:col-span-2" type="date" value={createForm.dueDate} onChange={(event) => setCreateForm((current) => ({ ...current, dueDate: event.target.value }))} />
        <Textarea className="md:col-span-6 min-h-[56px]" placeholder={t.desc} value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} />
        <label className="md:col-span-6 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><input type="checkbox" checked={createForm.active} onChange={(event) => setCreateForm((current) => ({ ...current, active: event.target.checked }))} />{t.active}</label>
        <div className="md:col-span-6 rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">{t.reqTitle}</p>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={createForm.requireCustomerName} onChange={(event) => setCreateForm((current) => ({ ...current, requireCustomerName: event.target.checked }))} />{t.reqName}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={createForm.requireCustomerPhone} onChange={(event) => setCreateForm((current) => ({ ...current, requireCustomerPhone: event.target.checked }))} />{t.reqPhone}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={createForm.requireCustomerAddress} onChange={(event) => setCreateForm((current) => ({ ...current, requireCustomerAddress: event.target.checked }))} />{t.reqAddress}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={createForm.requireFacePhoto} onChange={(event) => setCreateForm((current) => ({ ...current, requireFacePhoto: event.target.checked }))} />{t.reqFace}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={createForm.requireIdCard} onChange={(event) => setCreateForm((current) => ({ ...current, requireIdCard: event.target.checked }))} />{t.reqIdCard}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={createForm.requireIdAddress} onChange={(event) => setCreateForm((current) => ({ ...current, requireIdAddress: event.target.checked }))} />{t.reqIdAddress}</label>
          </div>
        </div>
        <div className="md:col-span-6 flex gap-2">
          <Button type="button" onClick={onAddProject} disabled={pending}>{t.add}</Button>
          <Button type="button" variant="outline" onClick={resetCreateForm} disabled={pending}>{t.reset}</Button>
        </div>
      </div>
    );
  }

  function renderTemplatesSection() {
    return (
      <div className="space-y-3">
        {renderTableToolbar({
          searchValue: templatesSearch,
          onSearchChange: setTemplatesSearch,
          searchPlaceholder: menu.searchTemplates,
          pageSize: templatesPageSize,
          onPageSizeChange: setTemplatesPageSize,
          page: pagedTemplates.currentPage,
          itemsCount: pagedTemplates.items.length,
          canPrev: templatesCursorHistory.length > 0,
          hasNext: pagedTemplates.hasNext,
          loading: projectsLoading,
          onPrev: () => {
            if (templatesCursorHistory.length === 0) {
              return;
            }

            setTemplatesCursorHistory((current) => {
              const next = [...current];
              const previousCursor = next.pop() ?? null;
              setTemplatesCursor(previousCursor);
              return next;
            });
            setTemplatesPage((current) => Math.max(1, current - 1));
          },
          onNext: () => {
            if (!templatesHasNext || !templatesNextCursor) {
              return;
            }

            setTemplatesCursorHistory((current) => [...current, templatesCursor]);
            setTemplatesCursor(templatesNextCursor);
            setTemplatesPage((current) => current + 1);
          },
        })}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.project}</TableHead>
              <TableHead>{t.status}</TableHead>
              <TableHead>{t.dueDate}</TableHead>
              <TableHead>{t.commission}</TableHead>
              <TableHead>{t.reqTitle}</TableHead>
              <TableHead>{t.active}</TableHead>
              <TableHead>{menu.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedTemplates.items.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">{menu.noData}</TableCell></TableRow>
            ) : (
              pagedTemplates.items.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>{project.name}</TableCell>
                  <TableCell><Badge variant={statusBadgeVariant(project.status)}>{localizeStatus(project.status, locale)}</Badge></TableCell>
                  <TableCell>{formatDate(project.dueDate, locale)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} max={100} step="0.01" value={draftRates[project.id] ?? String(project.commissionRate)} onChange={(event) => setDraftRates((current) => ({ ...current, [project.id]: event.target.value }))} />
                      <span className="text-sm">%</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[240px] text-xs text-muted-foreground">{requirementsSummary(project, locale)}</TableCell>
                  <TableCell><Badge variant={project.active ? "success" : "outline"}>{project.active ? "ON" : "OFF"}</Badge></TableCell>
                  <TableCell><Button type="button" size="sm" disabled={pending} onClick={() => onSaveCommission(project.id)}>{pending && savingProjectId === project.id ? menu.saving : t.save}</Button></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  function renderCasesSection() {
    return (
      <div className="space-y-3">
        {renderTableToolbar({
          searchValue: casesSearch,
          onSearchChange: setCasesSearch,
          searchPlaceholder: menu.searchCases,
          pageSize: casesPageSize,
          onPageSizeChange: setCasesPageSize,
          page: pagedCases.currentPage,
          itemsCount: pagedCases.items.length,
          canPrev: casesCursorHistory.length > 0,
          hasNext: pagedCases.hasNext,
          loading: casesLoading,
          onPrev: () => {
            if (casesCursorHistory.length === 0) {
              return;
            }

            setCasesCursorHistory((current) => {
              const next = [...current];
              const previousCursor = next.pop() ?? null;
              setCasesCursor(previousCursor);
              return next;
            });
            setCasesPage((current) => Math.max(1, current - 1));
          },
          onNext: () => {
            if (!casesHasNext || !casesNextCursor) {
              return;
            }

            setCasesCursorHistory((current) => [...current, casesCursor]);
            setCasesCursor(casesNextCursor);
            setCasesPage((current) => current + 1);
          },
        })}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.project}</TableHead>
              <TableHead>{t.customer}</TableHead>
              <TableHead>{t.phone}</TableHead>
              <TableHead>{t.owner}</TableHead>
              <TableHead>{t.commissionOwner}</TableHead>
              <TableHead>{t.commission}</TableHead>
              <TableHead>{t.approval}</TableHead>
              <TableHead>{t.lifecycle}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedCases.items.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">{menu.noData}</TableCell></TableRow>
            ) : (
              pagedCases.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.projectName}</TableCell>
                  <TableCell>{item.customerName}</TableCell>
                  <TableCell>{item.customerPhone}</TableCell>
                  <TableCell>{item.ownerName}</TableCell>
                  <TableCell>{item.commissionOwnerName}</TableCell>
                  <TableCell>{item.commissionRate}%</TableCell>
                  <TableCell><Badge variant={statusBadgeVariant(item.approvalStatus)}>{localizeApprovalStatus(item.approvalStatus, locale)}</Badge></TableCell>
                  <TableCell><Badge variant={statusBadgeVariant(item.lifecycleStatus)}>{localizeLifecycleStatus(item.lifecycleStatus, locale)}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  function renderTransfersSection() {
    return (
      <div className="space-y-3">
        {renderTableToolbar({
          searchValue: transfersSearch,
          onSearchChange: setTransfersSearch,
          searchPlaceholder: menu.searchTransfers,
          pageSize: transfersPageSize,
          onPageSizeChange: setTransfersPageSize,
          page: pagedTransfers.currentPage,
          itemsCount: pagedTransfers.items.length,
          canPrev: transfersCursorHistory.length > 0,
          hasNext: pagedTransfers.hasNext,
          loading: transfersLoading,
          onPrev: () => {
            if (transfersCursorHistory.length === 0) {
              return;
            }

            setTransfersCursorHistory((current) => {
              const next = [...current];
              const previousCursor = next.pop() ?? null;
              setTransfersCursor(previousCursor);
              return next;
            });
            setTransfersPage((current) => Math.max(1, current - 1));
          },
          onNext: () => {
            if (!transfersHasNext || !transfersNextCursor) {
              return;
            }

            setTransfersCursorHistory((current) => [...current, transfersCursor]);
            setTransfersCursor(transfersNextCursor);
            setTransfersPage((current) => current + 1);
          },
        })}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.project}</TableHead>
              <TableHead>{t.from}</TableHead>
              <TableHead>{t.to}</TableHead>
              <TableHead>{t.reason}</TableHead>
              <TableHead>{t.requestedBy}</TableHead>
              <TableHead>{menu.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedTransfers.items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">{menu.noPending}</TableCell></TableRow>
            ) : (
              pagedTransfers.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.projectName}</TableCell>
                  <TableCell>{item.fromSalesName}</TableCell>
                  <TableCell>{item.toSalesName}</TableCell>
                  <TableCell>{item.reason || "-"}</TableCell>
                  <TableCell>{item.requestedByName}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={pending} onClick={() => onReviewTransfer(item.id, "approved")}>{pending && reviewingTransferId === item.id ? menu.saving : t.approve}</Button>
                      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onReviewTransfer(item.id, "rejected")}>{t.reject}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  let modalMeta: {
    title: string;
    widthClass: string;
    panelClass: string;
    contentMaxHeightClass: string;
    icon: ReactNode;
    content: ReactNode;
  } | null = null;

  if (activeModal === "manage") {
    modalMeta = {
      title: menu.manage,
      widthClass: "max-w-6xl",
      panelClass: "min-h-[84vh]",
      contentMaxHeightClass: "max-h-[74vh]",
      icon: <FolderCog className="h-5 w-5" />,
      content: renderManageSection(),
    };
  } else if (activeModal === "templates") {
    modalMeta = {
      title: menu.templates,
      widthClass: "max-w-7xl",
      panelClass: "min-h-[74vh]",
      contentMaxHeightClass: "max-h-[68vh]",
      icon: <ListChecks className="h-5 w-5" />,
      content: renderTemplatesSection(),
    };
  } else if (activeModal === "cases") {
    modalMeta = {
      title: menu.cases,
      widthClass: "max-w-7xl",
      panelClass: "min-h-[72vh]",
      contentMaxHeightClass: "max-h-[66vh]",
      icon: <ClipboardList className="h-5 w-5" />,
      content: renderCasesSection(),
    };
  } else if (activeModal === "transfers") {
    modalMeta = {
      title: menu.transfers,
      widthClass: "max-w-6xl",
      panelClass: "min-h-[70vh]",
      contentMaxHeightClass: "max-h-[64vh]",
      icon: <RefreshCw className="h-5 w-5" />,
      content: renderTransfersSection(),
    };
  }

  function renderActionButton(icon: ReactNode, label: string, modalType: Exclude<typeof activeModal, null>) {
    const isActive = activeModal === modalType && modalOpen;

    return (
      <Button
        type="button"
        variant="outline"
        className={`gap-2 transition-colors ${
          isActive
            ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-600 hover:text-white"
            : "hover:border-blue-300 hover:bg-blue-50/60"
        }`}
        onClick={() => openModal(modalType)}
        disabled={pending}
      >
        {icon}
        <span>{label}</span>
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {renderActionButton(<FolderCog className="h-4 w-4" />, menu.manage, "manage")}
            {renderActionButton(<ListChecks className="h-4 w-4" />, menu.templates, "templates")}
            {renderActionButton(<ClipboardList className="h-4 w-4" />, menu.cases, "cases")}
            {renderActionButton(<RefreshCw className="h-4 w-4" />, menu.transfers, "transfers")}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{menu.hint}</p>
        </CardContent>
      </Card>

      {modalMeta ? (
        <div
          className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 transition-opacity duration-200 ${
            modalOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={closeModal}
        >
          <div
            className={`w-full ${modalMeta.widthClass} ${modalMeta.panelClass} rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transform-gpu transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              modalOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
            }`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={modalMeta.title}
          >
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <span className="rounded-full bg-slate-100 p-2 text-slate-600">{modalMeta.icon}</span>
                <h3 className="text-lg font-semibold">{modalMeta.title}</h3>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeModal}>
                <X className="h-4 w-4" />
                <span className="sr-only">{menu.close}</span>
              </Button>
            </div>
            <div className={`mt-4 ${modalMeta.contentMaxHeightClass} overflow-y-auto px-1 pt-1 pb-1`}>{modalMeta.content}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SalesProjectWorkspace({
  templates,
  myCases: initialCases,
  myTransfers: initialTransfers,
  transferTargets,
  reviewQueue: initialReviewQueue = [],
  canReviewTransfers = false,
  allowCaseCreate = true,
  locale,
}: SalesProjectWorkspaceProps) {
  const [pending, startTransition] = useTransition();

  const activeTemplates = useMemo(() => templates.filter((item) => item.active && item.isTemplate), [templates]);

  const [selectedTemplateId, setSelectedTemplateId] = useState(activeTemplates[0]?.id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerIdAddress, setCustomerIdAddress] = useState("");
  const [facePhoto, setFacePhoto] = useState<File | null>(null);
  const [idCardPhoto, setIdCardPhoto] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [myCases, setMyCases] = useState(initialCases);
  const [myTransfers, setMyTransfers] = useState(initialTransfers);
  const [reviewQueue, setReviewQueue] = useState(initialReviewQueue);
  const [processingCaseId, setProcessingCaseId] = useState<string | null>(null);
  const [processingTransferId, setProcessingTransferId] = useState<string | null>(null);
  const [transferDrafts, setTransferDrafts] = useState<Record<string, TransferDraft>>({});

  const t =
    locale === "th"
      ? {
          title: "พื้นที่ทำงานโครงการฝ่ายขาย",
          description: "เปิดเคสลูกค้าจากโปรเจตของ CEO และส่งคำขอโอนงานได้",
          openTitle: "เปิดเคสใหม่",
          template: "เลือกโครงการ",
          customerName: "ชื่อลูกค้า",
          customerPhone: "เบอร์โทรลูกค้า",
          customerAddress: "ที่อยู่ลูกค้า",
          idAddress: "ที่อยู่ตามบัตรประชาชน",
          facePhoto: "รูปหน้าตรง",
          idCardPhoto: "รูปบัตรประชาชน",
          openCase: "เปิดเคส",
          myCases: "เคสที่รับผิดชอบ",
          transferHistory: "ประวัติการโอนงาน",
          reviewQueue: "คิวอนุมัติการโอนงาน",
          project: "โครงการ",
          customer: "ลูกค้า",
          phone: "เบอร์โทร",
          commission: "คอมมิชชั่น",
          approval: "การอนุมัติ",
          lifecycle: "สถานะงาน",
          transferTo: "โอนไปยัง",
          reason: "เหตุผล",
          actions: "การทำงาน",
          requestTransfer: "ส่งคำขอโอนงาน",
          approve: "อนุมัติ",
          reject: "ไม่อนุมัติ",
          from: "จาก",
          to: "ไปยัง",
          status: "สถานะ",
          requirements: "ข้อมูลที่ต้องกรอก",
        }
      : {
          title: "Sales Project Workspace",
          description: "Open customer cases from CEO templates and request ownership transfer.",
          openTitle: "Open New Case",
          template: "Select Project",
          customerName: "Customer Name",
          customerPhone: "Customer Phone",
          customerAddress: "Customer Address",
          idAddress: "Address on ID Card",
          facePhoto: "Face Photo",
          idCardPhoto: "ID Card Photo",
          openCase: "Open Case",
          myCases: "My Cases",
          transferHistory: "Transfer History",
          reviewQueue: "Transfer Approval Queue",
          project: "Project",
          customer: "Customer",
          phone: "Phone",
          commission: "Commission",
          approval: "Approval",
          lifecycle: "Lifecycle",
          transferTo: "Transfer To",
          reason: "Reason",
          actions: "Actions",
          requestTransfer: "Request Transfer",
          approve: "Approve",
          reject: "Reject",
          from: "From",
          to: "To",
          status: "Status",
          requirements: "Required fields",
        };

  const selectedTemplate = useMemo(() => activeTemplates.find((item) => item.id === selectedTemplateId) ?? null, [activeTemplates, selectedTemplateId]);

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerIdAddress("");
    setFacePhoto(null);
    setIdCardPhoto(null);
    setFileInputKey((current) => current + 1);
  }

  function onOpenCase() {
    if (!selectedTemplate) {
      toast.error(locale === "th" ? "กรุณาเลือกโปรเจต" : "Please select template");
      return;
    }

    setProcessingCaseId("open-case");

    startTransition(async () => {
      const formData = new FormData();
      formData.set("project_id", selectedTemplate.id);
      formData.set("customer_name", customerName);
      formData.set("customer_phone", customerPhone);
      formData.set("customer_address", customerAddress);
      formData.set("customer_id_address", customerIdAddress);

      if (facePhoto) formData.set("customer_face_photo", facePhoto);
      if (idCardPhoto) formData.set("customer_id_card", idCardPhoto);

      const result = await createProjectCaseAction(formData);

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "ไม่สามารถเปิดเคสได้" : "Unable to open case"));
        setProcessingCaseId(null);
        return;
      }

      const nowIso = new Date().toISOString();
      const newCaseId = result.project_case?.id ?? `local-${Date.now()}`;
      const commissionRate = Number(result.project_case?.commission_rate ?? selectedTemplate.commissionRate ?? 0);
      const defaultOwner = locale === "th" ? "ฉัน" : "Me";

      setMyCases((current) => [
        {
          id: newCaseId,
          projectId: selectedTemplate.id,
          projectName: selectedTemplate.name,
          customerName: customerName || "-",
          customerPhone: customerPhone || "-",
          customerAddress: customerAddress || "-",
          ownerId: result.project_case?.sales_owner_id ?? "self",
          ownerName: defaultOwner,
          commissionOwnerId: result.project_case?.commission_owner_id ?? "self",
          commissionOwnerName: defaultOwner,
          commissionRate,
          approvalStatus: result.project_case?.approval_status ?? "pending",
          lifecycleStatus: result.project_case?.lifecycle_status ?? "open",
          openedAt: result.project_case?.opened_at ?? nowIso,
          createdAt: result.project_case?.created_at ?? nowIso,
        },
        ...current,
      ]);
      setTransferDrafts((current) => ({
        ...current,
        [newCaseId]: { toSalesId: NONE_OPTION, reason: "" },
      }));
      setProcessingCaseId(null);
      resetForm();
      toast.success(locale === "th" ? "เปิดเคสสำเร็จ" : "Case opened");
    });
  }

  function updateTransferDraft(caseId: string, patch: Partial<TransferDraft>) {
    setTransferDrafts((current) => ({
      ...current,
      [caseId]: {
        toSalesId: current[caseId]?.toSalesId ?? NONE_OPTION,
        reason: current[caseId]?.reason ?? "",
        ...patch,
      },
    }));
  }

  function onRequestTransfer(caseId: string) {
    const draft = transferDrafts[caseId];

    if (!draft || !draft.toSalesId || draft.toSalesId === NONE_OPTION) {
      toast.error(locale === "th" ? "กรุณาเลือกผู้รับโอน" : "Please select transfer target");
      return;
    }

    setProcessingCaseId(caseId);

    startTransition(async () => {
      const result = await requestProjectTransferAction({ project_case_id: caseId, to_sales_id: draft.toSalesId, reason: draft.reason || null });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "ไม่สามารถส่งคำขอโอนงานได้" : "Unable to submit transfer"));
        setProcessingCaseId(null);
        return;
      }

      const caseEntry = myCases.find((item) => item.id === caseId);
      const targetName = transferTargets.find((target) => target.id === draft.toSalesId)?.name ?? draft.toSalesId;
      const nowIso = new Date().toISOString();

      setMyCases((current) =>
        current.map((item) =>
          item.id === caseId
            ? {
                ...item,
                lifecycleStatus: "handover_pending",
              }
            : item,
        ),
      );
      setMyTransfers((current) => [
        {
          id: result.transfer_id ?? `local-transfer-${Date.now()}`,
          projectCaseId: caseId,
          projectName: caseEntry?.projectName ?? "-",
          fromSalesId: caseEntry?.ownerId ?? "self",
          fromSalesName: caseEntry?.ownerName ?? (locale === "th" ? "ฉัน" : "Me"),
          toSalesId: draft.toSalesId,
          toSalesName: targetName,
          reason: draft.reason || "",
          status: "pending",
          requestedBy: "self",
          requestedByName: locale === "th" ? "ฉัน" : "Me",
          approverId: null,
          approverName: "-",
          approvedAt: null,
          createdAt: nowIso,
        },
        ...current,
      ]);
      setProcessingCaseId(null);
      toast.success(locale === "th" ? "ส่งคำขอโอนงานแล้ว" : "Transfer request submitted");
    });
  }

  function onReviewTransfer(transferId: string, decision: "approved" | "rejected") {
    setProcessingTransferId(transferId);

    startTransition(async () => {
      const result = await reviewProjectTransferAction({ transfer_id: transferId, decision });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "ไม่สามารถพิจารณารายการได้" : "Unable to review"));
        setProcessingTransferId(null);
        return;
      }

      setReviewQueue((current) => current.filter((item) => item.id !== transferId));
      setProcessingTransferId(null);
      toast.success(locale === "th" ? "บันทึกผลการพิจารณาแล้ว" : "Decision saved");
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
      </Card>

      {allowCaseCreate ? (
        <Card>
          <CardHeader><CardTitle>{t.openTitle}</CardTitle></CardHeader>
          <CardContent>
            {activeTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{locale === "th" ? "ยังไม่มีโปรเจตที่พร้อมใช้งาน" : "No templates available"}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger><SelectValue placeholder={t.template} /></SelectTrigger>
                    <SelectContent>
                      {activeTemplates.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedTemplate ? <div className="md:col-span-2 rounded-lg border p-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">{t.requirements}:</span> {requirementsSummary(selectedTemplate, locale)}</div> : null}
                {selectedTemplate?.requirements.fullName ? <Input placeholder={t.customerName} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /> : null}
                {selectedTemplate?.requirements.phone ? <Input placeholder={t.customerPhone} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /> : null}
                {selectedTemplate?.requirements.address ? <Textarea placeholder={t.customerAddress} value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} className="min-h-[40px]" /> : null}
                {selectedTemplate?.requirements.idAddress ? <Textarea placeholder={t.idAddress} value={customerIdAddress} onChange={(event) => setCustomerIdAddress(event.target.value)} className="min-h-[40px]" /> : null}
                {selectedTemplate?.requirements.facePhoto ? <div><p className="mb-1 text-sm">{t.facePhoto}</p><Input key={`face-${fileInputKey}`} type="file" accept="image/*" onChange={(event) => setFacePhoto(event.target.files?.[0] ?? null)} /></div> : null}
                {selectedTemplate?.requirements.idCard ? <div><p className="mb-1 text-sm">{t.idCardPhoto}</p><Input key={`id-${fileInputKey}`} type="file" accept="image/*" onChange={(event) => setIdCardPhoto(event.target.files?.[0] ?? null)} /></div> : null}
                <div className="md:col-span-2 flex justify-end"><Button type="button" disabled={pending} onClick={onOpenCase}>{pending && processingCaseId === "open-case" ? (locale === "th" ? "กำลังเปิด..." : "Opening...") : t.openCase}</Button></div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>{t.myCases}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.project}</TableHead>
                <TableHead>{t.customer}</TableHead>
                <TableHead>{t.phone}</TableHead>
                <TableHead>{t.commission}</TableHead>
                <TableHead>{t.approval}</TableHead>
                <TableHead>{t.lifecycle}</TableHead>
                {allowCaseCreate ? <TableHead>{t.transferTo}</TableHead> : null}
                {allowCaseCreate ? <TableHead>{t.reason}</TableHead> : null}
                {allowCaseCreate ? <TableHead>{t.actions}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {myCases.length === 0 ? (
                <TableRow><TableCell colSpan={allowCaseCreate ? 9 : 6} className="text-center text-sm text-muted-foreground">{locale === "th" ? "ยังไม่มีเคส" : "No cases"}</TableCell></TableRow>
              ) : (
                myCases.map((item) => {
                  const draft = transferDrafts[item.id] ?? { toSalesId: NONE_OPTION, reason: "" };
                  const disabled = pending || item.lifecycleStatus === "handover_pending";

                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.projectName}</TableCell>
                      <TableCell>{item.customerName}</TableCell>
                      <TableCell>{item.customerPhone}</TableCell>
                      <TableCell>{item.commissionRate}%</TableCell>
                      <TableCell><Badge variant={statusBadgeVariant(item.approvalStatus)}>{localizeApprovalStatus(item.approvalStatus, locale)}</Badge></TableCell>
                      <TableCell><Badge variant={statusBadgeVariant(item.lifecycleStatus)}>{localizeLifecycleStatus(item.lifecycleStatus, locale)}</Badge></TableCell>
                      {allowCaseCreate ? (
                        <TableCell>
                          <Select value={draft.toSalesId} onValueChange={(value) => updateTransferDraft(item.id, { toSalesId: value })}>
                            <SelectTrigger><SelectValue placeholder={t.transferTo} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE_OPTION}>-</SelectItem>
                              {transferTargets.map((target) => (<SelectItem key={target.id} value={target.id}>{target.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      ) : null}
                      {allowCaseCreate ? <TableCell><Input value={draft.reason} onChange={(event) => updateTransferDraft(item.id, { reason: event.target.value })} placeholder={t.reason} disabled={disabled} /></TableCell> : null}
                      {allowCaseCreate ? <TableCell><Button type="button" size="sm" disabled={disabled} onClick={() => onRequestTransfer(item.id)}>{pending && processingCaseId === item.id ? (locale === "th" ? "กำลังส่ง..." : "Submitting...") : t.requestTransfer}</Button></TableCell> : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t.transferHistory}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.project}</TableHead>
                <TableHead>{t.from}</TableHead>
                <TableHead>{t.to}</TableHead>
                <TableHead>{t.reason}</TableHead>
                <TableHead>{t.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myTransfers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">{locale === "th" ? "ยังไม่มีประวัติการโอนงาน" : "No transfer history"}</TableCell></TableRow>
              ) : (
                myTransfers.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.projectName}</TableCell>
                    <TableCell>{item.fromSalesName}</TableCell>
                    <TableCell>{item.toSalesName}</TableCell>
                    <TableCell>{item.reason || "-"}</TableCell>
                    <TableCell><Badge variant={statusBadgeVariant(item.status)}>{localizeApprovalStatus(item.status, locale)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canReviewTransfers ? (
        <Card>
          <CardHeader><CardTitle>{t.reviewQueue}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.project}</TableHead>
                  <TableHead>{t.from}</TableHead>
                  <TableHead>{t.to}</TableHead>
                  <TableHead>{t.reason}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewQueue.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">{locale === "th" ? "ไม่มีคำขอรออนุมัติ" : "No pending requests"}</TableCell></TableRow>
                ) : (
                  reviewQueue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.projectName}</TableCell>
                      <TableCell>{item.fromSalesName}</TableCell>
                      <TableCell>{item.toSalesName}</TableCell>
                      <TableCell>{item.reason || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" disabled={pending} onClick={() => onReviewTransfer(item.id, "approved")}>{pending && processingTransferId === item.id ? (locale === "th" ? "กำลังบันทึก..." : "Saving...") : t.approve}</Button>
                          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onReviewTransfer(item.id, "rejected")}>{t.reject}</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}























function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}



















