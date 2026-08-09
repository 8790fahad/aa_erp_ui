/* eslint-disable no-unused-vars */
import React, { Component } from "react";
import PropTypes from "prop-types";
// import "react-sortable-tree/style.css";
// import SortableTree from "react-sortable-tree";
import "@nosferatu500/react-sortable-tree/style.css";

import SortableTree from "@nosferatu500/react-sortable-tree";

class CustomTree extends Component {
  constructor(props) {
    super(props);
    this.state = {
      treeData: [],
    };
  }

  static defaultProps = {
    treeData: [],
    generateNodeProps: (f) => f,
    treeLoading: false,
  };

  componentDidMount() {
    this.setState({ treeData: this.withChildren(this.props.treeData) });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.treeData !== this.props.treeData) {
      this.setState({
        treeData: this.mergeExpandedState(
          this.props.treeData,
          this.state.treeData,
        ),
      });
    }
  }

  withChildren(treeData) {
    if (!Array.isArray(treeData)) return [];
    return treeData.map((node) => ({
      ...node,
      expanded: Boolean(node?.expanded),
      children: this.withChildren(
        Array.isArray(node?.children) ? node.children : [],
      ),
    }));
  }

  mergeExpandedState(nextTree, prevTree) {
    const prevExpanded = new Map();
    const collect = (nodes) => {
      (nodes || []).forEach((n) => {
        const key = String(n?.head || n?.code || "");
        if (key) prevExpanded.set(key, Boolean(n.expanded));
        collect(n.children);
      });
    };
    collect(prevTree);

    const apply = (nodes) =>
      (nodes || []).map((node) => {
        const key = String(node?.head || node?.code || "");
        return {
          ...node,
          expanded: prevExpanded.has(key)
            ? prevExpanded.get(key)
            : Boolean(node?.expanded),
          children: apply(
            Array.isArray(node?.children) ? node.children : [],
          ),
        };
      });

    return apply(nextTree);
  }

  render() {
    if (this.props.treeLoading) {
      return <p>Loading...</p>;
    }

    return (
      <div style={{ height: 720 }}>
        <SortableTree
          canDrag={false}
          treeData={this.state.treeData}
          onChange={(treeData) => {
            this.setState({ treeData });
          }}
          generateNodeProps={this.props.generateNodeProps}
          isVirtualized={false}
          scaffoldBlockPxWidth={36}
          rowHeight={52}
          style={{ fontWeight: "lighter", font: "inherit", width: "100%" }}
        />
      </div>
    );
  }
}

CustomTree.propTypes = {
  treeData: PropTypes.array.isRequired,
  treeLoading: PropTypes.bool,
  generateNodeProps: PropTypes.func,
};

export default CustomTree;
