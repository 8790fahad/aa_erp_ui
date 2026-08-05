import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import Widget from "@/common/Widget";
// import { getAllReport } from "@/redux/actions/reports";
import { formatNumber } from "@/utilities";
// import { CURRENCY } from "@/constants";
// import {
//   Table,
//   TableBody,
//   TableCaption,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
import {
  Briefcase,
  CalendarIcon,
  HandHelping,
  Landmark,
  ScrollText,
  // Search,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
// import { Input } from "@/components/ui/input";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { _fetchApi } from "@/redux/actions/api";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
// import { DataTable } from "@/components/data-table"
// import data from "@/app/dashboard/data.json";

// Demo data for dashboard
const DEMO_REPORTS = {
  expenses: 12500000,
  purchase: 45000000,
  sales: 75000000,
  debts: 8500000,
};

export default function Dashboard() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const today = moment().format("YYYY-MM-DD");
  // const dispatch = useDispatch();
  // const [list, setList] = useState([]);
  // const [items, setItems] = useState([]);
  // const [showAllPurchase] = useState(false);
  const [range, setRange] = useState({
    from: today,
    to: today,
  });

  // const handleChange = ({ target: { name, value } }) => {
  //   setRange({
  //     ...range,
  //     [name]: new Date(value),
  //   });
  // };

  const onSelectRange = (selected) => {
    if (selected) {
      setRange({
        from: selected.from
          ? moment(selected.from).format("YYYY-MM-DD")
          : selected.from === undefined
          ? range.from
          : moment().format("YYYY-MM-DD"),
        to: selected.to
          ? moment(selected.to).format("YYYY-MM-DD")
          : selected.to === undefined
          ? range.to
          : moment().format("YYYY-MM-DD"),
      });
    }
  };

  const [reports, setReports] = useState(DEMO_REPORTS);

  const getReports = useCallback(() => {
    if (!activeBusiness?.business_type) {
      // Use demo data if no business type
      setReports(DEMO_REPORTS);
      return;
    }
    _fetchApi(
      `/account/get-all-report?from=${range.from}&to=${range.to}&facilityId=${activeBusiness.id}&query_type=${activeBusiness.business_type}`,
      (data) => {
        if (data && data.results) {
          if (data.results.length > 0 && data.results[0]) {
            // Ensure all required fields exist
            const apiData = data.results[0];
            setReports({
              expenses: apiData.expenses || DEMO_REPORTS.expenses,
              purchase: apiData.purchase || DEMO_REPORTS.purchase,
              sales: apiData.sales || DEMO_REPORTS.sales,
              debts: apiData.debts || DEMO_REPORTS.debts,
            });
          } else {
            // Use demo data if API returns empty results
            setReports(DEMO_REPORTS);
          }
        } else {
          // Use demo data if no data returned
          setReports(DEMO_REPORTS);
        }
      },
      (error) => {
        console.error({ error });
        // Use demo data on error
        setReports(DEMO_REPORTS);
      }
    );
  }, [range.from, range.to, activeBusiness?.id, activeBusiness?.business_type]);

  useEffect(() => {
    getReports();
  }, [getReports]);

  // const syncData = useCallback(() => {
  //   dispatch(
  //     getAllReport(setPurchase, range.from, range.to, "Purchase summary")
  //   );
  //   dispatch(getAllReport(setSales, range.from, range.to, "Sales summary"));
  //   dispatch(
  //     getAllReport(setExpenses, range.from, range.to, "Expenses summary")
  //   );
  //   dispatch(getAllReport(setDebts, range.from, range.to, "Debt summary"));
  // }, [dispatch, range]);

  // const getReportList = useCallback(() => {
  //   dispatch(
  //     getAllReport(setList, range.from, range.to, "Purchase category summary")
  //   );
  // }, [dispatch, range.from, range.to]);

  // const [searchTxt, addSearchTxt] = useState("");

  // const onFilterTextChange = (e) => {
  //   addSearchTxt(e.target.value);
  // };

  // const retrieveList = useCallback(() => {
  //   setItems(
  //     searchTxt.length > 2 && list.length
  //       ? list.filter((item) => {
  //           return item.description
  //             ?.toLowerCase()
  //             ?.includes(
  //               searchTxt.toLowerCase() ||
  //                 item.receive_date.toString().includes(searchTxt)
  //             );
  //         })
  //       : list
  //   );

  //   //  setItems(list);
  // }, [list, searchTxt]);

  // useEffect(() => {
  //   retrieveList();
  // }, [retrieveList]);

  // useEffect(() => {
  //   getReportList();
  // }, [getReportList]);

  // const fetchData = useCallback(() => {
  //   dispatch(getItemList());
  // }, [dispatch]);

  // useEffect(() => {

  //   fetchData();
  // }, []);

  // const totalAmount = list.reduce(
  //   (a, b) => parseFloat(a) + parseFloat(b.amount),
  //   0
  // );
  // const total_selling_price = list.reduce(
  //   (a, b) => parseFloat(a) + parseFloat(b.selling_price) * parseFloat(b.qty),
  //   0
  // );
  // const final = items.length > 0 && showAllPurchase ? items : items.slice(-15);

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome back, {activeBusiness.business_name}
        </h2>
        <div className="flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date-range"
                variant={"outline"}
                className={cn(
                  "w-[260px] justify-start text-dark text-left font-normal",
                  !range && "text-dark"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {range.from ? (
                  range.to ? (
                    <>
                      {format(new Date(range.from), "LLL dd, y")} -{" "}
                      {format(new Date(range.to), "LLL dd, y")}
                    </>
                  ) : (
                    format(new Date(range.from), "LLL dd, y")
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
                defaultMonth={range.from ? new Date(range.from) : new Date()}
                selected={{
                  from: range.from ? new Date(range.from) : undefined,
                  to: range.to ? new Date(range.to) : undefined,
                }}
                onSelect={onSelectRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Widget
          icon={<ScrollText className="h-4 w-4 text-muted-foreground" />}
          link={`/app/reports/Purchase category summary?from=${range.from}&to=${range.to}`}
          title="Total purchase"
          content={`₦ ${reports.purchase ? formatNumber(reports.purchase) : 0}`}
        />
        <Widget
          icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
          link={`/app/reports/Sales category summary?from=${range.from}&to=${range.to}`}
          title="Total sales"
          content={`₦ ${reports.sales ? formatNumber(reports.sales) : 0}`}
        />
        <Widget
          icon={<Landmark className="h-4 w-4 text-muted-foreground" />}
          link={`/app/reports/Expenses category summary?from=${range.from}&to=${range.to}`}
          title="Total expenses"
          content={`₦ ${reports.expenses ? formatNumber(reports.expenses) : 0}`}
        />
        <Widget
          icon={<HandHelping className="h-4 w-4 text-muted-foreground" />}
          link={`/app/reports/Debt category summary?from=${range.from}&to=${range.to}`}
          title="Total debts"
          content={`₦ ${reports.debts ? formatNumber(reports.debts) : 0}`}
        />
      </div>

      <div className="mt-6">
        <ChartAreaInteractive />
      </div>
      {/* <DataTable data={data} /> */}

      {/* <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="search for purchase..."
            className="ps-4"
            value={searchTxt}
            onChange={onFilterTextChange}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="Show all"
            checked={showAllPurchase}
            onCheckedChange={() => setShowAllPurchase((p) => !p)}
            className="p-0"
          />
          <label
            htmlFor="show-completed"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Show all
          </label>
        </div>
      </div> */}
      {/* <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-7">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Purchase list</CardTitle>
            <div className="text-right text-xs">
              <div className="font-semibold">
                Total No. of Items:{" "}
                <span className="font-bold">{final.length}</span>
              </div>
              <div className="font-semibold">
                Total Cost:{" "}
                <span className="font-bold">
                  {CURRENCY}
                  {formatNumber(totalAmount)}
                </span>
              </div>
              <div className="font-semibold">
                Total Selling Price:{" "}
                <span className="font-bold">
                  {CURRENCY}
                  {formatNumber(total_selling_price)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>A list of your recent invoices.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">S/N</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Item name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="text-right">
                    Cost Price ({CURRENCY})
                  </TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {final.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{i + 1}</TableCell>
                    <TableCell>{item.receive_date}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{formatNumber(item.qty)}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.selling_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div> */}
    </>
  );
}
