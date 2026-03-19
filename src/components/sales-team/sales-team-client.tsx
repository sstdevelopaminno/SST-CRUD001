"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ClipboardList, Coins, ListChecks, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createSalesCommissionCycleAction,
  createSalesProfileAction,
  getSalesCommissionCyclesPageAction,
  getSalesProfilesPageAction,
  updateSalesCommissionCycleStatusAction,
} from "@/app/actions/sales-team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { PaginatedResult, SalesCommissionCycleItem, SalesOption, SalesProfileItem } from "@/services/sales-team.service";

interface SalesTeamClientProps {
  initialProfilePage: PaginatedResult<SalesProfileItem>;
  initialCyclePage: PaginatedResult<SalesCommissionCycleItem>;
  profileOptions: SalesOption[];
  staffUsers: SalesOption[];
  managers: SalesOption[];
  locale: string;
}

const NONE_OPTION = "__none__";
const MODAL_ANIMATION_MS = 260;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type SalesTeamModalType = "add-sales" | "sales-list" | "commission" | "commission-list" | null;
type CycleStatusAction = "submitted" | "approved" | "rejected" | "paid";

function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function statusBadgeVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "approved" || normalized === "paid" || normalized === "active") return "success" as const;
  if (normalized === "submitted" || normalized === "draft" || normalized === "pending") return "warning" as const;
  return "outline" as const;
}

function cycleStatusLabel(status: string, locale: string) {
  const normalized = status.toLowerCase();

  if (locale === "th") {
    if (normalized === "draft") return "ฉบับร่าง";
    if (normalized === "submitted") return "ส่งพิจารณา";
    if (normalized === "approved") return "อนุมัติแล้ว";
    if (normalized === "rejected") return "ไม่อนุมัติ";
    if (normalized === "paid") return "จ่ายแล้ว";
  }

  if (normalized === "draft") return "Draft";
  if (normalized === "submitted") return "Submitted";
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "paid") return "Paid";
  return status;
}

