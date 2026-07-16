  "use client";

  import { useState, useMemo } from "react";
  import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    flexRender,
    ColumnDef,
    SortingState
  } from "@tanstack/react-table";
  import { Button } from "@/components/ui/button";
  import { Badge } from "@/components/ui/badge";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
  } from "@/components/ui/table";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
  } from "@/components/ui/select";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
  } from "@/components/ui/dropdown-menu";
  import { Progress } from "@/components/ui/progress";
  import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Filter,
    MoreHorizontal,
    Plus,
    Search
  } from "lucide-react";
  import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
  import type { RealEstateProperty } from "../../types";

  interface PropertyTableProps {
    items: RealEstateProperty[];
  }

  const getStatusVariant = (
    status: string
  ): NonNullable<React.ComponentProps<typeof Badge>["variant"]> => {
    switch (status) {
      case "On rent":
        return "success";
      case "On sell":
        return "info";
      case "Renovation":
        return "warning";
      case "On Construction":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getProgressColor = (value: number): string => {
    if (value >= 70) return "bg-green-500";
    if (value >= 40) return "bg-amber-500";
    return "bg-rose-500";
  };

  export function PropertyTable({ items }: PropertyTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const filteredData = useMemo(() => {
      if (statusFilter === "all") return items;
      return items.filter((item) => item.status === statusFilter);
    }, [items, statusFilter]);

    const columns: ColumnDef<RealEstateProperty>[] = [
      {
        accessorKey: "name",
        header: "Property name",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <img
              src={row.original.thumbnailImage}
              alt={row.original.name}
              className="aspect-video max-w-30 rounded-md object-cover"
            />
            <span className="font-medium">{row.original.name}</span>
          </div>
        )
      },
      {
        accessorKey: "listingCode",
        header: "ID",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.listingCode}</span>
        )
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Status
            <ChevronDown className="h-4 w-4" />
          </button>
        ),
        cell: ({ row }) => {
          const statusLabel = row.original.status?.trim() || "Unknown";

          return <Badge variant={getStatusVariant(statusLabel)}>{statusLabel}</Badge>;
        }
      },
      {
        accessorKey: "priceMin",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Price
            <ChevronDown className="h-4 w-4" />
          </button>
        ),
        cell: ({ row }) => (
          <span>
            ${row.original.priceMin.toLocaleString()} - ${row.original.priceMax.toLocaleString()}
          </span>
        )
      },
      {
        accessorKey: "sqft",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Sqft
            <ChevronDown className="h-4 w-4" />
          </button>
        ),
        cell: ({ row }) => <span>{row.original.sqft.toLocaleString()}</span>
      },
      {
        accessorKey: "complain",
        header: "Complain",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Progress
              value={row.original.complain}
              className="w-20 bg-muted"
              indicatorColor={getProgressColor(row.original.complain)}
            />
            <span className="text-muted-foreground text-xs">{row.original.complain}%</span>
          </div>
        )
      },
      {
        id: "actions",
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View details</DropdownMenuItem>
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    ];

    const table = useReactTable({
      data: filteredData,
      columns,
      state: {
        sorting,
        globalFilter
      },
      onSortingChange: setSorting,
      onGlobalFilterChange: setGlobalFilter,
      getCoreRowModel: getCoreRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getSortedRowModel: getSortedRowModel(),
      initialState: {
        pagination: {
          pageSize: 10
        }
      }
    });

    const totalRows = table.getFilteredRowModel().rows.length;
    const currentPage = table.getState().pagination.pageIndex;
    const pageSize = table.getState().pagination.pageSize;
    const startRow = currentPage * pageSize + 1;
    const endRow = Math.min((currentPage + 1) * pageSize, totalRows);

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 sm:items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-w-36">
                <SelectValue className="truncate" placeholder="All properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                <SelectItem value="On rent">On rent</SelectItem>
                <SelectItem value="On sell">On sell</SelectItem>
                <SelectItem value="Renovation">Renovation</SelectItem>
                <SelectItem value="On Construction">On Construction</SelectItem>
              </SelectContent>
            </Select>
            <InputGroup>
              <InputGroupInput
                placeholder="Search ID, property"
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <Button variant="outline" size="icon">
              <Filter />
            </Button>
          </div>
          <Button>
            <Plus />
            Add New Property
          </Button>
        </div>

        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span>
              Results: {startRow} - {endRow} of {totalRows}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}>
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(table.getPageCount(), 5) }, (_, i) => (
              <Button
                key={i}
                variant={currentPage === i ? "default" : "outline"}
                size="icon"
                onClick={() => table.setPageIndex(i)}>
                {i + 1}
              </Button>
            ))}
            {table.getPageCount() > 5 && (
              <>
                <span className="text-muted-foreground px-2">...</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}>
                  {table.getPageCount()}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
