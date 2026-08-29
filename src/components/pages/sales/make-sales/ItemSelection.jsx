/* eslint-disable react/prop-types */
import CustomCard from "@/common/Custom/CustomCard2";
import ItemsList from "./ItemsList";
import SalesForm from "./SalesForm";
import CustomButton from "@/common/Custom/CustomButton";

function ItemSelection({
  disabled,
  form = {
    filterText: "",
  },
  addToCart = (f) => f,
  onAddToCart = (f) => f,
  selectItem = (f) => f,
  qttyRef,
  itemNameRef,
  handleChange,
  onFormChange,
  filterText,
  setFilterText,
  options,
  user_id,
  activeStore,
  setActiveStore,
  showServices,
  setShowServices,
  serviceProducts,
  readyForSalesItems,
  onServicePriceChange = (f) => f,
  selectedItem,
  onItemSelect,
  getItemKey = (f) => f,
}) {
  // const history = useHistory()
  //   const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  return (
    <CustomCard container="p-0" body="p-2" header="Sales">
      {/* {JSON.stringify(readyForSalesItems)} */}
      <>
        {/* Toggle between Products and Services */}
        <div className="mb-3">
          <div className="btn-group w-100" role="group">
            <button
              type="button"
              className={`btn ${
                showServices ? "btn-outline-primary" : "btn-primary"
              }`}
              onClick={() => setShowServices(false)}
            >
              Products ({readyForSalesItems?.length || 0})
            </button>
            <button
              type="button"
              className={`btn ${
                showServices ? "btn-primary" : "btn-outline-primary"
              }`}
              onClick={() => setShowServices(true)}
            >
              Services ({serviceProducts?.length || 0})
            </button>
          </div>
        </div>

        <SalesForm
          options={options}
          form={form}
          qttyRef={qttyRef}
          itemNameRef={itemNameRef}
          handleChange={onFormChange || handleChange}
          setFilterText={setFilterText}
          disabled={disabled}
          user_id={user_id}
          activeStore={activeStore}
          setActiveStore={setActiveStore}
        />
        <ItemsList
          filterText={filterText}
          selectItem={onItemSelect || selectItem}
          list={showServices ? serviceProducts : readyForSalesItems}
          onPriceChange={showServices ? onServicePriceChange : (f) => f}
          selectedItem={selectedItem}
          getItemKey={getItemKey}
        />
        <div className=" pt-2">
          <div
            // color="primary"
            className="btn btn-secondary"
            //   onClick={handleSubmit}
          >
            Press F10 to submit
          </div>
          {/* <button onClick={() => history.push('/app/sales/receipt-preview?transaction_id=2110163234')}>check</button> */}
          <CustomButton
            color="primary"
            className="float-right"
            onClick={onAddToCart || addToCart}
          >
            Press Enter to Add To Cart
          </CustomButton>
        </div>
      </>
      {/* ) : (
            <div>
              <h5 style={{ float: "right" }}>Total: __________</h5>

              <Table bordered size="sm">
                <thead>
                  <tr>
                    <th>Item </th>
                    <th>Qty Available </th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-center">milo</td>
                    <td className="text-center">88</td>
                    <td className="text-center">₦7678</td>
                    <td className="text-center">₦87787678</td>
                  </tr>
                </tbody>
              </Table>

              <center>
                <Button color="primary" className="mt-2">
                  Submit
                </Button>
              </center>
            </div>
          )} */}
      {/* </CardBody> */}
    </CustomCard>
  );
}

export default ItemSelection;
