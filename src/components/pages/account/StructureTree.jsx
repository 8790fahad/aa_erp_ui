/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef } from "react";
import { FaEdit, FaPlus } from "react-icons/fa";
import { BsTrash } from "react-icons/bs";
import CustomTree from "./CustomTree";

function StructureTree({ editNode, deleteNode, addChild, treeData }) {
  const [searchText, setSearchText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [filteredTreeData, setFilteredTreeData] = useState(treeData);

  // 🌟 Ref to track tree height
  const treeRef = useRef(null);
  const [treeHeight, setTreeHeight] = useState("auto");

  useEffect(() => {
    const normalizeNode = (node) => ({
      ...node,
      expanded: expanded,
      children: Array.isArray(node?.children)
        ? node.children.map(normalizeNode)
        : [],
      head: node?.head || node?.code || "",
      description: node?.description || "",
    });

    const expandedTreeData = Array.isArray(treeData)
      ? treeData.map(normalizeNode)
      : [];
    setFilteredTreeData(expandedTreeData);
  }, [expanded, treeData]);

  useEffect(() => {
    if (!searchText) {
      setFilteredTreeData(treeData);
    } else {
      const filterTree = (data) =>
        data
          .map((node) => {
            const head = (node?.head || node?.code || "").toLowerCase();
            const description = (node?.description || "").toLowerCase();
            const searchLower = searchText.toLowerCase();

            if (
              head.includes(searchLower) ||
              description.includes(searchLower)
            ) {
              return {
                ...node,
                expanded: true,
                children: Array.isArray(node?.children)
                  ? filterTree(node.children)
                  : [],
              };
            }
            return null;
          })
          .filter((node) => node !== null);
      setFilteredTreeData(filterTree(treeData));
    }
  }, [searchText, treeData]);

  useEffect(() => {
    if (treeRef.current) {
      setTreeHeight(`${treeRef.current.scrollHeight + 20}px`); // Add padding
    }
  }, [filteredTreeData]);

  return (
    <div
      ref={treeRef}
      style={{
        minHeight: treeHeight,
        transition: "min-height 0.3s ease-in-out",
      }}
    >
      <div className="row">
        <div className="col-md-4 ml-5 mb-1 mt-0 pl-5">
          {/* Search bar can be placed here if needed */}
        </div>
      </div>
      <div id="print_tree">
        <CustomTree
          generateNodeProps={({ node }) => {
            // Ensure children is always an array
            const children = Array.isArray(node?.children) ? node.children : [];
            const head = node?.head || node?.code || "";
            const description = node?.description || "";

            return {
              title: (
                <span
                  style={{
                    textTransform:
                      children.length > 0 ? "uppercase" : "capitalize",
                  }}
                >
                  {`${head}-${description}`}
                </span>
              ),
              buttons: [
                <button
                  className="btn btn-primary btn-sm  no-print"
                  onClick={() => addChild(node)}
                  style={{ marginRight: "5px", color: "white" }}
                  key="addChild"
                >
                  <FaPlus />
                </button>,
                <button
                  className="btn btn-primary btn-sm  no-print"
                  onClick={() => editNode(node)}
                  style={{ marginRight: "5px", color: "white" }}
                  key="editNode"
                >
                  <FaEdit />
                </button>,
                children.length === 0 && (
                  <button
                    className="btn btn-danger btn-sm no-print"
                    onClick={() => deleteNode(node)}
                    key="deleteNode"
                  >
                    <BsTrash />
                  </button>
                ),
              ],
            };
          }}
          treeData={filteredTreeData}
        />
      </div>
    </div>
  );
}

export default StructureTree;
