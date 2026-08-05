import CustomCard from "@/common/Custom/CustomCard2";
import { Typeahead } from "react-bootstrap-typeahead";
import { Col, Input, Row, Table } from "reactstrap/lib";
import { useCallback, useEffect, useRef, useState } from "react";
import { _postApi, apiURL } from "@/redux/actions/api";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import Papa from "papaparse";
import PropTypes from "prop-types";

import { formatNumber1 } from "@/components/router/utilities";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { CustomButton } from "@/common/ui-elements";
import moment from "moment";

export default function BankReconciliation() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const [form, setForm] = useState({
    opening_balance: 0,
    closing_balance: 0,
    date_from: moment().startOf("month").format("YYYY-MM-DD"),
    date_to: moment().endOf("month").format("YYYY-MM-DD"),
    bank_name: "",
    bank_code: "",
    bank_chart_code: "",
  });
  const [csvData, setCsvData] = useState([]);
  const [bankDetails, setBankDetails] = useState([]);
  const [entries, setEntries] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const getRevenueItems = useCallback(() => {
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
  }, [activeBusiness]);
  useEffect(() => {
    getRevenueItems();
  }, [getRevenueItems]);

  const getOpeningBalance = useCallback(() => {
    if (!form.bank_chart_code) return;
    _postApi(
      `/bank-opening-balance`,
      { facilityId: activeBusiness.id, bank_chart_code: form.bank_chart_code },
      (resp) => {
        if (resp.success) {
          setForm((prev) => ({
            ...prev,
            opening_balance: resp.opening_balance,
          }));
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  }, [activeBusiness, form.bank_chart_code]);

  useEffect(() => {
    if (!activeBusiness?.id || !form.bank_chart_code) return;
    getOpeningBalance();
  }, [activeBusiness, form.bank_chart_code, getOpeningBalance]);

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
          toast.success("Bank Reconciliation submitted successfully.");
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
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const res = await fetch(`${apiURL}/audit/upload-statement`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      // console.log("API Response:", data);

      if (data.success) {
        setResult(data.transactions);
      } else {
        alert("Error: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
    setLoading(false);
  };

  return (
    <CustomCard header={"Bank Reconciliation"}>
      {/* {JSON.stringify(form)} */}
      <Row>
        <Col md={4}>
          <label>Select Bank</label>
          <Typeahead
            id="material-typeahead"
            ref={inputRef}
            options={bankDetails}
            className="z-100"
            placeholder="Select Bank..."
            onChange={(selected) =>
              setForm((prev) => ({
                ...prev,
                ...selected[0],
                bank_name: selected[0]?.name || "",
                bank_code: selected[0]?.code || "",
                bank_chart_code: selected[0]?.chart_code || "",
              }))
            }
            labelKey={(option) => `${option.name} - (${option.code})`}
          />
        </Col>
        <Col md={4}>
          <label>Date From</label>
          <Input
            type="date"
            placeholder="Date From"
            value={form.date_from}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                date_from: e.target.value,
              }))
            }
          />
        </Col>
        <Col md={4}>
          <label>Date To</label>
          <Input
            type="date"
            placeholder="Date To"
            value={form.date_to}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                date_to: e.target.value,
              }))
            }
          />
        </Col>

        <Col md={4}>
          <label>Opening Balance</label>
          <Input
            type="number"
            disabled
            value={form.opening_balance}
            placeholder="Opening Balance"
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                opening_balance: e.target.value,
              }))
            }
          />
        </Col>
        <Col md={4}>
          <label>Closing Balance</label>
          <Input
            type="number"
            placeholder="Closing Balance"
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                closing_balance: e.target.value,
              }))
            }
          />
        </Col>
      </Row>
      <Row>
        <Col md={4}>
          <label>Upload Statement</label>
          <Input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
          />
          {/* <Input
            type="file"
            placeholder="Upload Statement"
            accept=".csv"
            onChange={handleCSVUpload}
          /> */}
        </Col>

        {entries.length > 0 && (
          <Col md={4} className="flex items-center justify-center mt-3">
            <CustomButton
              disabled={
                form.bank_name === "" ||
                form.bank_code === "" ||
                form.bank_chart_code === ""
              }
              onClick={handleSubmit}
            >
              Submit
            </CustomButton>
          </Col>
        )}
      </Row>

      {loading && <p className="mt-4 text-blue-500">Processing PDF...</p>}

      {result && (
        <div className="mt-6 border p-4 rounded bg-gray-50 overflow-auto max-h-[500px]">
          <h3 className="text-lg font-semibold mb-2">
            Parsed Result (PDF to table)
          </h3>
          <pre className="text-sm bg-white p-3 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      <div className="mt-2">
        {entries.length > 0 && (
          <>
            <CustomTablePagination
              data={entries}
              fields={[
                { title: "Date", value: "date" },
                { title: "Description", value: "description" },
                {
                  title: "Debit",
                  // value: "debit",
                  custom: true,
                  component: (item) => (
                    <span className="text-right">
                      {parseFloat(item.debit) > 0
                        ? formatNumber1(item.debit)
                        : "0"}
                    </span>
                  ),
                },
                {
                  title: "Credit",
                  // value: "credit",
                  custom: true,
                  component: (item) => (
                    <span className="text-right">
                      {parseFloat(item.credit) > 0
                        ? formatNumber1(item.credit)
                        : "0"}
                    </span>
                  ),
                },
                // { title: "Balance", value: "balance" },
              ]}
            />
          </>
        )}
      </div>
    </CustomCard>
  );
}
const CustomTablePagination = ({ data, fields }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
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
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
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
