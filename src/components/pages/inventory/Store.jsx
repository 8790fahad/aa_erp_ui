/* eslint-disable no-unused-vars */

import CustomCard from "@/common/Custom/CustomCard2";
import { formatNumber } from "@/components/router/utilities";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { getPurchasedItems } from "@/redux/actions/purchase";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Col,
  Container,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
} from "reactstrap";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send } from "lucide-react";
import { EditItemDialog } from "./EditDialog";
import { toast } from "sonner";
import { FaSearch } from "react-icons/fa";

export default function Store() {
  const user_id = useSelector((state) => state.auth.user);
  const { activeBusiness = {} } = useSelector((state) => state.auth);
  const itemList = useSelector((state) => state.purchase.purchaseList);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStore, setActiveStore] = useState(user_id.branch_name);
  const [sendModal, setSendModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [stores, setStores] = useState([]);
  const [transfer, setTransfer] = useState({});

  const dispatch = useDispatch();

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSaveChanges = (data) => {
    _postApi(
      "/inventory/edit-item",
      data,
      (data) => {
        if (data.success) {
          dispatch(getPurchasedItems(activeStore));
          toaster.success("Item updated successfully");
        }
      },
      (err) => {
        console.error(err);
      }
    );
  };
  const handleSendItem = (data) => {
    _postApi(
      "/inventory/transfer-item",
      data,
      (data) => {
        if (data.success) {
          setTransfer({});
          setSendModal(false);
          // dispatch(getPurchasedItems(activeStore));
          toaster.success("Item updated successfully");
        }
      },
      (err) => {
        console.error(err);
      }
    );
  };
  const getChartOfAccount = useCallback(() => {
    if (!activeBusiness?.business_name) return;

    _fetchApi(
      `/account/get-account-by-category/sales`,
      (resp) => {
        if (resp.success) {
          setStores(resp.results);
        } else {
          //   toast.error("Failed to load chart data.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        // toast.error("Something went wrong while fetching data.");
      }
    );
  }, [activeBusiness.business_name]);
  useEffect(() => {
    getChartOfAccount();
  }, [getChartOfAccount]);

  const toggleSendModal = useCallback(
    (item) => {
      setSelectedItem(item);
      setTransfer({
        transfer_name: item.item_name,
        transfer_code: item.item_code,
        transfer_subhead: item.subhead,
        cost_price: item.cost_price,
      });
      setSendModal(!sendModal);
    },
    [sendModal]
  );

  useEffect(() => {
    dispatch(getPurchasedItems(activeStore));
  }, [dispatch, activeStore]);

  // useEffect(() => {
  //   _fetchApi(
  //     `/branches/get?facilityId=${activeBusiness.id}&query_type=list`,
  //     (data) => {
  //       if (data.success) {
  //         setStores(
  //           data.results.map((store) => ({
  //             branch_id: store.branch_id,
  //             branch_name: store.branch_name,
  //           }))
  //         );
  //       }
  //     }
  //   );
  // }, [activeBusiness.id, toggleSendModal]);

  const filteredData = itemList.filter((item) =>
    item.item_name?.toLowerCase().includes(searchTerm?.toLowerCase())
  );

  return (
    <Container>
      <CustomCard header="Store">
        {/* {JSON.stringify(itemList)} */}

        <Row className="mb-3">
          <Col md={6} sm={8}>
            <div style={{ position: "relative", width: "100%" }}>
              <FaSearch
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#888",
                }}
              />
              <Input
                type="text"
                placeholder="Search store item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: "30px" }}
              />
            </div>
          </Col>

          {/* <Col md={6} sm={4} className="pr-2 d-flex justify-content-end">
            <CustomButton
              size="sm"
              className="m-1"
              onClick={() => {
                navigate("batch");
              }}
            >
              <b>Batch processing</b>
            </CustomButton>
          </Col> */}
        </Row>
        {/* {JSON.stringify(transfer)} */}
        <div className="rounded-md border ">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">SN</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Reference No</TableHead>
                <TableHead className="text-right">Cost Price (₦)</TableHead>
                {/* <TableHead className="text-center">Markup (₦)</TableHead> */}
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Date Added</TableHead>
                <TableHead className="text-center w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-center font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>{item.reference_number}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.cost_price || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatNumber(item.balance)}
                    </TableCell>
                    {/* <TableCell className="text-right">
                      {formatNumber(item.selling_price || 0)}
                    </TableCell> */}
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          item.status == "for sale" ? "success" : "outline"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {moment(item.created_at).format("DD-MMM-YYYY")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center space-x-2">
                        {/* <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="bg-[#4267B2] hover:bg-[#4267B2] border-none"
                                onClick={() => handleOpenDialog(item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit Item</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider> */}

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="bg-[#4267B2] hover:bg-[#4267B2] border-none"
                                onClick={() => toggleSendModal(item)}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Send Item</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CustomCard>

      <EditItemDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedItem={selectedItem}
        onSave={handleSaveChanges}
      />

      <Modal isOpen={sendModal} toggle={toggleSendModal}>
        {/* {JSON.stringify(transfer)} */}
        <ModalHeader toggle={toggleSendModal}>Send Item</ModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <Label>Transfer Item</Label>
              <Input type="text" disabled value={selectedItem?.item_name} />

              {/* <Typeahead
                id="single-select-typeahead"
                size="md"
                className="col-md-12 pl-0 pr-0 custom-typeahead-border"
                options={stores}
                placeholder="Select warehouse..."
                onChange={(selectedItems) =>
                  setTransfer((prev) => ({
                    ...prev,
                    branch_id: selectedItems[0]?.branch_id || "",
                    branch: selectedItems[0]?.branch_name || "",
                  }))
                }
                selected={
                  setTransfer.branch_id
                    ? [
                        {
                          branch_id: setTransfer.branch_id,
                          branch_name: setTransfer.branch,
                        },
                      ]
                    : []
                }
                labelKey="branch_name"
                style={{
                  borderRadius: "7px",
                }}
              /> */}
            </FormGroup>
            <FormGroup>
              <Label>Select Item</Label>
              <Typeahead
                id="material-typeahead"
                // ref={inputRef}
                options={stores.filter((i) =>
                  i.description
                    ?.toLowerCase()
                    .includes(selectedItem?.item_name?.toLowerCase())
                )}
                className="z-100"
                placeholder="Select product..."
                onChange={(selected) =>
                  setTransfer((prev) => ({
                    ...prev,
                    product_name: selected[0]?.description || "",
                    product_code: selected[0]?.head || "",
                    product_subhead: selected[0]?.subhead || "",
                  }))
                }
                labelKey={(option) =>
                  `${option.description} - (${option.head})`
                }
              />
            </FormGroup>

            <FormGroup>
              <Label
                for="quantity"
                className="flex justify-between items-center"
              >
                Quantity To Send
                <span className="text-muted-foreground text-xs">
                  Available: ({selectedItem?.balance - transfer?.quantity || 0})
                </span>
              </Label>
              <Input
                type="number"
                id="quantity"
                max={selectedItem?.balance}
                placeholder="Enter quantity"
                value={setTransfer.quantity}
                onChange={(e) =>
                  setTransfer((prev) => ({
                    ...prev,

                    quantity: e.target.value,
                  }))
                }
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={() => handleSendItem(transfer)}>
            Send
          </Button>{" "}
          <Button color="secondary" onClick={toggleSendModal}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </Container>
  );
}
