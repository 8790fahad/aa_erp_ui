import  { useEffect, useState } from "react";
import { CardBody, Col, Container, Input, Label, Row, Table } from "reactstrap";
import { useSelector } from "react-redux";
import moment from "moment";
import { useNavigate, useSearchParams } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import CustomCard from "@/common/Custom/CustomCard2";
import CustomButton from "@/common/Custom/CustomButton";
import { ArrowBigLeft } from "lucide-react";
import { formatNumber1 } from "@/components/router/utilities";
import { FaEdit } from "react-icons/fa";
import { MdAdd, MdDelete } from "react-icons/md";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";

export default function EditMemo() {
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editExpense, setEditExpense] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [searchParams] = useSearchParams();
  const memoId = searchParams.get("memo_id");
  const [newExpense, setNewExpense] = useState({
    item_list_id: "",
    item_name: "",
    unit_cost: "",
    quantity: "",
  });
  const [form, setForm] = useState({
    query_type: "update",
    date: moment().format("YYYY-MM-DD"),
    recipient: "Managing Director",
    raise_by: user.fullname || user.username,
    status: "",
    from_name: "",
    subject: "",
    purpose: "",
    expenses: [],
    total: 0, // Initialize total to 0
  });

  const [errors, setErrors] = useState({
    from_name: "",
    subject: "",
    purpose: "",
    expenses: "",
  });

  const navigate = useNavigate();

  // Fetch memo details and expenses based on memo_id
  useEffect(() => {
    if (memoId) {
      // Fetch memo details
      _fetchApi(
        `/account/get-memo-by-id/${activeBusiness.id}/returned?memo_id=${memoId}`,
        (data) => {
          if (data.success) {
            const memoData = data.results[0];
            setForm({
              date: moment(memoData.date).format("YYYY-MM-DD"),
              recipient: memoData.recipient,
              raise_by: memoData.raise_by,
              from_name: memoData.from_name,
              subject: memoData.subject,
              purpose: memoData.purpose,
              memo_id: memoData.memo_id,
              status: memoData.status,
              total: memoData.total || 0, // Set initial total from fetched data
              expenses: memoData.expenses || [], // Initialize with empty array if no expenses
            });

            // Fetch expenses using _postApi
            _postApi(
              "/account/memo-item-list",
              {
                query_type: "select",
                memo_id: memoId, // Use the memoId from the URL
                date: moment().format("YYYY-MM-DD"),
                user_id: user.id,
              },
              (res) => {
                if (res.success) {
                  //   alert(JSON.stringify(res.results));
                  setExpenses(res.results);
                  setForm((prevForm) => ({
                    ...prevForm,
                    expenses: res.results,
                  }));
                } else {
                  toast.error("Failed to fetch expenses.");
                }
              },
              (err) => {
                toast.error("Error fetching expenses.");
                console.error(err);
              }
            );
          } else {
            toast.error("Failed to fetch memo details.");
          }
        },
        (err) => {
          console.error(err);
          toast.error("Error fetching memo details.");
        }
      );
    }
  }, [memoId, activeBusiness.id, user.id]);

  // Calculate total expenses whenever the expenses array changes
  useEffect(() => {
    const total = expenses.reduce(
      (sum, expense) => sum + expense.unit_cost * expense.quantity,
      0
    );
    setForm((prev) => ({ ...prev, total })); // Update the form's total field
  }, [expenses]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.from_name) newErrors.from_name = "Branch is required";
    if (!form.subject) newErrors.subject = "Subject is required";
    if (!form.purpose) newErrors.purpose = "Purpose is required";
    if (expenses.length === 0)
      newErrors.expenses = "At least one expense is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const allowedFileTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const onFileChange = (event) => {
    const file = event.target.files[0];

    if (file) {
      if (!allowedFileTypes.includes(file.type)) {
        setFileError(
          "Invalid file type. Please upload an image, PDF, or Word document."
        );
        setSelectedFile(null);
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setFileError("File size exceeds 5MB. Please upload a smaller file.");
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setFileError("");
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const handleAddExpense = () => {
    if (newExpense.item_name && newExpense.unit_cost && newExpense.quantity) {
      setExpenses((prev) => [...prev, newExpense]);
      setNewExpense({ item_name: "", unit_cost: "", quantity: "" });
    }
  };

  const handleEditExpense = (index) => {
    setEditIndex(index);
    setEditExpense(expenses[index]);
  };

  const handleSaveEdit = (index) => {
    if (
      !editExpense.item_name ||
      !editExpense.unit_cost ||
      !editExpense.quantity
    ) {
      toast.error("Please fill all fields for the expense.");
      return;
    }

    const updatedExpenses = [...expenses];
    updatedExpenses[index] = editExpense;
    setExpenses(updatedExpenses);
    setEditIndex(null);
    setEditExpense({});
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
    setEditExpense({});
  };

  const handleDeleteExpense = (index) => {
    setExpenses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    // const formData = new FormData();
    // formData.append("query_type", "update");
    // formData.append("date", form.date);
    // formData.append("recipient", form.recipient);
    // formData.append("raise_by", form.raise_by);
    // formData.append("from_name", form.from_name);
    // formData.append("subject", form.subject);
    // formData.append("purpose", form.purpose);
    // formData.append("expenses", JSON.stringify(expenses));
    // formData.append("total", form.total); // Use the updated total from the form
    // formData.append("memo_id", memoId);
    // formData.append("user_id", user.id);
    // formData.append("prefix", activeBusiness.prefix);
    // if (selectedFile) {
    //   formData.append("file", selectedFile);
    // }
    console.log(form);

    _postApi(
      "/account/update-memo",
      {
        ...form,
        expenses,
        status: "pending",
        role: user.role,
        name: user.fullname,
        user_id: user.id,
      },
      (res) => {
        if (res.success) {
          toast.success(`${res.message}`);
          navigate(-1);
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    _fetchApi(
      `/branches/get?facilityId=${activeBusiness.id}&query_type=list`,
      (data) => {
        if (data.success) {
          setStores(data.results.map((store) => store.branch_name));
        }
      }
    );
  }, [activeBusiness.id]);

  return (
    <Container>
      <Row>
        <Col md={6}>
          <CustomButton
            size="sm d-flex align-items-center"
            color="primary"
            className="mb-2"
            onClick={() => navigate(-1)}
          >
            <ArrowBigLeft size={16} />
            Back
          </CustomButton>
        </Col>
      </Row>
      <CustomCard header="Edit Memo">
        <CardBody>
          <Row>
            <Col md={6}>
              <Label>Date</Label>
              <Input type="date" name="date" value={form.date} disabled />
            </Col>
            <Col md={6}>
              <Label>Recipient</Label>
              <Input
                type="text"
                name="recipient"
                value={form.recipient}
                disabled
              />
            </Col>
            <Col md={6} className="mt-2">
              <Label>Sender</Label>
              <Input
                type="text"
                name="raise_by"
                value={form.raise_by}
                disabled
              />
            </Col>
            <Col md={6} className="mt-2">
              <Label>Warehouse</Label>
              <Typeahead
                id="single-select-typeahead"
                size="sm"
                className="col-md-12 pl-0 pr-0 custom-typeahead-border"
                options={stores.map((store) => ({ name: store }))}
                placeholder="Select warehouse..."
                onChange={(selectedItems) => {
                  if (selectedItems.length > 0) {
                    setForm((prev) => ({
                      ...prev,
                      from_name: selectedItems[0].name,
                    }));
                    setErrors((prev) => ({ ...prev, from_name: "" }));
                  } else {
                    setErrors((prev) => ({
                      ...prev,
                      from_name: "Branch is required",
                    }));
                  }
                }}
                selected={form.from_name ? [{ name: form.from_name }] : []}
                labelKey="name"
                isInvalid={!!errors.from_name}
              />
              {errors.from_name && (
                <span className="text-danger">{errors.from_name}</span>
              )}
            </Col>
            <Col md={12} className="mt-2">
              <Label>Subject</Label>
              <Input
                name="subject"
                value={form.subject}
                onChange={handleChange}
                invalid={!!errors.subject}
              />
              {errors.subject && (
                <span className="text-danger">{errors.subject}</span>
              )}
            </Col>
            <Col md={12} className="mt-2">
              <Label>Purpose</Label>
              <Input
                type="textarea"
                name="purpose"
                value={form.purpose}
                onChange={handleChange}
                invalid={!!errors.purpose}
              />
              {errors.purpose && (
                <span className="text-danger">{errors.purpose}</span>
              )}
            </Col>
          </Row>
          <Label className="mt-3 d-flex justify-content-between">
            Expense Details
            <div className="ml-auto">
              Sum total:
              <span style={{ fontWeight: "bold", marginLeft: 5 }}>
                {formatNumber1(form.total)}
              </span>
            </div>
          </Label>
          {errors.expenses && (
            <span className="text-danger">{errors.expenses}</span>
          )}
          <Table responsive>
            <thead>
              <tr>
                <th>Item</th>
                <th>Unit Cost</th>
                <th>Quantity</th>
                <th>Total Cost</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <Input
                    name="item"
                    value={newExpense.item_name}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        item_name: e.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    name="unit_cost"
                    value={newExpense.unit_cost}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        unit_cost: Number(e.target.value),
                      })
                    }
                  />
                  <div className="text-gray-700 mb-1 text-right">
                    {formatNumber1(newExpense.unit_cost)}
                  </div>
                </td>
                <td>
                  <Input
                    type="number"
                    name="quantity"
                    value={newExpense.quantity}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        quantity: Number(e.target.value),
                      })
                    }
                  />
                  <div className="text-gray-700 mb-1 text-right">
                    {formatNumber1(newExpense.quantity)}
                  </div>
                </td>
                <td className="text-right">
                  {formatNumber1(
                    newExpense.unit_cost * newExpense.quantity || 0
                  )}
                </td>
                <td>
                  <div className="d-flex justify-content-center">
                    <CustomButton
                      size="sm"
                      onClick={handleAddExpense}
                      className="mx-auto"
                    >
                      <MdAdd size="20" />
                    </CustomButton>
                  </div>
                </td>
              </tr>

              {expenses.map((expense, index) => (
                <tr key={index}>
                  {editIndex === index ? (
                    <>
                      <td>
                        <Input
                          value={editExpense.item_name}
                          onChange={(e) =>
                            setEditExpense({
                              ...editExpense,
                              item_name: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          value={editExpense.unit_cost}
                          onChange={(e) =>
                            setEditExpense({
                              ...editExpense,
                              unit_cost: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          value={editExpense.quantity}
                          onChange={(e) =>
                            setEditExpense({
                              ...editExpense,
                              quantity: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        {formatNumber1(
                          editExpense.unit_cost * editExpense.quantity || 0
                        )}
                      </td>
                      <td>
                        <CustomButton
                          size="sm"
                          onClick={() => handleSaveEdit(index)}
                        >
                          Save
                        </CustomButton>
                        <CustomButton
                          size="sm"
                          color="danger"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </CustomButton>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{expense.item_name}</td>
                      <td className="text-right">
                        {formatNumber1(expense.unit_cost)}
                      </td>
                      <td className="text-right">{expense.quantity}</td>
                      <td className="text-right">
                        {formatNumber1(expense.unit_cost * expense.quantity)}
                      </td>
                      <td className="d-flex justify-content-center">
                        <CustomButton
                          size="sm"
                          onClick={() => handleEditExpense(index)}
                        >
                          <FaEdit size="20" />
                        </CustomButton>
                        <div className="px-1"></div>
                        <CustomButton
                          size="sm"
                          color="danger"
                          onClick={() => handleDeleteExpense(index)}
                        >
                          <MdDelete size="20" />
                        </CustomButton>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>

          <Col md={12} className="pb-3 mt-2">
            <Label>
              Attach Document{" "}
              <span style={{ fontSize: 10 }} className="text-secondary">
                (Optional, Max 5MB)
              </span>
            </Label>
            <input
              type="file"
              onChange={onFileChange}
              accept=".jpg, .png, .jpeg, .pdf, .docx"
              className="form-control"
              disabled={selectedFile !== null}
            />
            {fileError && <p className="text-danger mt-1">{fileError}</p>}
            {selectedFile && (
              <div className="mt-2">
                <p className="mb-1">
                  <strong>Selected File:</strong> {selectedFile.name}
                </p>
                <CustomButton color="danger" size="sm" onClick={removeFile}>
                  Remove File
                </CustomButton>
              </div>
            )}
          </Col>
          <center>
            <CustomButton
              loading={loading}
              className="mt-3"
              onClick={handleSubmit}
            >
              Update Memo
            </CustomButton>
          </center>
        </CardBody>
      </CustomCard>
    </Container>
  );
}
