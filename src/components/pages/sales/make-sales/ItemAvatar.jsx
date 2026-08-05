// import purchaseLocal from "@/pouchdb/purchase_db";
import React, { useEffect, useState } from "react";


function ItemAvatar({ item, value = "" }) {
  const [imageUrl, setImageUrl] = useState(null);
  const getItemInitials = (val) => {
    let splitted = val.split(" ");
    let first = splitted.length
      ? splitted[0].replace(/(|)/g, "").substr(0, 1).toUpperCase()
      : "";
    let second =
      splitted.length > 1
        ? splitted[1].replace(/(|)/g, "").substr(0, 1).toUpperCase()
        : "";

    return first + second;
  };

  // useEffect(() => {
  //   // console.log(item._id)
  //   if (item._attachments) {
  //     purchaseLocal
  //       .getAttachment(item._id, item.item_name)
  //       .then((blob) => {
  //         // console.log(blob);
  //         // let type = blob.type.split('/')[1]

  //         // let url = URL.createObjectURL(blob)

  //         //   let reader = new FileReader()
  //         //   reader.onloadend = () => {
  //         //     //   console.log()
  //         //     setImageUrl(reader.result)
  //         //   }

  //         //   reader.readAsDataURL(blob)

  //         // let url = `data:${blob.type};base64, ${blob}`;
  //         let url = URL.createObjectURL(blob);
  //         setImageUrl(url);
  //       })
  //       .catch((err) => console.log(err, item.item_name));
  //   }
  // }, [item._attachments, item._id, item.item_name]);

  const styles = {
    text: {
      fontSize: "3rem",
      textAlign: "center",
    },
    image: {
      height: "9rem",
      width: "9rem",
    },
  };

  return (
    <div>
      {/* {JSON.stringify(imageUrl)} */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="item-avatar"
          // className="img-responsive"
          style={styles.image}
        />
      ) : (
        <div
          style={styles.image}
          className="d-flex flex-direction-row align-items-center justify-content-center"
        >
          <span style={styles.text}>{getItemInitials(value)}</span>
        </div>
      )}
      {/* <img
        src={require("../../../images/sample-item.jpg")}
        alt="item-avatar"
        className="img-fluid"
      /> */}
    </div>
  );
}

export default ItemAvatar;