export function SalesTeamClient({ initialProfilePage, initialCyclePage, profileOptions: initialProfileOptions, staffUsers, managers, locale }: SalesTeamClientProps) {
  const [pending, startTransition] = useTransition();

  const [profiles, setProfiles] = useState(initialProfilePage.items);
  const [profileOptions, setProfileOptions] = useState(initialProfileOptions);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const [cycles, setCycles] = useState(initialCyclePage.items);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [processingCycleId, setProcessingCycleId] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<SalesTeamModalType>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const modalCloseTimerRef = useRef<number | null>(null);

  const [profileSearch, setProfileSearch] = useState("");
  const [profilePage, setProfilePage] = useState(1);
  const [profilePageSize, setProfilePageSize] = useState(initialProfilePage.pageSize);
  const [profileCursor, setProfileCursor] = useState<string | null>(null);
  const [profileCursorHistory, setProfileCursorHistory] = useState<Array<string | null>>([]);
  const [profileHasNext, setProfileHasNext] = useState(initialProfilePage.hasNext);
  const [profileNextCursor, setProfileNextCursor] = useState<string | null>(initialProfilePage.nextCursor);

  const [cycleSearch, setCycleSearch] = useState("");
  const [cyclePage, setCyclePage] = useState(1);
  const [cyclePageSize, setCyclePageSize] = useState(initialCyclePage.pageSize);
  const [cycleCursor, setCycleCursor] = useState<string | null>(null);
  const [cycleCursorHistory, setCycleCursorHistory] = useState<Array<string | null>>([]);
  const [cycleHasNext, setCycleHasNext] = useState(initialCyclePage.hasNext);
  const [cycleNextCursor, setCycleNextCursor] = useState<string | null>(initialCyclePage.nextCursor);

  const labels =
    locale === "th"
      ? {
          title: "เพิ่มฝ่ายขายและจัดการประวัติ",
          description: "เก็บข้อมูลพนักงานขาย เอกสารบัตร และ workflow คอมมิชชั่นรายเดือน",
          profileTitle: "เพิ่มพนักงานฝ่ายขาย",
          profileDescription: "เพิ่มข้อมูลบุคคลและเอกสารบัตรประชาชน/รูปหน้าตรง",
          fullName: "ชื่อ-นามสกุล",
          employeeCode: "รหัสพนักงาน",
          phone: "เบอร์โทร",
          userAccount: "ผูกกับผู้ใช้ระบบ",
          manager: "หัวหน้าที่ดูแล",
          currentAddress: "ที่อยู่ปัจจุบัน",
          idCardAddress: "ที่อยู่ตามบัตร",
          idCardNumber: "เลขบัตรประชาชน",
          notes: "หมายเหตุ",
          startDate: "วันที่เริ่มงาน",
          status: "สถานะ",
          portrait: "รูปหน้าตรง",
          idCardFront: "บัตรประชาชนด้านหน้า",
          idCardBack: "บัตรประชาชนด้านหลัง",
          addSales: "บันทึกพนักงานฝ่ายขาย",
          profileListTitle: "รายชื่อฝ่ายขาย",
          profileListDescription: "ดูข้อมูลติดต่อและจำนวนเอกสารที่อัปโหลด",
          cycleTitle: "Workflow ค่าคอมมิชชั่นรายเดือน",
          cycleDescription: "สร้างรอบเดือน ส่งอนุมัติ อนุมัติ/ไม่อนุมัติ และปิดสถานะจ่ายเงิน",
          cycleProfile: "ฝ่ายขาย",
          cycleLabel: "ชื่อรอบ",
          periodStart: "เริ่มรอบ",
          periodEnd: "สิ้นสุดรอบ",
          commissionAmount: "จำนวนเงินคอม",
          actions: "การทำงาน",
          submit: "ส่งพิจารณา",
          approve: "อนุมัติ",
          reject: "ไม่อนุมัติ",
          paid: "ทำเครื่องหมายจ่ายแล้ว",
          documents: "เอกสาร",
          createCycle: "สร้างรอบรายเดือน",
          grossSales: "ยอดขายรวม",
          approvedSales: "ยอดขายที่อนุมัติ",
          avgRate: "% คอมเฉลี่ย",
          payoutStart: "เริ่มจ่าย",
          payoutEnd: "สิ้นสุดจ่าย",
          noProfileData: "ยังไม่มีข้อมูลฝ่ายขาย",
          noCycleData: "ยังไม่มีรอบรายเดือน",
          openAddSales: "เพิ่มพนักงานฝ่ายขาย",
          openSalesList: "รายชื่อฝ่ายขาย",
          openCommission: "ค่าคอม",
          openCommissionList: "รายการ",
          openSectionHint: "กดปุ่มเมนูด้านบนเพื่อเปิดฟอร์มแบบป๊อปอัพ",
          close: "ปิด",
          processing: "กำลังประมวลผล...",
          subMenu: "เมนูย่อย",
          searchProfiles: "ค้นหารายชื่อฝ่ายขาย",
          searchCycles: "ค้นหารอบคอมมิชชั่น",
          rowsPerPage: "แถว/หน้า",
          page: "หน้า",
          prev: "ก่อนหน้า",
          next: "ถัดไป",
          results: "รายการ",
        }
      : {
          title: "Sales Team Onboarding",
          description: "Manage sales employee profile, ID documents, and monthly commission workflow.",
          profileTitle: "Add Sales Employee",
          profileDescription: "Store identity profile and required ID documents.",
          fullName: "Full Name",
          employeeCode: "Employee Code",
          phone: "Phone",
          userAccount: "Linked User Account",
          manager: "Manager",
          currentAddress: "Current Address",
          idCardAddress: "ID Card Address",
          idCardNumber: "ID Card Number",
          notes: "Notes",
          startDate: "Start Date",
          status: "Status",
          portrait: "Portrait",
          idCardFront: "ID Card Front",
          idCardBack: "ID Card Back",
          addSales: "Save Sales Employee",
          profileListTitle: "Sales Team List",
          profileListDescription: "Review contact profile and uploaded document count.",
          cycleTitle: "Monthly Commission Workflow",
          cycleDescription: "Create monthly cycle, submit, approve/reject, and mark paid.",
          cycleProfile: "Sales Profile",
          cycleLabel: "Cycle Label",
          periodStart: "Period Start",
          periodEnd: "Period End",
          commissionAmount: "Commission Amount",
          actions: "Actions",
          submit: "Submit",
          approve: "Approve",
          reject: "Reject",
          paid: "Mark Paid",
          documents: "Documents",
          createCycle: "Create Cycle",
          grossSales: "Gross Sales",
          approvedSales: "Approved Sales",
          avgRate: "Avg Commission %",
          payoutStart: "Payout Start",
          payoutEnd: "Payout End",
          noProfileData: "No sales profile data",
          noCycleData: "No monthly cycle",
          openAddSales: "Add Sales Employee",
          openSalesList: "Sales Team List",
          openCommission: "Commission",
          openCommissionList: "Records",
          openSectionHint: "Use top buttons to open each popup form.",
          close: "Close",
          processing: "Processing...",
          subMenu: "Sub Menu",
          searchProfiles: "Search sales team",
          searchCycles: "Search commission cycles",
          rowsPerPage: "Rows/page",
          page: "Page",
          prev: "Prev",
          next: "Next",
          results: "results",
        };

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    employeeCode: "",
    phone: "",
    userId: NONE_OPTION,
    managerId: NONE_OPTION,
    currentAddress: "",
    idCardAddress: "",
    idCardNumber: "",
    notes: "",
    startDate: "",
    status: "active",
  });

  const [profileFiles, setProfileFiles] = useState<{ portrait: File | null; idFront: File | null; idBack: File | null }>({
    portrait: null,
    idFront: null,
    idBack: null,
  });

  const [cycleForm, setCycleForm] = useState({
    profileId: profiles[0]?.id ?? NONE_OPTION,
    cycleLabel: "",
    periodStart: "",
    periodEnd: "",
    payoutStart: "",
    payoutEnd: "",
    grossSales: "0",
    approvedSales: "0",
    avgRate: "0",
    commissionAmount: "0",
    notes: "",
  });

  const debouncedProfileSearch = useDebouncedValue(profileSearch, 320);
  const debouncedCycleSearch = useDebouncedValue(cycleSearch, 320);

  const pagedProfiles = useMemo(
    () => ({
      items: profiles,
      currentPage: profilePage,
      hasNext: profileHasNext,
    }),
    [profiles, profilePage, profileHasNext],
  );

  const pagedCycles = useMemo(
    () => ({
      items: cycles,
      currentPage: cyclePage,
      hasNext: cycleHasNext,
    }),
    [cycles, cyclePage, cycleHasNext],
  );

  useEffect(() => {
    setProfilePage(1);
    setProfileCursor(null);
    setProfileCursorHistory([]);
    setProfileHasNext(false);
    setProfileNextCursor(null);
  }, [profileSearch, profilePageSize]);

  useEffect(() => {
    setCyclePage(1);
    setCycleCursor(null);
    setCycleCursorHistory([]);
    setCycleHasNext(false);
    setCycleNextCursor(null);
  }, [cycleSearch, cyclePageSize]);

  useEffect(() => {
    let active = true;

    const loadProfiles = async () => {
      setProfilesLoading(true);
      const result = await getSalesProfilesPageAction({
        page_size: profilePageSize,
        search: debouncedProfileSearch || null,
        cursor: profileCursor,
      });

      if (!active) {
        return;
      }

      if (!result.ok || !result.data) {
        toast.error(result.message ?? (locale === "th" ? "โหลดรายชื่อฝ่ายขายไม่สำเร็จ" : "Unable to load sales profiles"));
        setProfilesLoading(false);
        return;
      }

      setProfiles(result.data.items);
      setProfileHasNext(result.data.hasNext);
      setProfileNextCursor(result.data.nextCursor);
      setProfilesLoading(false);
    };

    void loadProfiles();

    return () => {
      active = false;
    };
  }, [profileCursor, profilePageSize, debouncedProfileSearch, locale]);

  useEffect(() => {
    let active = true;

    const loadCycles = async () => {
      setCyclesLoading(true);
      const result = await getSalesCommissionCyclesPageAction({
        page_size: cyclePageSize,
        search: debouncedCycleSearch || null,
        cursor: cycleCursor,
      });

      if (!active) {
        return;
      }

      if (!result.ok || !result.data) {
        toast.error(result.message ?? (locale === "th" ? "โหลดรายการค่าคอมไม่สำเร็จ" : "Unable to load commission cycles"));
        setCyclesLoading(false);
        return;
      }

      setCycles(result.data.items);
      setCycleHasNext(result.data.hasNext);
      setCycleNextCursor(result.data.nextCursor);
      setCyclesLoading(false);
    };

    void loadCycles();

    return () => {
      active = false;
    };
  }, [cycleCursor, cyclePageSize, debouncedCycleSearch, locale]);

  useEffect(() => {
    return () => {
      if (modalCloseTimerRef.current) clearTimeout(modalCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeModal) closeModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeModal]);

  function openModal(modal: Exclude<SalesTeamModalType, null>) {
    if (activeModal === modal && modalOpen) {
      closeModal();
      return;
    }

    if (modalCloseTimerRef.current) clearTimeout(modalCloseTimerRef.current);
    setActiveModal(modal);
    requestAnimationFrame(() => setModalOpen(true));
  }

  function closeModal() {
    setModalOpen(false);
    modalCloseTimerRef.current = window.setTimeout(() => setActiveModal(null), MODAL_ANIMATION_MS);
  }

  function onCreateProfile() {
    if (!profileForm.fullName.trim()) {
      toast.error(locale === "th" ? "กรุณากรอกชื่อพนักงาน" : "Please enter full name");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("full_name", profileForm.fullName.trim());
      formData.set("employee_code", profileForm.employeeCode);
      formData.set("phone", profileForm.phone);
      formData.set("user_id", profileForm.userId === NONE_OPTION ? "" : profileForm.userId);
      formData.set("manager_user_id", profileForm.managerId === NONE_OPTION ? "" : profileForm.managerId);
      formData.set("current_address", profileForm.currentAddress);
      formData.set("id_card_address", profileForm.idCardAddress);
      formData.set("id_card_number", profileForm.idCardNumber);
      formData.set("notes", profileForm.notes);
      formData.set("start_date", profileForm.startDate);
      formData.set("status", profileForm.status);

      if (profileFiles.portrait) formData.set("portrait", profileFiles.portrait);
      if (profileFiles.idFront) formData.set("id_card_front", profileFiles.idFront);
      if (profileFiles.idBack) formData.set("id_card_back", profileFiles.idBack);

      const result = await createSalesProfileAction(formData);

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "บันทึกพนักงานไม่สำเร็จ" : "Unable to save sales profile"));
        return;
      }

      const nowIso = new Date().toISOString();
      const userName = profileForm.userId !== NONE_OPTION ? staffUsers.find((item) => item.id === profileForm.userId)?.name ?? "-" : "-";
      const managerName = profileForm.managerId !== NONE_OPTION ? managers.find((item) => item.id === profileForm.managerId)?.name ?? "-" : "-";
      const profileDocuments: SalesProfileItem["documents"] = [];

      if (profileFiles.portrait) {
        profileDocuments.push({
          id: `${result.profile_id}-portrait`,
          type: "portrait",
          filePath: profileFiles.portrait.name,
          fileName: profileFiles.portrait.name,
          mimeType: profileFiles.portrait.type || "application/octet-stream",
          createdAt: nowIso,
        });
      }

      if (profileFiles.idFront) {
        profileDocuments.push({
          id: `${result.profile_id}-id-front`,
          type: "id_card_front",
          filePath: profileFiles.idFront.name,
          fileName: profileFiles.idFront.name,
          mimeType: profileFiles.idFront.type || "application/octet-stream",
          createdAt: nowIso,
        });
      }

      if (profileFiles.idBack) {
        profileDocuments.push({
          id: `${result.profile_id}-id-back`,
          type: "id_card_back",
          filePath: profileFiles.idBack.name,
          fileName: profileFiles.idBack.name,
          mimeType: profileFiles.idBack.type || "application/octet-stream",
          createdAt: nowIso,
        });
      }

      setProfiles((current) => [
        {
          id: result.profile_id,
          userId: profileForm.userId === NONE_OPTION ? null : profileForm.userId,
          userName,
          employeeCode: profileForm.employeeCode || "-",
          fullName: profileForm.fullName.trim(),
          phone: profileForm.phone || "-",
          currentAddress: profileForm.currentAddress || "-",
          idCardAddress: profileForm.idCardAddress || "-",
          idCardNumber: profileForm.idCardNumber || "-",
          status: profileForm.status,
          startDate: profileForm.startDate || null,
          endDate: null,
          managerUserId: profileForm.managerId === NONE_OPTION ? null : profileForm.managerId,
          managerName,
          notes: profileForm.notes,
          createdBy: null,
          createdByName: "-",
          createdAt: nowIso,
          updatedAt: nowIso,
          documents: profileDocuments,
        },
        ...current,
      ]);
      setProfileOptions((current) => [{ id: result.profile_id, name: profileForm.fullName.trim() }, ...current]);

      setProfileForm({
        fullName: "",
        employeeCode: "",
        phone: "",
        userId: NONE_OPTION,
        managerId: NONE_OPTION,
        currentAddress: "",
        idCardAddress: "",
        idCardNumber: "",
        notes: "",
        startDate: "",
        status: "active",
      });
      setProfileFiles({ portrait: null, idFront: null, idBack: null });
      toast.success(locale === "th" ? "บันทึกพนักงานฝ่ายขายสำเร็จ" : "Sales profile saved");
    });
  }

  function onCreateCycle() {
    if (!cycleForm.profileId || cycleForm.profileId === NONE_OPTION) {
      toast.error(locale === "th" ? "กรุณาเลือกฝ่ายขาย" : "Please select sales profile");
      return;
    }

    startTransition(async () => {
      const result = await createSalesCommissionCycleAction({
        sales_profile_id: cycleForm.profileId,
        cycle_label: cycleForm.cycleLabel || null,
        period_start: cycleForm.periodStart,
        period_end: cycleForm.periodEnd,
        payout_window_start: cycleForm.payoutStart,
        payout_window_end: cycleForm.payoutEnd,
        gross_sales: Number(cycleForm.grossSales || 0),
        approved_sales: Number(cycleForm.approvedSales || 0),
        commission_rate_avg: Number(cycleForm.avgRate || 0),
        commission_amount: Number(cycleForm.commissionAmount || 0),
        notes: cycleForm.notes || null,
      });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "สร้างรอบไม่สำเร็จ" : "Unable to create cycle"));
        return;
      }

      const nowIso = new Date().toISOString();
      const profileName = profileOptions.find((profile) => profile.id === cycleForm.profileId)?.name ?? cycleForm.profileId;

      setCycles((current) => [
        {
          id: result.cycle_id,
          profileId: cycleForm.profileId,
          profileName,
          cycleLabel: cycleForm.cycleLabel || `${cycleForm.periodStart} - ${cycleForm.periodEnd}`,
          periodStart: cycleForm.periodStart,
          periodEnd: cycleForm.periodEnd,
          payoutWindowStart: cycleForm.payoutStart,
          payoutWindowEnd: cycleForm.payoutEnd,
          grossSales: Number(cycleForm.grossSales || 0),
          approvedSales: Number(cycleForm.approvedSales || 0),
          commissionRateAvg: Number(cycleForm.avgRate || 0),
          commissionAmount: Number(cycleForm.commissionAmount || 0),
          status: "draft",
          submittedBy: null,
          submittedByName: "-",
          approvedBy: null,
          approvedByName: "-",
          approvedAt: null,
          paidAt: null,
          notes: cycleForm.notes,
          createdAt: nowIso,
        },
        ...current,
      ]);

      setCycleForm((current) => ({
        ...current,
        cycleLabel: "",
        periodStart: "",
        periodEnd: "",
        payoutStart: "",
        payoutEnd: "",
        grossSales: "0",
        approvedSales: "0",
        avgRate: "0",
        commissionAmount: "0",
        notes: "",
      }));
      toast.success(locale === "th" ? "สร้างรอบรายเดือนสำเร็จ" : "Monthly cycle created");
    });
  }

  function onUpdateCycleStatus(cycleId: string, status: CycleStatusAction) {
    setProcessingCycleId(cycleId);

    startTransition(async () => {
      const result = await updateSalesCommissionCycleStatusAction({ cycle_id: cycleId, status });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "อัปเดตสถานะไม่สำเร็จ" : "Unable to update cycle status"));
        setProcessingCycleId(null);
        return;
      }

      const nowIso = new Date().toISOString();

      setCycles((current) =>
        current.map((cycle) => {
          if (cycle.id !== cycleId) {
            return cycle;
          }

          return {
            ...cycle,
            status,
            approvedAt: status === "approved" || status === "rejected" ? nowIso : cycle.approvedAt,
            paidAt: status === "paid" ? nowIso : cycle.paidAt,
          };
        }),
      );
      toast.success(locale === "th" ? "อัปเดตสถานะเรียบร้อย" : "Status updated");
      setProcessingCycleId(null);
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
          <span>{labels.rowsPerPage}</span>
          <select
            value={props.pageSize}
            onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>{labels.page} {props.page}</span>
          <span>({props.itemsCount} {labels.results})</span>
          {props.loading ? <span className="text-xs">{labels.processing}</span> : null}
          <Button type="button" variant="outline" size="sm" onClick={props.onPrev} disabled={Boolean(props.loading) || !props.canPrev}>{labels.prev}</Button>
          <Button type="button" variant="outline" size="sm" onClick={props.onNext} disabled={Boolean(props.loading) || !props.hasNext}>{labels.next}</Button>
        </div>
      </div>
    );
  }


  function renderAddSalesContent() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.profileTitle}</h3>
          <p className="text-sm text-muted-foreground">{labels.profileDescription}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Input placeholder={labels.fullName} value={profileForm.fullName} onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))} />
          <Input placeholder={labels.employeeCode} value={profileForm.employeeCode} onChange={(event) => setProfileForm((current) => ({ ...current, employeeCode: event.target.value }))} />
          <Input placeholder={labels.phone} value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />

          <Select value={profileForm.userId} onValueChange={(value) => setProfileForm((current) => ({ ...current, userId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder={labels.userAccount} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_OPTION}>-</SelectItem>
              {staffUsers.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={profileForm.managerId} onValueChange={(value) => setProfileForm((current) => ({ ...current, managerId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder={labels.manager} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_OPTION}>-</SelectItem>
              {managers.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" placeholder={labels.startDate} value={profileForm.startDate} onChange={(event) => setProfileForm((current) => ({ ...current, startDate: event.target.value }))} />
          <Textarea className="md:col-span-3 min-h-[56px]" placeholder={labels.currentAddress} value={profileForm.currentAddress} onChange={(event) => setProfileForm((current) => ({ ...current, currentAddress: event.target.value }))} />
          <Textarea className="md:col-span-3 min-h-[56px]" placeholder={labels.idCardAddress} value={profileForm.idCardAddress} onChange={(event) => setProfileForm((current) => ({ ...current, idCardAddress: event.target.value }))} />

          <Input placeholder={labels.idCardNumber} value={profileForm.idCardNumber} onChange={(event) => setProfileForm((current) => ({ ...current, idCardNumber: event.target.value }))} />
          <Select value={profileForm.status} onValueChange={(value) => setProfileForm((current) => ({ ...current, status: value }))}>
            <SelectTrigger>
              <SelectValue placeholder={labels.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">active</SelectItem>
              <SelectItem value="inactive">inactive</SelectItem>
              <SelectItem value="suspended">suspended</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder={labels.notes} value={profileForm.notes} onChange={(event) => setProfileForm((current) => ({ ...current, notes: event.target.value }))} />

          <div>
            <p className="mb-1 text-sm">{labels.portrait}</p>
            <Input type="file" accept="image/*" onChange={(event) => setProfileFiles((current) => ({ ...current, portrait: event.target.files?.[0] ?? null }))} />
          </div>
          <div>
            <p className="mb-1 text-sm">{labels.idCardFront}</p>
            <Input type="file" accept="image/*" onChange={(event) => setProfileFiles((current) => ({ ...current, idFront: event.target.files?.[0] ?? null }))} />
          </div>
          <div>
            <p className="mb-1 text-sm">{labels.idCardBack}</p>
            <Input type="file" accept="image/*" onChange={(event) => setProfileFiles((current) => ({ ...current, idBack: event.target.files?.[0] ?? null }))} />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <Button type="button" disabled={pending} onClick={onCreateProfile}>
              {labels.addSales}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderSalesListContent() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.profileListTitle}</h3>
          <p className="text-sm text-muted-foreground">{labels.profileListDescription}</p>
        </div>

        {renderTableToolbar({
          searchValue: profileSearch,
          onSearchChange: setProfileSearch,
          searchPlaceholder: labels.searchProfiles,
          pageSize: profilePageSize,
          onPageSizeChange: setProfilePageSize,
          page: pagedProfiles.currentPage,
          itemsCount: pagedProfiles.items.length,
          canPrev: profileCursorHistory.length > 0,
          hasNext: pagedProfiles.hasNext,
          loading: profilesLoading,
          onPrev: () => {
            if (profileCursorHistory.length === 0) {
              return;
            }

            setProfileCursorHistory((current) => {
              const next = [...current];
              const previousCursor = next.pop() ?? null;
              setProfileCursor(previousCursor);
              return next;
            });
            setProfilePage((current) => Math.max(1, current - 1));
          },
          onNext: () => {
            if (!profileHasNext || !profileNextCursor) {
              return;
            }

            setProfileCursorHistory((current) => [...current, profileCursor]);
            setProfileCursor(profileNextCursor);
            setProfilePage((current) => current + 1);
          },
        })}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.fullName}</TableHead>
              <TableHead>{labels.employeeCode}</TableHead>
              <TableHead>{labels.phone}</TableHead>
              <TableHead>{labels.userAccount}</TableHead>
              <TableHead>{labels.manager}</TableHead>
              <TableHead>{labels.documents}</TableHead>
              <TableHead>{labels.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedProfiles.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  {labels.noProfileData}
                </TableCell>
              </TableRow>
            ) : (
              pagedProfiles.items.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>{profile.fullName}</TableCell>
                  <TableCell>{profile.employeeCode}</TableCell>
                  <TableCell>{profile.phone}</TableCell>
                  <TableCell>{profile.userName}</TableCell>
                  <TableCell>{profile.managerName}</TableCell>
                  <TableCell>{profile.documents.length}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(profile.status)}>{profile.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  function renderCommissionContent() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.cycleTitle}</h3>
          <p className="text-sm text-muted-foreground">{labels.cycleDescription}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Select value={cycleForm.profileId} onValueChange={(value) => setCycleForm((current) => ({ ...current, profileId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder={labels.cycleProfile} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_OPTION}>-</SelectItem>
              {profileOptions.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input placeholder={labels.cycleLabel} value={cycleForm.cycleLabel} onChange={(event) => setCycleForm((current) => ({ ...current, cycleLabel: event.target.value }))} />
          <Input type="date" value={cycleForm.periodStart} onChange={(event) => setCycleForm((current) => ({ ...current, periodStart: event.target.value }))} />
          <Input type="date" value={cycleForm.periodEnd} onChange={(event) => setCycleForm((current) => ({ ...current, periodEnd: event.target.value }))} />
          <Input type="date" value={cycleForm.payoutStart} onChange={(event) => setCycleForm((current) => ({ ...current, payoutStart: event.target.value }))} />
          <Input type="date" value={cycleForm.payoutEnd} onChange={(event) => setCycleForm((current) => ({ ...current, payoutEnd: event.target.value }))} />
          <Input type="number" min={0} step="0.01" placeholder={labels.grossSales} value={cycleForm.grossSales} onChange={(event) => setCycleForm((current) => ({ ...current, grossSales: event.target.value }))} />
          <Input type="number" min={0} step="0.01" placeholder={labels.approvedSales} value={cycleForm.approvedSales} onChange={(event) => setCycleForm((current) => ({ ...current, approvedSales: event.target.value }))} />
          <Input type="number" min={0} max={100} step="0.01" placeholder={labels.avgRate} value={cycleForm.avgRate} onChange={(event) => setCycleForm((current) => ({ ...current, avgRate: event.target.value }))} />
          <Input type="number" min={0} step="0.01" placeholder={labels.commissionAmount} value={cycleForm.commissionAmount} onChange={(event) => setCycleForm((current) => ({ ...current, commissionAmount: event.target.value }))} />
          <Textarea className="md:col-span-2 min-h-[40px]" placeholder={labels.notes} value={cycleForm.notes} onChange={(event) => setCycleForm((current) => ({ ...current, notes: event.target.value }))} />

          <div className="md:col-span-4 flex justify-end">
            <Button type="button" disabled={pending} onClick={onCreateCycle}>
              {labels.createCycle}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderCommissionListContent() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.openCommissionList}</h3>
          <p className="text-sm text-muted-foreground">{labels.cycleDescription}</p>
        </div>

        {renderTableToolbar({
          searchValue: cycleSearch,
          onSearchChange: setCycleSearch,
          searchPlaceholder: labels.searchCycles,
          pageSize: cyclePageSize,
          onPageSizeChange: setCyclePageSize,
          page: pagedCycles.currentPage,
          itemsCount: pagedCycles.items.length,
          canPrev: cycleCursorHistory.length > 0,
          hasNext: pagedCycles.hasNext,
          loading: cyclesLoading,
          onPrev: () => {
            if (cycleCursorHistory.length === 0) {
              return;
            }

            setCycleCursorHistory((current) => {
              const next = [...current];
              const previousCursor = next.pop() ?? null;
              setCycleCursor(previousCursor);
              return next;
            });
            setCyclePage((current) => Math.max(1, current - 1));
          },
          onNext: () => {
            if (!cycleHasNext || !cycleNextCursor) {
              return;
            }

            setCycleCursorHistory((current) => [...current, cycleCursor]);
            setCycleCursor(cycleNextCursor);
            setCyclePage((current) => current + 1);
          },
        })}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.cycleProfile}</TableHead>
              <TableHead>{labels.cycleLabel}</TableHead>
              <TableHead>{labels.periodStart}</TableHead>
              <TableHead>{labels.periodEnd}</TableHead>
              <TableHead>{labels.commissionAmount}</TableHead>
              <TableHead>{labels.status}</TableHead>
              <TableHead>{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedCycles.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  {labels.noCycleData}
                </TableCell>
              </TableRow>
            ) : (
              pagedCycles.items.map((cycle) => (
                <TableRow key={cycle.id}>
                  <TableCell>{cycle.profileName}</TableCell>
                  <TableCell>{cycle.cycleLabel || "-"}</TableCell>
                  <TableCell>{cycle.periodStart}</TableCell>
                  <TableCell>{cycle.periodEnd}</TableCell>
                  <TableCell>{cycle.commissionAmount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(cycle.status)}>{cycleStatusLabel(cycle.status, locale)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => onUpdateCycleStatus(cycle.id, "submitted")}>
                        {processingCycleId === cycle.id && pending ? labels.processing : labels.submit}
                      </Button>
                      <Button size="sm" disabled={pending} onClick={() => onUpdateCycleStatus(cycle.id, "approved")}>
                        {labels.approve}
                      </Button>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => onUpdateCycleStatus(cycle.id, "rejected")}>
                        {labels.reject}
                      </Button>
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => onUpdateCycleStatus(cycle.id, "paid")}>
                        {labels.paid}
                      </Button>
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

  if (activeModal === "add-sales") {
    modalMeta = {
      title: labels.openAddSales,
      widthClass: "max-w-6xl",
      panelClass: "min-h-[82vh]",
      contentMaxHeightClass: "max-h-[72vh]",
      icon: <UserPlus className="h-5 w-5" />,
      content: renderAddSalesContent(),
    };
  } else if (activeModal === "sales-list") {
    modalMeta = {
      title: labels.openSalesList,
      widthClass: "max-w-7xl",
      panelClass: "min-h-[70vh]",
      contentMaxHeightClass: "max-h-[66vh]",
      icon: <ListChecks className="h-5 w-5" />,
      content: renderSalesListContent(),
    };
  } else if (activeModal === "commission") {
    modalMeta = {
      title: labels.openCommission,
      widthClass: "max-w-5xl",
      panelClass: "min-h-[66vh]",
      contentMaxHeightClass: "max-h-[62vh]",
      icon: <Coins className="h-5 w-5" />,
      content: renderCommissionContent(),
    };
  } else if (activeModal === "commission-list") {
    modalMeta = {
      title: labels.openCommissionList,
      widthClass: "max-w-7xl",
      panelClass: "min-h-[74vh]",
      contentMaxHeightClass: "max-h-[68vh]",
      icon: <ClipboardList className="h-5 w-5" />,
      content: renderCommissionListContent(),
    };
  }

  function renderActionButton(icon: ReactNode, label: string, modalType: Exclude<SalesTeamModalType, null>) {
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
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {renderActionButton(<UserPlus className="h-4 w-4" />, labels.openAddSales, "add-sales")}
            {renderActionButton(<ListChecks className="h-4 w-4" />, labels.openSalesList, "sales-list")}
            {renderActionButton(<Coins className="h-4 w-4" />, labels.openCommission, "commission")}
            {renderActionButton(<ClipboardList className="h-4 w-4" />, labels.openCommissionList, "commission-list")}
          </div>
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
                <span className="sr-only">{labels.close}</span>
              </Button>
            </div>

            <div className={`mt-4 ${modalMeta.contentMaxHeightClass} overflow-y-auto px-1 pt-1 pb-1`}>{modalMeta.content}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


























