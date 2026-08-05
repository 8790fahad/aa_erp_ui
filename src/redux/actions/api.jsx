/* eslint-disable no-redeclare */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import store from "../store";

// let remoteEndpoint = "http://localhost:42843";
let remoteEndpoint = "https://server.brainstorm.ng/inventria_new";
let localEndpoint = "http://localhost:42843";
// let remoteEndpoint = "https://server.brainstorm.ng/inventria_new";
// let localEndpoint = "http://192.168.1.87:42844"
export const ipAddr = "127.0.0.1";
export const apiURL =
  process.env.NODE_ENV === "production" ? remoteEndpoint : localEndpoint;

// API posting
const _postApi = (
  url,
  data = {},
  success = (f) => f,
  error = (f) => f,
  method = "POST",
) => {
  // const _postApi = (url, data = {}, success = (f) => f, error = (f) => f) => {
  const token = localStorage.getItem("@@__token");
  const facilityId = store.getState().auth.activeBusiness?.id;
  const isArrayBody = Array.isArray(data);
  const bodyPayload = isArrayBody
    ? data
    : { ...data, ...(facilityId ? { facilityId } : {}) };
  fetch(`${apiURL}${url}`, {
    method: method,
    headers: { "Content-Type": "application/json", authorization: token },
    body: JSON.stringify(bodyPayload),
  })
    .then(async (res) => {
      let response = {};
      try {
        response = await res.json();
      } catch (_) {
        response = {};
      }

      const apiMessage =
        response?.error ||
        response?.message ||
        (typeof response?.err === "string" ? response.err : response?.err?.message);

      if (!res.ok) {
        error({
          ...response,
          message: apiMessage || `Request failed (${res.status})`,
        });
        return;
      }

      if (response && response.success === false) {
        error({
          ...response,
          message: apiMessage || "Request failed",
        });
        return;
      }

      success(response);
    })
    .catch((err) => error(err));
};
// posting ends here

// API fetching
const _fetchApi = (
  url,
  success = (f) => f,
  error = (f) => f,
  empty = (f) => f,
) => {
  const token = localStorage.getItem("@@__token");
  fetch(`${apiURL}${url}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", authorization: token },
  })
    .then((raw) => raw.json())
    .then((response) => {
      if (response) {
        success(response);
      } else {
        console.log("Empty response");
        empty();
      }
    })
    .catch((err) => {
      error(err);
    });
};
// fetching ends here

// API delete function
const _deleteApi = (
  route,
  data = {},
  callback = (f) => f,
  err_cb = (f) => f,
) => {
  const token = localStorage.getItem("@@__token");
  // Convert query params if data is provided
  const queryParams = new URLSearchParams(data).toString();
  const fullUrl = `${apiURL}${route}${queryParams ? `?${queryParams}` : ""}`;

  fetch(fullUrl, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", authorization: token },
  })
    .then(async (response) => {
      const res = await response.json();

      if (!response.ok) {
        if (err_cb) err_cb(res);
        return;
      }

      if (callback) callback(res);
    })
    .catch((err) => {
      if (err_cb) err_cb(err);
    });
};
// delete function stops here

// API PUT function
const _putApi = (url, data = {}, success = (f) => f, error = (f) => f) => {
  const token = localStorage.getItem("@@__token");
  const facilityId = store.getState().auth.activeBusiness.id;
  data.facilityId = facilityId;
  fetch(`${apiURL}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", authorization: token },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((response) => {
      if (response.status >= 400) {
        error(response);
      } else success(response);
    })
    .catch((err) => error(err));
};
// PUT function stops here

// Chart of account code
function unflatten(arr) {
  var tree = [],
    mappedArr = {},
    arrElem,
    mappedElem;

  // First map the nodes of the array to an object -> create a hash table.
  for (var i = 0, len = arr?.length; i < len; i++) {
    arrElem = arr[i];
    mappedArr[arrElem.head] = arrElem;
    mappedArr[arrElem.head]["children"] = [];
  }

  // Create the tree structure by iterating over the array again.
  for (var i = 0, len = arr?.length; i < len; i++) {
    arrElem = arr[i];
    mappedElem = mappedArr[arrElem.head];

    // Add a custom property to each child containing parent head values
    const parentHeads = [];
    let currentParent = mappedElem;
    while (currentParent?.subhead) {
      parentHeads.unshift(currentParent?.subhead);
      currentParent = mappedArr[currentParent?.subhead];
    }
    const childWithProperty = { ...mappedElem, parentHeads };

    if (mappedElem?.subhead) {
      mappedArr[`parent_${i}`] = "20";
      mappedArr[mappedElem?.subhead]["children"]?.push(childWithProperty);
    } else {
      tree.push(childWithProperty);
    }
  }

  return tree;
}

export function getImageUrl(file) {
  return file;
  // return `${serverUrl}/${file}`
}

// ends here

export { _postApi, _fetchApi, _deleteApi, _putApi, unflatten };
