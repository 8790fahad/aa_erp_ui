import bankLocal, { remotebank } from "../../pouchdb/addBank";
import { v4 as UUIDV4 } from "uuid";

import { SYNC_STARTED, SET_NEW_BANK_NEW } from "./actionTypes";
import store from "../store";

const TAG = "CHECK";

export const saveNewbank = (
  obj = {},
  callback = (f) => f,
  error = (f) => f,
) => {
  const user = store.getState().auth.user;
  let uuid = UUIDV4();
  obj._id = uuid;
  obj.createdAt = new Date().toISOString();
  obj.facilityID = user.facilityId;
  obj.userId = user.id;

  bankLocal
    .put(obj)
    .then((resp) => {
      console.log("bank created successfully");
      pushbankChanges(() => pullbankChanges());
      callback();
    })
    .catch((err) => {
      console.log("Error: ", err);
      error(err);
    });
};

export const getbank = (callback = (f) => f, error = (f) => f) => {
  return (dispatch) => {
    let facilityId = store.getState().auth.activeBusiness.id;
    // console.log(facilityId, 'wwwwwwww');
    bankLocal
      .createIndex({ index: { fields: ["facilityID", "createdAt"] } })
      .then(() => {
        return bankLocal.find({
          selector: {
            facilityID: {
              $eq: facilityId,
            },
            createdAt: {
              $gt: null,
            },
          },
        });
      })
      .then((resp) => {
        let data = resp.docs;
        console.log(
          data,
          "======================================================,,",
        );
        callback(data);
        dispatch({ type: SET_NEW_BANK_NEW, payload: data });
      })
      .catch((err) => {
        error(err);
        console.log(err);
      });
  };
};

export const updatebank = (
  id = "",
  data = {},
  callback = (f) => f,
  error = (f) => f,
) => {
  bankLocal
    .put(data)
    .then((resp) => {
      callback();
      console.log("Successfully updated bank info", resp);
    })
    .catch((err) => {
      console.log("Error: ", err);
      error(err);
    });
};

export const syncbank = () => {
  return (dispatch) => {
    dispatch({ type: SYNC_STARTED });

    let opts = { live: true, retry: true };

    const onSyncChange = (info) => {
      console.log(TAG, "bank_DB sync onChange", info);
    };

    const onSyncPaused = (err) => {
      console.log(TAG, "bank_DB sync onPaused", err);
    };

    const onSyncError = (err) => {
      console.log(TAG, "bank_DB sync onError", err);
    };

    // do one way, one-off sync from the server until completion
    bankLocal.replicate
      .from(remotebank)
      .on("complete", function (info) {
        console.log("one way replication completed", info);
        // then two-way, continuous, retriable sync
        bankLocal
          .sync(remotebank, opts)
          .on("change", onSyncChange)
          .on("paused", onSyncPaused)
          .on("error", onSyncError);
      })
      .on("error", onSyncError);
  };
};

export const pushbankChanges = (onComplete = (f) => f) => {
  console.log("start pushing bank updates");
  bankLocal.replicate
    .to(remotebank)
    .on("complete", (info) => {
      console.log("pushed changes to bank");
      console.log(info);
      onComplete();
    })
    .on("error", (err) => {
      console.log("error pushing changes to bank db", err);
    });
};

export const pullbankChanges = (onComplete = (f) => f) => {
  console.log("start pulling bank updates");
  bankLocal.replicate
    .from(remotebank)
    .on("complete", (info) => {
      console.log("pushed changes to bank");
      console.log(info);
      onComplete();
    })
    .on("error", (err) => {
      console.log("error pushing changes to bank db", err);
    });
};
