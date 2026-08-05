import React, { useCallback, useEffect, useState } from "react";
import CustomCard from "../../../common/Custom/CustomCard"
import {
  Alert,
  Badge,
  Button,
  CardBody,
  Col,
  Collapse,
  Input,
  Label,
  Row,
} from "reactstrap";
import CustomTable from "../../../common/Custom/CustomTable";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "../../redux/actions/api";
import { GiCancel } from "react-icons/gi";
import { FaCheck, FaEdit, FaEye, FaViber } from "react-icons/fa";
import CustomButton from "../../app/components/Button";
import moment from "moment";
import CustomModal from "../../../common/Custom/CustomModal";
import { View, Text } from "@react-pdf/renderer";
import Loading from "../../app/components/Loading";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function InitiateMemo() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [memos, setMemos] = useState([]);
  const [items, setItems] = useState({});
  const [items2, setItems2] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [isOpen2, setIsOpen2] = useState(false);
  const [isOpen3, setIsOpen3] = useState(false);
  const [selectedMemoId, setSelectedMemoId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState([]);

  const toggleCollapse = (memoId) => {
    setSelectedMemoId(memoId);
    setIsOpen3(!isOpen3);
    getLogs(memoId);
  };

  const _form = {
    date: moment().format("YYYY-MM-DD"),
    purpose: "",
    from: "",
  };
  const [form, setForm] = useState(_form);

  const getMemos = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/account/get-memo/${activeBusiness.id}/pending/${user.id}/others`,
      (data) => {
        setLoading(false);
        if (data.success) {
          setMemos(data.results);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, user.id]);

  useEffect(() => {
    getMemos();
  }, [getMemos]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleEdit = () => {
    setLoading2(true);
    _postApi(
      "/account/update-memo",
      {
        ...form,
        logStatus: "approved",
      },
      (res) => {
        if (res.success) {
          toast.success("Successfully Submit");
          setLoading2(false);
          navigate(-1);
        }
      },
      (err) => {
        toast.error("error occurred");
        console.log(err);
        setLoading2(false);
      }
    );
  };

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const toggle2 = (item) => {
    setItems2(item);
    setForm((p) => ({
      ...p,
      purpose: item.purpose,
      from: item.from_name,
      busName: item.from_name,
      memo_id: item.memo_id,
    }));
    setIsOpen2(!isOpen2);
  };

  const cancel = () => {
    setItems({});
    setIsOpen(!isOpen);
  };

  const navigate = useNavigate();

  return (
    <CustomCard header="Initiate Memo">
      <div className="d-flex align-items-center justify-content-between">
        <CustomButton
          size="sm"
          color="primary"
          className="mb-2"
          onClick={() => {
            navigate("/app/account/memo");
          }}
        >
          Add new memo
        </CustomButton>
        <span className="d-flex justify-content-end align-items-center gap-2 mb-2 ml-auto">
          <Label for="searchFilter" className="mb-0 mr-2">
            Search:
          </Label>
          <Input
            id="searchFilter"
            type="text"
            bsSize="sm"
            placeholder="Search by warehouse name or memo ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </span>
      </div>
    </CustomCard>
  );
}

export default InitiateMemo;





// {formatNumber1(
//                             parseInt(items.amount) === 0
//                               ? items.total
//                               : items.amount
//                           )}