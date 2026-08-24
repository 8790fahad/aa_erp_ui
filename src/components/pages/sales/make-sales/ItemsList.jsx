/* eslint-disable react/prop-types */
import ItemAvatar from "./ItemAvatar";
import { formatNumber1 } from "@/components/router/utilities";

function ItemsList({
  list = [],
  selectItem = (f) => f,
  filterText = "",
  onPriceChange = (f) => f,
  selectedItem = null,
  getItemKey = (f) => f,
}) {
  // const [filterText, setFilterText] = useState("");
  // const rows = [];

  list
    ?.filter((i) => i.balance > 0)
    ?.forEach((item) => {
      if (
        item.item_name &&
        item.item_name.toLowerCase().indexOf(filterText.toLowerCase()) === -1
      )
        return;

      // rows.push(item);
    });

  return (
    <div>
      {/* <SearchBar
        placeholder="Search for items by code or name"
        filterText={filterText}
        onFilterTextChange={setFilterText}
      /> */}
      {/* {JSON.stringify({ rows })} */}

      <div style={{ height: "65vh", overflow: "scroll" }}>
        <div className="row m-0 p-0 d-flex flex-wrap gap-2">
          {list.map((item, i) => (
            <>
              {/* {JSON.stringify(item)} */}
              <Item
                key={i}
                item={item}
                selectItem={selectItem}
                onPriceChange={onPriceChange}
                selectedItem={selectedItem}
                getItemKey={getItemKey}
              />
            </>
          ))}
        </div>
        {/* <Table bordered size="sm">
          <thead>
            <tr>
              <th className='text-center'>Item </th>
              <th className='text-center'>Qty Available </th>
              <th className='text-center'>Price</th>
              <th className='text-center'>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => {
              let selling_price =
                parseFloat(item.cost) + parseFloat(item.markup);
              return (
                <tr key={i}>
                  <td>{item.item_name}</td>
                  <td className='text-right'>{formatNumber(item.quantity)}</td>
                  <td className='text-right'>{formatNumber(selling_price)}</td>
                  <td className="text-center">
                    <Button
                      color="primary"
                      size="sm"
                      // onClick={() => setHide(false)}
                      className="m-1"
                    >
                      <FaStreetView size="20" />
                      View
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
       */}
      </div>
    </div>
  );
}

function Item({
  item = {},
  selectItem = (f) => f,
  onPriceChange = (f) => f,
  selectedItem = null,
  getItemKey = (f) => f,
}) {
  const isService = item.item_type === "Service";
  const isSelected =
    selectedItem && getItemKey(selectedItem) === getItemKey(item);

  const handlePriceChange = (e) => {
    e.stopPropagation(); // Prevent card click
    const newPrice = parseFloat(e.target.value) || 0;
    onPriceChange(item.id, newPrice);
  };

  return (
    <div
      className="card card-body p-0 col-md-4 col-sm-6 col-lg-3"
      style={{
        cursor: "pointer",
        border: isSelected ? "3px solid var(--aa-navy)" : "1px solid #dee2e6",
        transform: isSelected ? "scale(1.02)" : "scale(1)",
        transition: "all 0.2s ease-in-out",
        boxShadow: isSelected
          ? "0 4px 8px rgba(0,123,255,0.3)"
          : "0 2px 4px rgba(0,0,0,0.1)",
      }}
      onClick={() => selectItem(item)}
    >
      {/* {JSON.stringify(item)} */}
      <div className="p-1 border border-bottom-primary d-flex justify-content-center align-items-center">
        <ItemAvatar item={item} value={item.item_name} />
      </div>
      <div className="p-1">
        <div className="font-weight-bold text-center">
          {item.item_name} {item.multiplier_type}
        </div>

        {isService ? (
          <div className="text-center">
            <input
              type="number"
              className="form-control form-control-sm text-center"
              value={item.selling_price || ""}
              onChange={handlePriceChange}
              placeholder="Enter price"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: "12px", marginBottom: "5px" }}
            />
          </div>
        ) : (
          <div className="font-weight-bold text-center">
            ₦ {formatNumber1(item.selling_price)}
          </div>
        )}

        {!isService && (
          <div className="text-center">
            {item.balance} {item.uom} available
          </div>
        )}
        {/* <CustomButton size="sm">Select</CustomButton> */}
      </div>
    </div>
  );
}

export default ItemsList;
