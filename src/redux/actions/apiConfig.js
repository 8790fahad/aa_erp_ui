/* eslint-disable no-undef */
// Single source of truth for the API origin. This module must stay free of
// imports: it is reached from reducers during store construction, and pulling
// in `api.jsx` (which imports the store) there would create an init cycle.

// let remoteEndpoint = "http://localhost:42843";
let remoteEndpoint = "https://server.brainstorm.ng/flowbooks";
let localEndpoint = "http://localhost:42844";
// let remoteEndpoint = "https://server.brainstorm.ng/inventria_new";
// let localEndpoint = "http://192.168.1.87:42844"

export const ipAddr = "127.0.0.1";
export const apiURL =
  process.env.NODE_ENV === "production" ? remoteEndpoint : localEndpoint;
