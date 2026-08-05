/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Label, Row } from "reactstrap";
import { useSelector } from "react-redux";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { _fetchApi, apiURL } from "@/redux/actions/api";
import CustomButton from "@/common/Custom/CustomButton";
import CustomCard from "@/common/Custom/CustomCard2";
import Loading from "@/common/Custom/Loading";
import CustomTable from "@/common/Custom/CustomTable";
import CustomModal from "@/common/Custom/CustomModal";
import { formatNumber } from "@/utilities";
import { Input, Checkbox } from "antd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CustomTable1 from "@/common/Custom/CustomTable1";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { MoreVerticalIcon, PrinterIcon, CalendarIcon } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { VoucherDocument } from "./PaymentVoucherPDF";
import { cn } from "@/lib/utils";
import { CombinedVoucherDocument } from "./CombinedPaymentVoucherPdf";
import { toast } from "sonner";
import { formatNumber1 } from "@/components/router/utilities";

function ListOfMemo() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [memos, setMemos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("all");

  // Date filter states
  const [dateRange, setDateRange] = useState({
    from: undefined,
    to: undefined,
  });

  // Bulk selection states
  const [selectedMemos, setSelectedMemos] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false);

  const getMemos = useCallback(() => {
    setLoading(true);
    const formattedDateFrom = dateRange.from
      ? moment(dateRange.from).format("YYYY-MM-DD")
      : null;

    const formattedDateTo = dateRange.to
      ? moment(dateRange.to).format("YYYY-MM-DD")
      : null;

    _fetchApi(
      `/account/get-voucher-memos/${activeBusiness.id}/${status}?dateFrom=${
        formattedDateFrom || ""
      }&dateTo=${formattedDateTo || ""}`,
      (data) => {
        if (data.success) {
          setMemos(data.results);
        } else {
          setMemos([]);
        }
        setLoading(false);
      },
      (err) => {
        console.log(err);
        setMemos([]);
        setLoading(false);
      }
    );
  }, [activeBusiness.id, user.id, status, dateRange]);

  useEffect(() => {
    getMemos();
  }, [getMemos]);

  // Bulk selection handlers
  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedMemos(filteredMemos.map((memo) => memo.memo_id));
    } else {
      setSelectedMemos([]);
    }
  };

  const handleSelectMemo = (memoId, checked) => {
    if (checked) {
      setSelectedMemos((prev) => [...prev, memoId]);
    } else {
      setSelectedMemos((prev) => prev.filter((id) => id !== memoId));
      setSelectAll(false);
    }
  };

  const handleBulkPrint = async () => {
    if (selectedMemos.length === 0) {
      alert("Please select at least one memo to print");
      return;
    }

    setBulkPrintLoading(true);
    try {
      // Filter selected memos that have PV generated
      const selectedMemosData = filteredMemos.filter(
        (memo) =>
          selectedMemos.includes(memo.memo_id) && memo.status === "Pv Generated"
      );

      if (selectedMemosData.length === 0) {
        alert("No selected memos have payment vouchers generated");
        setBulkPrintLoading(false);
        return;
      }

      // Prepare vouchers array for bulk API call
      const vouchersArray = selectedMemosData.map((memo) => ({
        memo_id: memo.memo_id,
        pv: memo.reference_number,
      }));

      try {
        // Make single bulk API call instead of multiple individual calls
        const response = await fetch(
          `${apiURL}/get/bulk/payment/vouchers?facilityId=${activeBusiness.id}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              vouchers: vouchersArray,
            }),
          }
        );

        const result = await response.json();

        if (!result.success) {
          alert(`Failed to fetch voucher data: ${result.message}`);
          setBulkPrintLoading(false);
          return;
        }

        // Extract successful vouchers
        const successfulVouchers = result.data.successful
          .filter((item) => item.success && item.data)
          .map((item) => item.data);

        const failureCount = result.data.failed.length;

        if (successfulVouchers.length === 0) {
          toast.error("Failed to fetch any payment voucher data");
          setBulkPrintLoading(false);
          return;
        }

        // Log any failures for debugging
        if (failureCount > 0) {
          console.warn("Some vouchers failed to load:", result.data.failed);
        }

        try {
          // Generate one combined PDF with all vouchers
          const blob = await pdf(
            <CombinedVoucherDocument
              vouchers={successfulVouchers}
              activeBusiness={activeBusiness}
            />
          ).toBlob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;

          // Create filename with current date and voucher count
          const currentDate = moment().format("YYYY-MM-DD");
          a.download = `PaymentVouchers-${currentDate}-${successfulVouchers.length}vouchers.pdf`;

          a.click();
          URL.revokeObjectURL(url);

          // Show success message
          const message =
            failureCount > 0
              ? `Successfully generated combined PDF with ${successfulVouchers.length} payment vouchers. ${failureCount} vouchers failed to load.`
              : `Successfully generated combined PDF with ${successfulVouchers.length} payment vouchers.`;
          toast.success(message);
        } catch (pdfError) {
          console.error("Error generating combined PDF:", pdfError);
          toast.error("Failed to generate combined PDF");
        }
      } catch (apiError) {
        console.error("Error calling bulk API:", apiError);
        toast.error("Failed to fetch voucher data from server");
      }
    } catch (error) {
      console.error("Error in bulk print:", error);
      toast.error("An error occurred during bulk printing");
    } finally {
      setBulkPrintLoading(false);
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const fields = [
    {
      title: (
        <Checkbox
          checked={selectAll}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      custom: true,
      component: (item) => (
        <Checkbox
          checked={selectedMemos.includes(item.memo_id)}
          onChange={(e) => handleSelectMemo(item.memo_id, e.target.checked)}
        />
      ),
    },
    {
      title: "Date",
      custom: true,
      component: (item) => (
        <div className="text-left">
          {moment(item.date).format("DD/MM/YYYY")}
        </div>
      ),
    },
    {
      title: "Memo No.",
      custom: true,
      component: (item) => <div className="text-center">{item.memo_id}</div>,
    },
    {
      title: "Subject",
      custom: true,
      component: (item) => <>{item.subject}</>,
    },
    {
      title: "Amount (₦)",
      custom: true,
      component: (item) => (
        <div className="text-right">{formatNumber(item.total)}</div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <Badge
            color={
              {
                pending: "primary",
                returned: "danger",
                approved: "success",
                reviewed: "warning",
              }[item.status] || "secondary"
            }
            className="p-2"
          >
            {item.status}
          </Badge>
        </div>
      ),
    },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center flex justify-center ">
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                  size="icon"
                >
                  <MoreVerticalIcon />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {item.status != "Pv Generated" ? (
                  <DropdownMenuItem
                    onClick={() =>
                      history(
                        `/app/account/record-expenses?memo_id=${item.memo_id}&reference_number=${item.reference_number}`
                      )
                    }
                  >
                    Generate PV
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() =>
                      history(
                        `/app/account/record-expenses/pv-direct-pdf?pv=${item.reference_number}&memo_id=${item.memo_id}`
                      )
                    }
                  >
                    Print PV
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() =>
                    history(
                      `/app/account/record-expenses/memo-pdf?id=${item.reference_number}&memo_id=${item.memo_id}`
                    )
                  }
                >
                  Print Memo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    history(
                      `/app/account/record-expenses/memo-pdf?id=${item.reference_number}&memo_id=${item.memo_id}`
                    )
                  }
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        </div>
      ),
    },
  ];
  const history = useNavigate();

  const filteredMemos = memos.filter((memo) => {
    let matchesSearch = true;
    let matchesDate = true;
    let matchesStatus = true;

    // Search filter
    if (searchTerm) {
      matchesSearch =
        memo.from_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.memo_id?.toLowerCase().includes(searchTerm.toLowerCase());
    }

    // Date filter
    if (dateRange.from || dateRange.to) {
      const memoDate = moment(memo.date);
      if (dateRange.from && memoDate.isBefore(moment(dateRange.from))) {
        matchesDate = false;
      }
      if (dateRange.to && memoDate.isAfter(moment(dateRange.to))) {
        matchesDate = false;
      }
    }

    // Status filter
    if (status !== "all") {
      matchesStatus = memo.status === status;
    }

    return matchesSearch && matchesDate && matchesStatus;
  });

  const total = filteredMemos.reduce((sum, memo) => {
    return sum + (Number(memo.total) || 0);
  }, 0);

  // Check if all selected memos have "Pv Generated" status
  const allSelectedHavePvGenerated =
    selectedMemos.length > 0 &&
    selectedMemos.every((memoId) => {
      const memo = filteredMemos.find((m) => m.memo_id === memoId);
      return memo && memo.status === "Pv Generated";
    });

  // Update selectAll state when filteredMemos changes
  useEffect(() => {
    if (filteredMemos.length > 0) {
      const allSelected = filteredMemos.every((memo) =>
        selectedMemos.includes(memo.memo_id)
      );
      setSelectAll(allSelected);
    }
  }, [filteredMemos, selectedMemos]);

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-6 ">
        <div>
          <h1 className="text-3xl font-bold">Payment Vouchers</h1>
          <p className="text-muted-foreground">Manage your vouchers</p>
        </div>
        <div className="flex gap-2">
          {/* <CustomButton
            color="success"
            size="sm"
            className="m-1"
            handleSubmit={() => {
              history(`/app/account/record-expenses`);
            }}
          >
            Direct Expense
          </CustomButton> */}
        </div>
      </div>

      <div className="flex gap-2 sm:flex-row flex-col mb-4 align-items-center">
        <div className="flex-1">
          <Input.Search
            placeholder="Search by warehouse name or memo ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Date Range Picker */}
        <div className="w-full sm:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[300px] justify-start text-left font-normal",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {moment(dateRange.from).format("DD/MM/YYYY")} -{" "}
                      {moment(dateRange.to).format("DD/MM/YYYY")}
                    </>
                  ) : (
                    moment(dateRange.from).format("DD/MM/YYYY")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
              {(dateRange?.from || dateRange?.to) && (
                <div className="p-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateRange({ from: undefined, to: undefined })
                    }
                    className="w-full"
                  >
                    Clear dates
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        <div className="w-full sm:w-1/5">
          <Select className="w-full" value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="Pv Generated">Generated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Row className="mx-0">
        <div className="d-flex justify-content-end mb-1.5"></div>
        <div className="d-flex justify-content-end align-items-center gap- mb-2"></div>
        {loading && <Loading />}
        {!loading ? (
          <>
            <div className="d-flex px-0 align-items-center justify-content-between w-full">
              {/* Print All PV Button - Top Left of Table */}
              <div className="mb-3">
                {allSelectedHavePvGenerated && (
                  <CustomButton
                    color="primary"
                    size="sm"
                    className="m-1 mb-0 flex items-center"
                    handleSubmit={handleBulkPrint}
                    disabled={bulkPrintLoading}
                  >
                    <PrinterIcon className="w-4 h-4 mr-2" />
                    {bulkPrintLoading
                      ? "Printing..."
                      : `Print All PV (${selectedMemos.length})`}
                  </CustomButton>
                )}
              </div>

              <div className="text-end mb-2 fw-bold">
                Total:{" "}
                <span>₦{formatNumber1(parseFloat(total).toFixed(2))}</span>
              </div>
            </div>
            <CustomTable1 fields={fields} data={filteredMemos} />
          </>
        ) : (
          <center>
            <Alert className="mt-3" color="info">
              No data to view
            </Alert>
          </center>
        )}
      </Row>
    </div>
  );
}

export default ListOfMemo;
