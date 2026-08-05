// const PuchaseField =(form,setForm,setupCond,itemCategory,uom)=>{
//     return  [
//         {
//           label: "Supplier Name",
//           name: "supplier_name",
//           type: "custom",
//           component: () => (
//             <SearchSupplierInput
//               label="Supplier Name"
//               onChange={(s) =>
//                 setForm((p) => ({
//                   ...p,
//                   supplier_name: s.name,
//                   supplier_code: s._id,
//                 }))
//               }
//             />
//           ),
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.supplier_name ? false : true,
//         },
//         {
//           label: "Item Category",
//           labelkey: "item",
//           name: "itemCategory",
//           options: [{ item: "--select item name--" }, { item: "Item" }],
//           value: itemCategory,
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.itemCategory ? false : true,
//         },
//         {
//           label: "Item Name",
//           name: "item_name",
//           type: "custom",
//           component: () => (
//             <SearchItemInput
//               labelkey="item_name"
//               label="Item Name"
//               allowNew={true}
//               onInputChange={(v) =>
//                 setForm((p) => ({
//                   ...p,
//                   item_name: v.item_name,
//                 }))
//               }
//               onChange={(v) =>
//                 setForm((p) => ({
//                   ...p,
//                   item_name: v.item_name,
//                 }))
//               }
//             />
//           ),
//           col: 3,
//         },
//         {
//           label: "Unit of Measurement",
//           labelkey: "label",
//           options: [{ label: "--unit--" }, { label: "Other" }],
//           name: "uom",
//           value: uom,
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.uom ? false : true,
//         },
//         {
//           label: "Bar code",
//           name: "bar_code",
//           value: form.bar_code,
//           col: 3,
//           type: "text",
//           // show: setUp.uom ? false : true,
//         },
//         { label: "Cost Price", type: "number", name: "cost", value: cost, col: 3 },
//         {
//           label: "Quantity",
//           type: "number",
//           name: "quantity",
//           placeholder: "QTY",
//           value: quantity,
//           col: 3,
//         },
//         {
//           label: "Selling Price",
//           type: "number",
//           name: "selling_price",
//           value: selling_price,
//           col: 3,
//         },
//         {
//           label: "Reorder Level",
//           type: "number",
//           name: "reorder",
//           value: reorder,
//           placeholder: "0",
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.reorder ? false : true,
//         },
//         {
//           label: "Expiry Date",
//           type: "date",
//           name: "expiry_date",
//           value: expiry_date,
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.expiry_date ? false : true,
//         },
//         {
//           label: "Mode Of Payment",
//           type: "select",
//           options: Object.values(MODES_OF_PAYMENT),
//           name: "modeOfPayment",
//           value: modeOfPayment,
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.modeOfPayment ? false : true,
//         },
    
//         // {
//         //   label: "Source Account",
//         //   type: form.source_account.length>0?'text': "select",
//         //   options: bankList && bankList.length>0?bankList.map(b=>`${b.bank_name}(${b.acctNo})`):[],
//         //   name: "source_account",
//         //   value: source_account,
//         //   col: 3,
//         //   switch: setupCond ? true : false,
//         //   show: modeOfPayment.toLowerCase()==='bank transfer' ? false: true
//         // },
//         // {
//         //   label: "Payment Account",
//         //   type: form.bank && form.bank.length?'text':"select",
//         //   options:supplierList && supplierList.filter(spl=>spl.name===form.supplier_name)[0]?.element?.map(a=>`${a.bank_name}(${a.acctNo})`),
//         //   name: "bank",
//         //   value: bank,
//         //   col: 3,
//         //   switch: setupCond ? true : false,
//         //   show: modeOfPayment.toLowerCase()==='bank transfer' ? false: true
//         // },
//         {
//           label: "Received to",
//           type: "custom",
//           component: () => (
//             <SearchStoresInput
//               label="Received to"
//               onChange={(s) =>
//                 setForm((p) => ({
//                   ...p,
//                   receivedTo: s.storeName,
//                   storeId: s._id,
//                 }))
//               }
//             />
//           ),
//           name: "receivedTo",
//           value: receivedTo,
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.receivedTo ? false : true,
//         },
//         {
//           label: "Truck No.",
//           name: "truckNo",
//           value: truckNo,
//           placeholder: "Enter truck number",
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.truckNo ? false : true,
//         },
//         {
//           label: "Waybill No.",
//           name: "waybillNo",
//           value: waybillNo,
//           placeholder: "Enter truck number",
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.waybillNo ? false : true,
//         },
//         {
//           label: "Other Details",
//           name: "otherDetails",
//           size: 4,
//           value: otherDetails,
//           placeholder: "Other details if any...",
//           col: 3,
//           switch: setupCond ? true : false,
//           // show: setUp.otherDetails ? false : true,
//         },
//       ];
// }