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
    const normalizeNode = (node, forceExpand = false) => ({
      ...node,
      expanded: forceExpand ? true : Boolean(node?.expanded),
      children: Array.isArray(node?.children)
        ? node.children.map((child) => normalizeNode(child, forceExpand))
        : [],
      head: node?.head || node?.code || "",
      description: node?.description || "",
    });

    if (!Array.isArray(treeData)) {
      setFilteredTreeData([]);
      return;
    }

    if (!searchText) {
      setFilteredTreeData(treeData.map((node) => normalizeNode(node, expanded)));
      return;
    }

    const searchLower = searchText.toLowerCase();
    const filterTree = (data) =>
      data
        .map((node) => {
          const head = (node?.head || node?.code || "").toLowerCase();
          const description = (node?.description || "").toLowerCase();
          const childMatches = Array.isArray(node?.children)
            ? filterTree(node.children)
            : [];
          const selfMatch =
            head.includes(searchLower) || description.includes(searchLower);

          if (!selfMatch && childMatches.length === 0) return null;

          return {
            ...normalizeNode(node, true),
            expanded: true,
            children: selfMatch
              ? (node.children || []).map((child) => normalizeNode(child, true))
              : childMatches,
          };
        })
        .filter((node) => node !== null);

    setFilteredTreeData(filterTree(treeData));
  }, [expanded, searchText, treeData]);

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
      <style>{`
        #print_tree .rst__row {
          width: 100%;
        }
        /* Keep expand/collapse buttons clickable above the row card */
        #print_tree .rst__expandButton,
        #print_tree .rst__collapseButton {
          z-index: 4 !important;
        }
        #print_tree .rst__rowContents {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
        }
        #print_tree .rst__rowLabel {
          flex: 1 1 auto !important;
          padding-right: 12px !important;
          overflow: hidden;
        }
        #print_tree .rst__rowTitle {
          width: 100%;
        }
        #print_tree .rst__rowToolbar {
          flex: 0 0 auto !important;
          margin-left: auto !important;
          display: flex !important;
          align-items: center !important;
          gap: 4px;
        }
        #print_tree .coa-tree-title {
          display: grid;
          grid-template-columns: 5.5rem minmax(0, 1fr);
          align-items: baseline;
          column-gap: 12px;
          min-width: 0;
          width: 100%;
        }
        #print_tree .coa-tree-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #475569;
          letter-spacing: 0.01em;
        }
        #print_tree .coa-tree-desc {
          font-size: 0.875rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
      <div className="row">
        <div className="col-md-4 ml-5 mb-1 mt-0 pl-5">
          {/* Search bar can be placed here if needed */}
        </div>
      </div>
      <div id="print_tree">
        <CustomTree
          generateNodeProps={({ node, path }) => {
            // Ensure children is always an array
            const children = Array.isArray(node?.children) ? node.children : [];
            const head = node?.head || node?.code || "";
            const description = node?.description || "";
            const depth = Math.max(0, (Array.isArray(path) ? path.length : 1) - 1);

            return {
              style: {
                ["--coa-depth"]: depth,
              },
              title: (
                <span className="coa-tree-title">
                  <span className="coa-tree-code">{head}</span>
                  <span className="coa-tree-desc">{description}</span>
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
