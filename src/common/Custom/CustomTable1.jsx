import React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ColumnsIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import PropTypes from "prop-types";

export default function CustomTable1({
  data: initialData,
  fields,
  filter = false,
  selection = false,
  loading = false,
  pageSize = 10,
  message = "No Data",
  emptyHint = "Try adjusting your filters",
  initialPageIndex = 0,
  onPageChange,
  onPageSizeChange,
  rowClassName,
  cellClassName,
}) {
  // const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState([]);
  const [sorting, setSorting] = React.useState([]);
  const isPaginationControlled = typeof onPageChange === "function";
  const [uncontrolledPagination, setUncontrolledPagination] = React.useState({
    pageIndex: initialPageIndex,
    pageSize,
  });

  const pagination = React.useMemo(
    () =>
      isPaginationControlled
        ? { pageIndex: initialPageIndex, pageSize }
        : uncontrolledPagination,
    [
      isPaginationControlled,
      initialPageIndex,
      pageSize,
      uncontrolledPagination,
    ]
  );

  const handlePaginationChange = React.useCallback(
    (updater) => {
      if (isPaginationControlled) {
        const next =
          typeof updater === "function" ? updater(pagination) : updater;

        if (next.pageIndex !== pagination.pageIndex) {
          onPageChange(next.pageIndex + 1);
        }
        if (
          typeof onPageSizeChange === "function" &&
          next.pageSize !== pagination.pageSize
        ) {
          onPageSizeChange(next.pageSize);
        }
        return;
      }

      setUncontrolledPagination((prev) =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    [isPaginationControlled, pagination, onPageChange, onPageSizeChange]
  );

  const columns = React.useMemo(
    () =>
      fields?.map((field, index) => ({
        id: field.value || `custom_${index}`,
        accessorKey: field?.value,
        className: field?.className || "text-left",
        header: field?.title,
        cell: ({ row }) => {
          const item = row.original;
          const index = row.index;

          if (field?.custom && typeof field.component === "function") {
            return field.component(item, index);
          }

          return <div>{item?.[field.value]}</div>;
        },
      })) || [],
    [fields]
  );

  const table = useReactTable({
    data: initialData,
    columns,
    autoResetPageIndex: !isPaginationControlled,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: handlePaginationChange,
    state: {
      rowSelection,
      columnVisibility,
      columnFilters,
      sorting,
      pagination,
    },
  });

  return (
    <div className="p-0">
      {filter && (
        <div className="flex items-center justify-end gap-2 my-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.id !== "undefined" && column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.columnDef.header}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {/*  Table*/}

      <Table className="rounded-lg">
        {/* {JSON.stringify(table)} */}
        <TableHeader className="sticky top-0 z-[5] bg-slate-100 dark:bg-slate-800">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={`text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                      header.column.columnDef.className
                        ? header.column.columnDef.className
                        : "text-left"
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="**:data-[slot=table-cell]:first:w-8">
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center py-8"
              >
                <div className="flex justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-[#4267B2]" />
                </div>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const rowBg =
                typeof cellClassName === "function"
                  ? cellClassName(row.original, row.index)
                  : typeof cellClassName === "string"
                    ? cellClassName
                    : "";
              return (
              <TableRow
                key={row.id}
                className={
                  typeof rowClassName === "function"
                    ? rowClassName(row.original, row.index)
                    : rowClassName || ""
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={`w-auto align-middle ${
                      cell.column.columnDef.className || "text-left"
                    } ${rowBg}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-28 text-center align-middle"
              >
                <div className="mx-auto flex max-w-md flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-5">
                  <p className="text-sm font-medium text-slate-700">{message}</p>
                  {emptyHint ? (
                    <p className="text-xs text-slate-500">{emptyHint}</p>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div
        className={`${
          selection ? "justify-between" : "justify-end"
        } flex items-center px-4 py-2.5 border-t border-slate-100 bg-slate-50/40`}
      >
        {selection && (
          <div className="hidden flex-1 text-sm text-slate-500 lg:flex dark:text-slate-400">
            {table.getFilteredSelectedRowModel().rows.length} of{""}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
        )}
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label
              htmlFor="rows-per-page"
              className="text-xs font-medium text-slate-600"
            >
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                const size = Number(value);
                if (isPaginationControlled && typeof onPageSizeChange === "function") {
                  onPageSizeChange(size);
                } else {
                  table.setPageSize(size);
                }
              }}
            >
              <SelectTrigger
                className="h-8 w-20 border-slate-200 text-xs"
                id="rows-per-page"
              >
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-xs font-medium text-slate-600">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(table.getPageCount(), 1)}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 border-slate-200 p-0 text-slate-600 lg:flex"
              onClick={() => {
                if (isPaginationControlled) {
                  onPageChange(1);
                } else {
                  table.setPageIndex(0);
                }
              }}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 border-slate-200 text-slate-600"
              size="icon"
              onClick={() => {
                if (isPaginationControlled) {
                  onPageChange(pagination.pageIndex);
                } else {
                  table.previousPage();
                }
              }}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 border-slate-200 text-slate-600"
              size="icon"
              onClick={() => {
                if (isPaginationControlled) {
                  onPageChange(pagination.pageIndex + 2);
                } else {
                  table.nextPage();
                }
              }}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 border-slate-200 text-slate-600 lg:flex"
              size="icon"
              onClick={() => {
                if (isPaginationControlled) {
                  onPageChange(table.getPageCount());
                } else {
                  table.setPageIndex(table.getPageCount() - 1);
                }
              }}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

CustomTable1.propTypes = {
  data: PropTypes.array.isRequired,
  fields: PropTypes.array.isRequired,
  filter: PropTypes.bool,
  selection: PropTypes.bool,
  loading: PropTypes.bool,
  pageSize: PropTypes.number,
  message: PropTypes.string,
  emptyHint: PropTypes.string,
  initialPageIndex: PropTypes.number,
  onPageChange: PropTypes.func,
  onPageSizeChange: PropTypes.func,
  rowClassName: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  cellClassName: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
};
