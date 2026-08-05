import CustomCard from "@/common/Custom/CustomCard2";
import { Table } from "reactstrap/lib";
import { useEffect, useState } from "react";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import Papa from "papaparse";
import PropTypes from "prop-types";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import moment from "moment";
import { bankTransactions } from "./data";

export default function BankTransactions() {
  const [form, setForm] = useState({
    opening_balance: 0,
    closing_balance: 0,
    date_from: moment().startOf("day").format("YYYY-MM-DD"),
    date_to: moment().endOf("day").format("YYYY-MM-DD"),
    bank_name: "",
    bank_code: "",
  });
  const [csvData, setCsvData] = useState([]);
  const [bankDetails, setBankDetails] = useState([]);
  const [entries, setEntries] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const getRevenueItems = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=banks_details`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setBankDetails(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  };
  useEffect(() => {
    getRevenueItems();
  }, []);

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;

        // Map CSV rows into the table structure
        const mapped = rows.map((row) => {
          // const amount = parseFloat(row.amount);`
          return {
            date: row.date,
            description: row.description,
            debit: row.debit,
            credit: row.credit,
            balance: "",
          };
        });

        setCsvData(file);
        setEntries(mapped);
      },
    });
  };
  const handleSubmit = () => {
    // console.log("form", form);
    // console.log("entries", entries);
    _postApi(
      `/bank-reconciliation`,
      { ...form, entries },
      (resp) => {
        if (resp.success) {
          toaster.success("Bank Reconciliation submitted successfully.");
        } else {
          toast.error("Failed to submit Bank Reconciliation.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while submitting data.");
      }
    );
  };

  const data = bankTransactions;
  const fields = [
    { title: "Date", value: "date" },
    { title: "Value Date", value: "valueDate" },
    { title: "Narration", value: "narration" },
    { title: "Reference", value: "reference" },
    { title: "Debit", value: "debit" },
    { title: "Credit", value: "credit" },
    { title: "Balance", value: "balance" },
  ];

  return (
    <CustomCard header={"Bank Transactions"}>
      {/* {JSON.stringify(form)} */}
      <CustomTablePagination data={data} fields={fields} />
    </CustomCard>
  );
}
const CustomTablePagination = ({ data, fields }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = data.slice(indexOfFirstItem, indexOfLastItem);
  return (
    <>
      <Table>
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field.value}>{field.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={fields.length} className="text-center">
                No data
              </td>
            </tr>
          ) : (
            paginatedData.map((item) => (
              <tr key={item.id}>
                {fields.map((field) => (
                  <td key={field.value}>
                    {field.custom ? (
                      <td key={field.value} className={field.className}>
                        {field.component(item, item.id)}
                      </td>
                    ) : (
                      <td key={field.value} className={field.className}>
                        {item[field.value]}
                      </td>
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </Table>
      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-t border-gray-200">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">{indexOfFirstItem + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(indexOfLastItem, data.length)}
              </span>{" "}
              of <span className="font-medium">{data.length}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                <FiChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              {[currentPage - 1, currentPage, currentPage + 1].includes(1)
                ? [1, 2, 3].map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-3 py-2 border text-sm font-medium ${
                        currentPage === page
                          ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                          : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))
                : totalPages > 3
                ? [
                    currentPage - 2,
                    currentPage - 1,
                    currentPage,
                    currentPage + 1,
                    currentPage + 2,
                  ].map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-3 py-2 border text-sm font-medium ${
                        currentPage === page
                          ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                          : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))
                : Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-3 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                <FiChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
};

CustomTablePagination.propTypes = {
  data: PropTypes.array.isRequired,
  fields: PropTypes.array.isRequired,
};
