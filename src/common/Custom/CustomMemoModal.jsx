/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Input,
  Label,
  Row,
  Col,
  Collapse,
} from "reactstrap";
import moment from "moment";
import { formatNumber1 } from "@/components/router/utilities";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { toast } from "sonner";
import { _fetchApi } from "@/redux/actions/api";
import { FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const CustomMemoModal = ({
  isOpen,
  toggle,
  header,
  itemList = [],
  items,
  files = [],
  activeBusiness,
  cancel,
  returnMemo,
  approveMemo,
  reject,
  loading1,
  remark,
  setRemark,
  amount,
  setAmount,
  logs = [],
  mode,
  form,
  handleChange,
  handleEdit,
  loading2,
}) => {
  const [justificationTemplates, setJustificationTemplates] = useState([
  ]);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isOpen3, setIsOpen3] = useState(false);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const toggleMemoLog = () => setIsOpen3(!isOpen3);
  const [isOpen2, setIsOpen2] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const formatNum = (number) => {
    return Number(number).toLocaleString();
  };

  const balance = items?.total - parseInt(items?.amount);
  // const _total = items?.total;
  // const _amount = items?.amount;
  const getJustification = useCallback(() => {
    _fetchApi(
      `/account/get-memo-justification?memo_id=${items?.memo_id}&facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setJustificationTemplates(data.results.map(item=> item.text));
        }
      },
      (err) => {
        console.log(err);
      }
    );
  }, [activeBusiness.id, items?.memo_id]);
  useEffect(() => {
    if (isOpen) {
      getJustification();
    }
  }, [getJustification, isOpen]);

  const handleOpenChange = (open) => {
    if (!open) {
      if (typeof cancel === "function") cancel();
      else if (typeof toggle === "function") toggle();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl lg:!max-w-3xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy,#0f2744)] px-5 py-4 pr-12 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-white/10 p-2">
              <FileText className="h-4 w-4 text-white/90" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold leading-tight text-white">
                {header || "Preview"}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-white/70">
                {items?.memo_id || "Internal memo"}
                {items?.date
                  ? ` · ${moment(items.date).format("DD MMM YYYY")}`
                  : ""}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5">
        {/* {JSON.stringify(logs)} */}
        <div>
          {mode !== "review_rejected" && (
            <div
              style={{
                borderWidth: 1,
                borderColor: "#000",
                padding: 20,
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  textAlign: "center",
                  marginBottom: 10,
                  textTransform: "uppercase",
                }}
              >
                {activeBusiness?.business_name}
              </h2>
              <h4
                style={{
                  fontSize: 12,
                  textAlign: "center",
                  textTransform: "uppercase",
                }}
              >
                Internal Memo
              </h4>
            </div>
          )}

          {mode === "review_rejected" ? (
            <Row>
              <Col md={6}>
                <Label>From</Label>
                <Input
                  type="text"
                  name="from"
                  value={items?.from_name}
                  disabled={true}
                />
              </Col>
              <Col md={6}>
                <Label>Date</Label>
                <Input
                  type="date"
                  name="date"
                  value={moment().format(form.date)}
                  disabled={true}
                />
              </Col>
              <Col md={12}>
                <Label>Description</Label>
                <Input
                  onChange={handleChange}
                  name="purpose"
                  value={form.purpose}
                  type="textarea"
                />
              </Col>
              <Col md={12} className="mt-3">
                <div>
                  <Button
                    onClick={toggleMemoLog}
                    className="mb-2"
                    color="primary"
                  >
                    {isOpen3 ? "Hide" : "Show"} memo log
                  </Button>
                  <Collapse isOpen={isOpen3}>
                    <div className="table-responsive">
                      <table className="table table-bordered">
                        <thead>
                          <tr>
                            <th>S/N</th>
                            <th>Date</th>
                            <th>Activity</th>
                            <th>User</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(logs || []).map((log, idx) => (
                            <tr key={idx}>
                              <td className="text-center">{idx + 1}</td>
                              <td>{log.date}</td>
                              <td>{log.activity}</td>
                              <td>{log.user}</td>
                              <td>{log.remark}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Collapse>
                </div>
              </Col>
            </Row>
          ) : (
            <div style={{ marginBottom: 20 }}>
              {/* {JSON.stringify(files)} */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                {/* Date */}
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Date: <b>{moment(items?.date).format("DD-MM-YYYY")}</b>
                </div>

                {/* Priority */}
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Priority:{" "}
                  <b
                    style={{
                      color:
                        items?.priority === "High"
                          ? "red"
                          : items?.priority === "Medium"
                          ? "orange"
                          : "green",
                    }}
                  >
                    {items?.priority}
                  </b>
                </div>

                {/* Memo No. */}
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginRight: 10,
                    textAlign: "right",
                  }}
                >
                  Memo No.: <b>{items?.memo_id}</b>
                </div>
              </div>

              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Recipient: <b>The {items?.recipient},</b>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  From branch: <b>{items?.from_name}</b>
                </div>
              </div>
              {mode !== "review" && (
                <div style={{ flexDirection: "row", width: "100%" }}>
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: 12,
                      textTransform: "uppercase",
                      marginRight: 10,
                    }}
                  >
                    Raised by: <b>{items?.raise_by}</b>
                  </div>
                </div>
              )}
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Subject: <b>{items?.subject}</b>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Description: <b>{items?.purpose || items?.details}</b>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  <span className="fw-bold">Details: </span><br />
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th className="text-center">S/N</th>
                        <th className="text-center">Item Name</th>
                        <th className="text-center">Unit Cost (₦)</th>
                        <th className="text-center">Quantity</th>
                        <th className="text-center">Total Cost (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      { (itemList || []).map((item, idx) => (
                        <tr key={item.item_list_id || idx}>
                          <td className="text-center">{idx + 1}</td>
                          <td>{item.item_name|| item.description}</td>
                          <td className="text-right">
                            {formatNumber1(item.unit_cost)}
                          </td>
                          <td className="text-center">
                            {Number(item.quantity).toLocaleString()}
                          </td>
                          <td className="text-right">
                            {formatNumber1(item.unit_cost * item.quantity)}
                          </td>
                        </tr>
                      ))}
                      {(itemList || []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-slate-500">
                            No line items
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={4} className="text-right fw-bold">
                          Total(₦):
                        </td>
                        <td className="text-right">
                          {formatNumber1(
                            // parseInt(items?.amount) === 0
                            items?.total
                            // : items?.amount
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {/* {balance <= 0 && balance !== items.total ? null : (
                    <Label>
                      Balance: <b>(₦{formatNumber1(balance)})</b>
                    </Label>
                  )} */}
                  {justificationTemplates.length ? (
                    <>
                      <b className="">Justification:</b> <br />
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-2">
                          {justificationTemplates.map((template, index) => (
                            <button
                              key={index}
                              className="px-3 py-1 text-xs bg-white border border-amber-300 text-amber-700 rounded-full hover:bg-amber-50 transition-colors"
                            >
                              {template}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {(mode === "preview" || mode === "review" || mode === "approve") &&
                <>
                {(files || []).length > 0 && (
                    <>
                      <div className="fw-bold">Attachments:</div>
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {(files || []).map((file, i) => {
                          const parts = file.name.split(".");
                          const ext = parts.length > 1 ? "." + parts.pop() : "";
                          const baseName = parts.join(".");

                          return (
                            <li
                              key={i}
                              className="flex items-center justify-between rounded-md border px-4 py-2"
                            >
                              {file.type.startsWith("image/") ? (
                                <div
                                  className="flex text-sm cursor-pointer"
                                  title={file.name}
                                  onClick={() => {
                                    setPhotoIndex(i);
                                    setIsOpen2(true);
                                  }}
                                >
                                  <span className="truncate max-w-[150px]">
                                    {baseName}
                                  </span>
                                  <span className="ml-1 flex-shrink-0">
                                    {ext}
                                  </span>
                                </div>
                              ) : (
                                <a
                                  className="flex text-sm text-black"
                                  title={file.name}
                                  href={file.preview}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    window.open(
                                      file.preview,
                                      "_blank",
                                      "noopener,noreferrer"
                                    );
                                  }}
                                  style={{ textDecoration: "none" }}
                                >
                                  <span className="truncate max-w-[150px]">
                                    {baseName}
                                  </span>
                                  <span className="ml-0 flex-shrink-0">
                                    {ext}
                                  </span>
                                </a>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </>
              }

              {mode === "preview" && (
                <>
                  <div className="mt-3">
                    <center>
                      <button
                        type="button"
                        onClick={toggleCollapse}
                        className="inline-flex h-9 items-center rounded-md bg-[var(--aa-navy,#0f2744)] px-4 text-sm font-semibold text-white hover:bg-[var(--aa-navy-hover,#243a73)]"
                      >
                        {isCollapsed ? "View Logs" : "Hide Logs"}
                      </button>
                    </center>

                    {!isCollapsed && (
                      <div className="mt-3">
                        <center>
                          <h4 className="fw-bold">Logs</h4>
                        </center>
                        <div className="table-responsive">
                          <table className="table table-bordered">
                            <thead>
                              <tr>
                                <th>S/N</th>
                                <th>Date</th>
                                <th>Activity</th>
                                <th>User ID</th>
                                <th>Remark</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* <tr>
                                <td>1</td>
                                <td>{items?.date}</td>
                                <td>Raised memo</td>
                                <td>{items?.raise_by}</td>
                                <td></td>
                              </tr> */}
                              {mode === "preview" &&
                                (logs || []).length > 0 &&
                                (logs || []).map((log, idx) => (
                                  <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td>
                                      {moment(log.date).format("YYYY-MM-DD")}
                                    </td>
                                    <td>{log.status} memo</td>
                                    <td>{log.user_id}</td>
                                    <td>{log.remark}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {(mode === "review" || mode === "approve") && (
            <div
              style={{
                flexDirection: "column",
                width: "100%",
                marginBottom: 0,
              }}
            >
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 0,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                ></div>

                {mode === "review" ? (
                  <div
                    style={{
                      marginBottom: 0,
                      fontSize: 14,
                      textTransform: "uppercase",
                      marginRight: 10,
                    }}
                  >
                    <Label>
                      Approve Amount: <b>(₦{formatNumber1(amount)})</b>
                    </Label>
                    <Input
                      name="amount"
                      value={amount}
                      type="number"
                      onChange={({ target: { value } }) => {
                        // setAmount(value);
                        // if (value > parseFloat(balance)) {
                        //   toast.success("Amount cannot be greater than total");
                        // } else {
                        setAmount(value);
                        // }
                      }}
                    />
                  </div>
                ) : (
                  <Label>
                    Approve Amount:{" "}
                    <b>(₦{formatNumber1(items?.total - balance)})</b>
                  </Label>
                )}
              </div>
              {/* {mode === "approve" && (
                
              )} */}
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 0,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  <Label>Remark</Label>
                  <Input
                    value={remark}
                    type="textarea"
                    onChange={({ target: { value } }) => {
                      setRemark(value);
                    }}
                  />
                </div>
              </div>
              <div className="mt-3">
                <center>
                  <button
                    type="button"
                    onClick={toggleCollapse}
                    className="inline-flex h-9 items-center rounded-md bg-[var(--aa-navy,#0f2744)] px-4 text-sm font-semibold text-white hover:bg-[var(--aa-navy-hover,#243a73)]"
                  >
                    {isCollapsed ? "View Logs" : "Hide Logs"}
                  </button>
                </center>

                {!isCollapsed && (
                  <div className="mt-3">
                    <center>
                      <h4 className="fw-bold">Logs</h4>
                    </center>
                    <div className="table-responsive">
                      <table className="table table-bordered">
                        <thead>
                          <tr>
                            <th>S/N</th>
                            <th>Date</th>
                            <th>Activity</th>
                            <th>User ID</th>
                            <th>Remark</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* <tr>
                            <td>1</td>
                            <td>{items?.date}</td>
                            <td>Raised memo</td>
                            <td>{items?.raise_by}</td>
                            <td></td>
                          </tr> */}
                          {(mode === "review" || mode === "approve") &&
                            (logs || []).length > 0 &&
                            (logs || []).map((log, idx) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{moment(log.date).format("YYYY-MM-DD")}</td>
                                <td>{log.status} memo</td>
                                <td>{log.user_id}</td>
                                <td>{log.remark}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
          <div className="flex flex-wrap justify-end gap-2">
        {mode === "preview" && (
          <Button
            color="secondary"
            outline
            className="mr-1"
            onClick={cancel}
          >
            Close
          </Button>
        )}
        {mode === "review" && (
          <>
            <Button
              color="danger"
              className="mr-1"
              outline
              onClick={returnMemo}
              disabled={remark === ""}
            >
              Return
            </Button>
            <Button
              color="primary"
              onClick={approveMemo}
              disabled={remark === ""}
              className="!border-[var(--aa-navy,#0f2744)] !bg-[var(--aa-navy,#0f2744)]"
            >
              Submit
            </Button>
          </>
        )}
        {mode === "approve" && (
          <>
            <Button
              color="danger"
              className="mr-1"
              outline
              onClick={reject}
              disabled={remark === ""}
            >
              Reject
            </Button>
            <Button
              color="primary"
              onClick={approveMemo}
              disabled={remark === ""}
              className="!border-[var(--aa-navy,#0f2744)] !bg-[var(--aa-navy,#0f2744)]"
              // disabled={amount === ""}
            >
              Submit
            </Button>
          </>
        )}
        {mode === "review_rejected" && (
          <Button
            color="primary"
            onClick={handleEdit}
            disabled={loading2}
            className="!border-[var(--aa-navy,#0f2744)] !bg-[var(--aa-navy,#0f2744)]"
          >
            {loading2 ? "Submitting..." : "Submit"}
          </Button>
        )}
          </div>
        </div>
      {isOpen2 && (
        <Lightbox
          open={isOpen2}
          close={() => setIsOpen2(false)}
          index={photoIndex}
          slides={(files || []).map((file) => ({
            src: file.fromServer ? file.preview : URL.createObjectURL(file),
          }))}
          on={{ view: ({ index }) => setPhotoIndex(index) }}
        />
      )}
      </SheetContent>
    </Sheet>
  );
};

export default CustomMemoModal;
