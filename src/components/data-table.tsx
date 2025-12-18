"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconPlus,
  IconEye,
  IconPencil,
} from "@tabler/icons-react"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/* =========================
   Types (match your APIs)
========================= */

// GET /api/user
export type UserRow = {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string | null
  is_active: boolean
}

// GET /api/user/table (Trading Requests table)
export type TradingRequestRow = {
  id: number
  email: string
  first_name: string
  last_name: string
  UserBalance: { available_balance: string } | null
}

export type DataTablePayload = {
  users: UserRow[]
  requests: TradingRequestRow[]
}

// GET /api/user/detail/:id
type UserDetail = {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string | null
  is_active: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001"

/* =========================
   Helpers
========================= */

function fullName(first: string, last: string) {
  const name = `${first ?? ""} ${last ?? ""}`.trim()
  return name || "(No name)"
}

function toNumber(value: unknown) {
  const n = typeof value === "string" ? Number(value) : (value as number)
  return Number.isFinite(n) ? n : 0
}

function formatVNDCompact(value: string | number) {
  const num = typeof value === "string" ? Number(value) : value
  if (!Number.isFinite(num)) return "0 ₫"

  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2).replace(/\.00$/, "")}B ₫`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2).replace(/\.00$/, "")}M ₫`
  if (num >= 1_000) return `${(num / 1_000).toFixed(2).replace(/\.00$/, "")}K ₫`
  return `${num.toLocaleString("vi-VN")} ₫`
}

async function fetchUserDetail(id: number): Promise<UserDetail> {
  const res = await fetch(`${API_BASE}/api/user/detail/${id}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load user detail")
  const json = (await res.json()) as { success: boolean; data: UserDetail }
  return json.data
}

async function patchUser(id: number, payload: Partial<UserDetail>) {
  const res = await fetch(`${API_BASE}/api/user/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error("Update failed")
  return res.json()
}

/* =========================
   Drag handle
========================= */

function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({ id })
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

/* =========================
   Popup for View/Edit
========================= */

function UserDetailDialog({
  userId,
  mode,
  open,
  onOpenChange,
}: {
  userId: number
  mode: "view" | "edit"
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [detail, setDetail] = React.useState<UserDetail | null>(null)

  React.useEffect(() => {
    if (!open) return
    let mounted = true
    setLoading(true)
    fetchUserDetail(userId)
      .then((d) => {
        if (mounted) setDetail(d)
      })
      .catch((e: any) => {
        toast.error(e?.message ?? "Load detail failed")
        if (mounted) setDetail(null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [open, userId])

  async function onConfirm() {
    if (!detail) return
    setSaving(true)
    try {
      await patchUser(detail.id, {
        email: detail.email,
        first_name: detail.first_name,
        last_name: detail.last_name,
        phone: detail.phone,
        is_active: detail.is_active,
      })
      toast.success("Updated successfully")
      onOpenChange(false)
      router.refresh() // ✅ reload server data in page.tsx
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "View user"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Admin can update user information and confirm changes."
              : "Read-only user details."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-muted-foreground py-6 text-sm">Loading...</div>
        ) : !detail ? (
          <div className="text-muted-foreground py-6 text-sm">No data.</div>
        ) : (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`first_${detail.id}`}>First name</Label>
                <Input
                  id={`first_${detail.id}`}
                  value={detail.first_name ?? ""}
                  disabled={!isEdit}
                  onChange={(e) =>
                    setDetail((p) => (p ? { ...p, first_name: e.target.value } : p))
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`last_${detail.id}`}>Last name</Label>
                <Input
                  id={`last_${detail.id}`}
                  value={detail.last_name ?? ""}
                  disabled={!isEdit}
                  onChange={(e) =>
                    setDetail((p) => (p ? { ...p, last_name: e.target.value } : p))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`email_${detail.id}`}>Email</Label>
              <Input
                id={`email_${detail.id}`}
                value={detail.email ?? ""}
                disabled={!isEdit}
                onChange={(e) =>
                  setDetail((p) => (p ? { ...p, email: e.target.value } : p))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`phone_${detail.id}`}>Phone</Label>
                <Input
                  id={`phone_${detail.id}`}
                  value={detail.phone ?? ""}
                  disabled={!isEdit}
                  onChange={(e) =>
                    setDetail((p) => (p ? { ...p, phone: e.target.value } : p))
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={detail.is_active ? "active" : "inactive"}
                  disabled={!isEdit}
                  onValueChange={(v) =>
                    setDetail((p) => (p ? { ...p, is_active: v === "active" } : p))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>

          {isEdit ? (
            <Button onClick={onConfirm} disabled={saving || loading || !detail}>
              {saving ? "Saving..." : "Confirm"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UserRowActions({ userId }: { userId: number }) {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<"view" | "edit">("view")

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
            size="icon"
          >
            <IconDotsVertical />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="gap-2"
            onSelect={(e) => {
              e.preventDefault()
              setMode("view")
              setOpen(true)
            }}
          >
            <IconEye className="size-4" />
            View
          </DropdownMenuItem>

          <DropdownMenuItem
            className="gap-2"
            onSelect={(e) => {
              e.preventDefault()
              setMode("edit")
              setOpen(true)
            }}
          >
            <IconPencil className="size-4" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserDetailDialog
        userId={userId}
        mode={mode}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

/* =========================
   Users table columns (phone instead of balance)
========================= */

const userColumns: ColumnDef<UserRow>[] = [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{fullName(row.original.first_name, row.original.last_name)}</div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <div className="max-w-[320px] truncate">{row.original.email}</div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => (
      <div className="max-w-[220px] truncate">
        {row.original.phone ?? "-"}
      </div>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-muted-foreground px-1.5">
        {row.original.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <UserRowActions userId={row.original.id} />
      </div>
    ),
  },
]

/* =========================
   Trading Requests columns (ONLY name, email, balance)
========================= */

const requestColumns: ColumnDef<TradingRequestRow>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{fullName(row.original.first_name, row.original.last_name)}</div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <div className="max-w-[320px] truncate">{row.original.email}</div>
    ),
  },
  {
    id: "available_balance",
    header: () => <div className="w-full text-right">Balance</div>,
    cell: ({ row }) => {
      const raw = row.original.UserBalance?.available_balance ?? "0"
      return (
        <div className="w-full text-right font-medium">
          {formatVNDCompact(raw)}
        </div>
      )
    },
  },
]

/* =========================
   Reusable draggable row for Users table
========================= */

function DraggableRow({ row }: { row: Row<UserRow> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

/* =========================
   Main DataTable
========================= */

export function DataTable({ data: initial }: { data: DataTablePayload }) {
  const [users, setUsers] = React.useState<UserRow[]>(() => initial.users ?? [])
    const [requests, setRequests] = React.useState<TradingRequestRow[]>(
    () => initial.requests ?? []
  )

  React.useEffect(() => {
    setRequests(initial.requests ?? [])
  }, [initial.requests])


  // Users table state
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })
  const sortableId = React.useId()

  React.useEffect(() => {
    // when server data refreshes
    setUsers(initial.users ?? [])
  }, [initial.users])

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => users?.map(({ id }) => id) || [],
    [users]
  )

  const usersTable = useReactTable({
    data: users,
    columns: userColumns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })
   const requestsTable = useReactTable({
    data: requests,
    columns: requestColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setUsers((prev) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  return (
    <Tabs defaultValue="users" className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <TabsList className="hidden @4xl/main:flex">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="trading-requests">Trading Requests</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              {usersTable
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.message("Hook Add User here")}
          >
            <IconPlus />
            <span className="hidden lg:inline">Add User</span>
          </Button>
        </div>
      </div>

      {/* USERS */}
      <TabsContent
        value="users"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {usersTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {usersTable.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {usersTable.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell colSpan={userColumns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>

        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {usersTable.getFilteredSelectedRowModel().rows.length} of{" "}
            {usersTable.getFilteredRowModel().rows.length} row(s) selected.
          </div>

          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${usersTable.getState().pagination.pageSize}`}
                onValueChange={(value) => usersTable.setPageSize(Number(value))}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={usersTable.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {usersTable.getState().pagination.pageIndex + 1} of{" "}
              {usersTable.getPageCount()}
            </div>

            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => usersTable.setPageIndex(0)}
                disabled={!usersTable.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>

              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => usersTable.previousPage()}
                disabled={!usersTable.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>

              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => usersTable.nextPage()}
                disabled={!usersTable.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>

              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => usersTable.setPageIndex(usersTable.getPageCount() - 1)}
                disabled={!usersTable.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* TRADING REQUESTS */}
      {/* TRADING REQUESTS */}
      <TabsContent
        value="trading-requests"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {requestsTable.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {requestsTable.getRowModel().rows.length ? (
                requestsTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={requestColumns.length} className="h-24 text-center">
                    No requests.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Separator />

        <div className="text-muted-foreground text-sm">
          Trading Requests table shows only: <b>Name</b>, <b>Email</b>, <b>Balance</b>.
        </div>
      </TabsContent>

    </Tabs>
  )
}
